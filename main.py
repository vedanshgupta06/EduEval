import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import EvaluateRequest, EvaluateResponse
from ocr import extract_text_from_file
from evaluator import evaluate, get_model, ensure_nltk

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Spring Boot base URL — used to fetch uploaded files
SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")


# ── Startup: pre-load heavy models ───────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading NLP models...")
    ensure_nltk()
    get_model()   # load sentence transformer once at startup
    logger.info("Models ready.")
    yield
    logger.info("Shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="EduEval AI Engine",
    description="OCR + NLP evaluation service for EduEval platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],  # only Spring Boot calls this
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "edueval-ai-engine"}


# ── Main evaluation endpoint (existing — unchanged) ───────────────────────────

@app.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_submission(request: EvaluateRequest):
    """
    Called by Spring Boot's AiEngineService after a student submits.
    1. Downloads the answer sheet from Spring Boot's /api/files endpoint
    2. Runs OCR to extract text
    3. Evaluates against model answer using NLP pipeline
    4. Returns structured marks + feedback JSON
    """
    logger.info(f"Evaluating submission: {request.submission_id}")

    # ── Step 1: Get model answer text ─────────────────────────────────────────
    model_answer = request.model_answer_text.strip()

    if not model_answer and request.model_answer_url:
        logger.info("Extracting model answer text via OCR...")
        try:
            model_answer = extract_text_from_file(
                request.model_answer_url, SPRING_BOOT_URL
            )
        except Exception as e:
            logger.error(f"Model answer OCR failed: {e}")
            raise HTTPException(
                status_code=422,
                detail=f"Could not extract text from model answer: {str(e)}"
            )

    if not model_answer:
        raise HTTPException(
            status_code=422,
            detail="No model answer available — exam must have either typed text or an uploaded file"
        )

    # ── Step 2: Extract student answer text via OCR ───────────────────────────
    logger.info(f"Running OCR on student submission: {request.file_url}")
    try:
        student_answer = extract_text_from_file(request.file_url, SPRING_BOOT_URL)
    except Exception as e:
        logger.error(f"Student OCR failed: {e}")
        raise HTTPException(
            status_code=422,
            detail=f"Could not extract text from student answer sheet: {str(e)}"
        )

    if not student_answer.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not read any text from the submitted answer sheet. "
                   "Please ensure the file is clear and readable."
        )

    logger.info(
        f"OCR complete — model: {len(model_answer.split())} words, "
        f"student: {len(student_answer.split())} words"
    )

    # ── Step 3: NLP evaluation ────────────────────────────────────────────────
    try:
        ai_marks, confidence, feedback = evaluate(
            model_answer=model_answer,
            student_answer=student_answer,
            total_marks=request.total_marks,
        )
    except Exception as e:
        logger.error(f"Evaluation failed for {request.submission_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Evaluation pipeline error: {str(e)}"
        )

    logger.info(
        f"Evaluation complete for {request.submission_id} — "
        f"marks: {ai_marks}/{request.total_marks}, confidence: {confidence}"
    )

    return EvaluateResponse(
        submission_id=request.submission_id,
        ai_marks=ai_marks,
        ai_confidence=confidence,
        feedback=feedback,
    )


# ── Per-question evaluation endpoint (NEW — multi-question exam support) ──────

class QuestionEvaluateRequest:
    def __init__(self, file_path: str, model_answer: str, max_marks: int):
        self.file_path = file_path
        self.model_answer = model_answer
        self.max_marks = max_marks

from pydantic import BaseModel

class QuestionEvaluateRequest(BaseModel):
    file_path: str      # absolute disk path written by Spring Boot
    model_answer: str   # model answer for this specific question
    max_marks: int      # marks allocated to this question


@app.post("/evaluate-question")
async def evaluate_question(request: QuestionEvaluateRequest):
    """
    Called by Spring Boot's QuestionSubmissionService for each question submission.
    Reuses the exact same OCR + NLP pipeline as /evaluate.

    Differences from /evaluate:
    - file_path is an absolute disk path (not a URL) — Spring Boot writes the
      file locally and passes the path directly, same pattern as existing setup.
    - model_answer is per-question text only.
    - max_marks is per-question, not total exam marks.
    - Returns 0 marks (not an error) when the question is skipped/blank.
    """
    logger.info(f"Evaluating question — file: {request.file_path}, max_marks: {request.max_marks}")

    # ── Step 1: OCR — read file directly from disk ────────────────────────────
    # extract_text_from_file already handles both URL and disk paths.
    # Passing None as spring_boot_url tells it to read from disk directly.
    try:
        student_answer = extract_text_from_file(request.file_path, None)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")
    except Exception as e:
        logger.error(f"OCR failed for question file {request.file_path}: {e}")
        raise HTTPException(status_code=422, detail=f"Could not extract text: {str(e)}")

    # ── Skipped question: blank page / unreadable ─────────────────────────────
    if not student_answer or not student_answer.strip():
        logger.info("No text detected — treating as skipped question (0 marks)")
        return {
            "marks": 0.0,
            "confidence": 1.0,
            "feedback": {
                "semantic_score": 0.0,
                "keyword_score": 0.0,
                "matched_keywords": [],
                "missed_keywords": [],
                "explanation": "No text detected — question appears to be skipped."
            }
        }

    logger.info(
        f"OCR complete — model: {len(request.model_answer.split())} words, "
        f"student: {len(student_answer.split())} words"
    )

    # ── Step 2: NLP evaluation ────────────────────────────────────────────────
    try:
        ai_marks, confidence, feedback = evaluate(
            model_answer=request.model_answer,
            student_answer=student_answer,
            total_marks=request.max_marks,
        )
    except Exception as e:
        logger.error(f"Evaluation pipeline error: {e}")
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")

    logger.info(f"Question evaluated — marks: {ai_marks}/{request.max_marks}, confidence: {confidence}")

    return {
    "marks":      round(float(ai_marks), 2),
    "confidence": round(float(confidence), 4),
    "feedback": {
        "semantic_score":   feedback.score_breakdown.semantic_score,
        "keyword_score":    feedback.score_breakdown.keyword_score,
        "matched_keywords": feedback.keyword_analysis.covered,
        "missed_keywords":  feedback.keyword_analysis.missing,
        "explanation":      (
            f"Semantic: {feedback.score_breakdown.semantic_score}, "
            f"Keywords: {feedback.score_breakdown.keyword_score}, "
            f"Sentences: {feedback.score_breakdown.sentence_score}, "
            f"Length: {feedback.score_breakdown.length_score}. "
            f"Word count — model: {feedback.word_count_model}, "
            f"student: {feedback.word_count_student}."
        ),
    }
}