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


# ── Main evaluation endpoint ──────────────────────────────────────────────────

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
        # Teacher uploaded a file — OCR it too
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
        # OCR returned nothing — blank page or unreadable scan
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
