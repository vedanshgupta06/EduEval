from __future__ import annotations

import math
import os
import re
import shutil
import string
from collections import Counter
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent
DEFAULT_UPLOAD_ROOT = PROJECT_ROOT / "edueval-backend" / "uploads"
UPLOAD_ROOT = Path(os.getenv("EDUEVAL_UPLOAD_ROOT", DEFAULT_UPLOAD_ROOT)).resolve()
MAX_PDF_PAGES = int(os.getenv("EDUEVAL_MAX_PDF_PAGES", "8"))
TESSERACT_CMD = os.getenv("EDUEVAL_TESSERACT_CMD", "tesseract")
WINDOWS_TESSERACT_PATHS = [
    Path(os.getenv("ProgramFiles", r"C:\Program Files")) / "Tesseract-OCR" / "tesseract.exe",
    Path(os.getenv("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Tesseract-OCR" / "tesseract.exe",
]
SCORING_WEIGHTS = {
    "keyword_score": 0.40,
    "semantic_score": 0.35,
    "sentence_score": 0.15,
    "length_score": 0.10,
}

STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from",
    "has", "have", "in", "is", "it", "its", "of", "on", "or", "that", "the",
    "their", "this", "to", "was", "were", "will", "with", "you", "your",
}


class EvaluationRequest(BaseModel):
    submission_id: str
    file_url: str
    model_answer_url: str | None = ""
    model_answer_text: str | None = ""
    total_marks: float = Field(gt=0)


app = FastAPI(title="EduEval AI Engine")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/evaluate")
def evaluate(payload: EvaluationRequest) -> dict[str, Any]:
    model_text = (payload.model_answer_text or "").strip()
    if not model_text and payload.model_answer_url:
        model_text = extract_text_from_upload(payload.model_answer_url)

    if not model_text:
        raise HTTPException(
            status_code=400,
            detail="Model answer text or model answer file is required for evaluation.",
        )

    student_text = extract_text_from_upload(payload.file_url)
    if not student_text:
        return unreadable_submission_result(payload)

    feedback = build_feedback(model_text, student_text)
    scores = feedback["score_breakdown"]

    weighted_score = sum(scores[key] * weight for key, weight in SCORING_WEIGHTS.items())
    ai_marks = round(max(0.0, min(payload.total_marks, weighted_score * payload.total_marks)), 2)

    confidence = confidence_from_feedback(feedback, weighted_score)
    feedback["scoring_weights"] = SCORING_WEIGHTS
    feedback["mark_calculation"] = {
        "weighted_score": round(weighted_score, 3),
        "total_marks": payload.total_marks,
        "awarded_marks": ai_marks,
        "formula": (
            "marks = total_marks * "
            "(keyword_score*0.40 + semantic_score*0.35 + "
            "sentence_score*0.15 + length_score*0.10)"
        ),
        "basis": [
            "Keyword score checks important model-answer terms covered by the student.",
            "Semantic score compares overall concept similarity with the model answer.",
            "Sentence score checks whether key model-answer points were addressed.",
            "Length score checks whether the answer has enough detail compared with the model answer.",
        ],
    }

    return {
        "submission_id": payload.submission_id,
        "ai_marks": ai_marks,
        "ai_confidence": confidence,
        "feedback": feedback,
    }


def extract_text_from_upload(relative_path: str) -> str:
    file_path = safe_upload_path(relative_path)
    suffix = file_path.suffix.lower()

    if suffix == ".pdf":
        return extract_pdf_text(file_path)

    if suffix in {".txt", ".md"}:
        return file_path.read_text(encoding="utf-8", errors="ignore")

    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return extract_image_text(file_path)

    raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")


def unreadable_submission_result(payload: EvaluationRequest) -> dict[str, Any]:
    feedback = {
        "error": "Could not extract readable text from the submitted answer sheet.",
        "keyword_analysis": {"covered": [], "missing": []},
        "sentence_analysis": {"missing_points": [], "additional_content": []},
        "score_breakdown": {
            "keyword_score": 0.0,
            "semantic_score": 0.0,
            "sentence_score": 0.0,
            "length_score": 0.0,
        },
        "word_count_model": 0,
        "word_count_student": 0,
        "extracted_student_answer": "",
        "scoring_weights": SCORING_WEIGHTS,
        "mark_calculation": {
            "weighted_score": 0.0,
            "total_marks": payload.total_marks,
            "awarded_marks": 0.0,
            "formula": "marks = 0 when no readable answer text can be extracted",
            "basis": [
                "No readable text was extracted from the submitted answer sheet.",
                "Ask the student to upload a clearer scan, PDF, or typed answer.",
            ],
        },
    }

    return {
        "submission_id": payload.submission_id,
        "ai_marks": 0.0,
        "ai_confidence": 0.1,
        "feedback": feedback,
    }


def safe_upload_path(relative_path: str) -> Path:
    cleaned = relative_path.replace("\\", "/").lstrip("/")
    file_path = (UPLOAD_ROOT / cleaned).resolve()

    if not file_path.is_relative_to(UPLOAD_ROOT):
        raise HTTPException(status_code=400, detail="Invalid file path.")

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {relative_path}")

    return file_path


def extract_pdf_text(file_path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Install pypdf in edueval-ai to read PDF submissions.",
        ) from exc

    reader = PdfReader(str(file_path))
    pages = []
    for page in reader.pages[:MAX_PDF_PAGES]:
        pages.append(page.extract_text() or "")
    return normalize_space("\n".join(pages))


def extract_image_text(file_path: Path) -> str:
    try:
        import pytesseract
        from PIL import Image, ImageFilter, ImageEnhance
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Install pillow and pytesseract to read image submissions.",
        ) from exc

    tesseract_cmd = resolve_tesseract_cmd()
    if not tesseract_cmd:
        raise HTTPException(
            status_code=503,
            detail=(
                "Image OCR is unavailable because Tesseract OCR is not installed "
                "or is not in PATH. Install Tesseract or set EDUEVAL_TESSERACT_CMD."
            ),
        )

    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    try:
        img = Image.open(file_path)

        # Convert to grayscale
        img = img.convert('L')

        # Enhance contrast for better OCR on handwritten text
        img = ImageEnhance.Contrast(img).enhance(2.0)

        # Sharpen edges
        img = img.filter(ImageFilter.SHARPEN)

        # Use psm 6 (assume uniform block of text) with oem 3 (best LSTM engine)
        custom_config = r'--oem 3 --psm 6'

        return normalize_space(pytesseract.image_to_string(img, config=custom_config))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Image OCR failed. Make sure the Tesseract OCR app is installed.",
        ) from exc


def resolve_tesseract_cmd() -> str | None:
    if shutil.which(TESSERACT_CMD) or Path(TESSERACT_CMD).exists():
        return TESSERACT_CMD

    for candidate in WINDOWS_TESSERACT_PATHS:
        if candidate.exists():
            return str(candidate)

    return None


def build_feedback(model_answer: str, student_answer: str) -> dict[str, Any]:
    model_tokens = content_tokens(model_answer)
    student_tokens = content_tokens(student_answer)

    model_counter = Counter(model_tokens)
    student_counter = Counter(student_tokens)

    model_keywords = top_keywords(model_counter, limit=18)
    student_vocab = set(student_tokens)

    covered = [keyword for keyword in model_keywords if keyword in student_vocab]
    missing = [keyword for keyword in model_keywords if keyword not in student_vocab]

    model_sentences = split_sentences(model_answer)
    student_sentences = split_sentences(student_answer)

    missing_points = [
        sentence
        for sentence in model_sentences
        if best_sentence_similarity(sentence, student_sentences) < 0.35
    ][:6]

    additional_content = [
        sentence
        for sentence in student_sentences
        if best_sentence_similarity(sentence, model_sentences) < 0.20
    ][:6]

    keyword_score = safe_ratio(len(covered), len(model_keywords))
    semantic_score = cosine_similarity(model_counter, student_counter)
    sentence_score = 1.0 - safe_ratio(len(missing_points), max(len(model_sentences), 1))
    length_score = length_similarity(len(model_tokens), len(student_tokens))

    return {
        "keyword_analysis": {"covered": covered, "missing": missing},
        "sentence_analysis": {
            "missing_points": missing_points,
            "additional_content": additional_content,
        },
        "score_breakdown": {
            "keyword_score": round(keyword_score, 3),
            "semantic_score": round(semantic_score, 3),
            "sentence_score": round(max(0.0, min(1.0, sentence_score)), 3),
            "length_score": round(length_score, 3),
        },
        "word_count_model": len(model_answer.split()),
        "word_count_student": len(student_answer.split()),
        "extracted_student_answer": student_answer[:1200],
    }


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def content_tokens(value: str) -> list[str]:
    translator = str.maketrans("", "", string.punctuation)
    words = normalize_space(value).lower().translate(translator).split()
    return [
        word
        for word in words
        if len(word) > 2 and word not in STOP_WORDS and not word.isnumeric()
    ]


def top_keywords(counter: Counter[str], limit: int) -> list[str]:
    return [word for word, _ in counter.most_common(limit)]


def split_sentences(value: str) -> list[str]:
    sentences = [
        normalize_space(sentence)
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", value)
    ]
    return [sentence for sentence in sentences if len(sentence.split()) >= 4]


def best_sentence_similarity(sentence: str, candidates: list[str]) -> float:
    if not candidates:
        return 0.0

    sentence_counter = Counter(content_tokens(sentence))
    return max(cosine_similarity(sentence_counter, Counter(content_tokens(item))) for item in candidates)


def cosine_similarity(first: Counter[str], second: Counter[str]) -> float:
    if not first or not second:
        return 0.0

    shared = set(first) & set(second)
    numerator = sum(first[token] * second[token] for token in shared)
    first_norm = math.sqrt(sum(value * value for value in first.values()))
    second_norm = math.sqrt(sum(value * value for value in second.values()))

    if first_norm == 0 or second_norm == 0:
        return 0.0

    return max(0.0, min(1.0, numerator / (first_norm * second_norm)))


def length_similarity(model_len: int, student_len: int) -> float:
    if model_len == 0 or student_len == 0:
        return 0.0

    ratio = student_len / model_len
    if 0.75 <= ratio <= 1.35:
        return 1.0

    return max(0.0, min(1.0, ratio if ratio < 0.75 else 1.35 / ratio))


def safe_ratio(part: int, total: int) -> float:
    return 0.0 if total == 0 else part / total


def confidence_from_feedback(feedback: dict[str, Any], weighted_score: float) -> float:
    missing_count = len(feedback["sentence_analysis"]["missing_points"])
    additional_count = len(feedback["sentence_analysis"]["additional_content"])
    extraction_bonus = 0.1 if feedback["word_count_student"] >= 20 else -0.2
    uncertainty_penalty = min(0.25, (missing_count + additional_count) * 0.025)
    confidence = 0.65 + (weighted_score * 0.25) + extraction_bonus - uncertainty_penalty
    return round(max(0.35, min(0.95, confidence)), 3)


class QuestionEvaluateRequest(BaseModel):
    file_path: str
    model_answer: str
    max_marks: int


@app.post("/evaluate-question")
def evaluate_question(request: QuestionEvaluateRequest):
    file_path = Path(request.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    suffix = file_path.suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp"}:
        student_text = extract_image_text(file_path)
    elif suffix == ".pdf":
        student_text = extract_pdf_text(file_path)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")

    if not student_text or not student_text.strip():
        return {
            "marks": 0.0,
            "confidence": 1.0,
            "feedback": {
                "matched_keywords": [],
                "missed_keywords": [],
                "semantic_score": 0.0,
                "keyword_score": 0.0,
                "explanation": "No text detected — question appears skipped.",
            },
        }

    feedback = build_feedback(request.model_answer, student_text)
    scores = feedback["score_breakdown"]
    weighted_score = sum(scores[key] * weight for key, weight in SCORING_WEIGHTS.items())
    ai_marks = round(max(0.0, min(request.max_marks, weighted_score * request.max_marks)), 2)
    confidence = confidence_from_feedback(feedback, weighted_score)

    return {
        "marks": ai_marks,
        "confidence": confidence,
        "feedback": {
            "semantic_score": scores["semantic_score"],
            "keyword_score": scores["keyword_score"],
            "matched_keywords": feedback["keyword_analysis"]["covered"],
            "missed_keywords": feedback["keyword_analysis"]["missing"],
            "explanation": (
                f"Semantic: {scores['semantic_score']}, "
                f"Keywords: {scores['keyword_score']}, "
                f"Sentences: {scores['sentence_score']}, "
                f"Length: {scores['length_score']}. "
                f"Words — model: {feedback['word_count_model']}, "
                f"student: {feedback['word_count_student']}."
            ),
        },
    }