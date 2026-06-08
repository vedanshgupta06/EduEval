from __future__ import annotations

import math
import os
import re
import string
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent


def load_project_env() -> None:
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_project_env()

DEFAULT_UPLOAD_ROOT = PROJECT_ROOT / "edueval-backend" / "uploads"
backend_upload_dir = os.getenv("EDUEVAL_UPLOAD_ROOT") or os.getenv("EDUEVAL_UPLOAD_DIR")
if backend_upload_dir:
    backend_upload_path = Path(backend_upload_dir)
    UPLOAD_ROOT = (
        backend_upload_path.resolve()
        if backend_upload_path.is_absolute()
        else (PROJECT_ROOT / "edueval-backend" / backend_upload_path).resolve()
    )
else:
    UPLOAD_ROOT = DEFAULT_UPLOAD_ROOT.resolve()
MAX_PDF_PAGES = int(os.getenv("EDUEVAL_MAX_PDF_PAGES", "8"))
OCR_SPACE_API_URL = os.getenv("EDUEVAL_OCR_SPACE_API_URL", "https://api.ocr.space/parse/image")
OCR_SPACE_API_KEY = os.getenv("EDUEVAL_OCR_SPACE_API_KEY", "helloworld")
OCR_SPACE_LANGUAGE = os.getenv("EDUEVAL_OCR_SPACE_LANGUAGE", "eng")
OCR_SPACE_TIMEOUT = int(os.getenv("EDUEVAL_OCR_SPACE_TIMEOUT", "60"))
OCR_SPACE_MAX_PDF_PAGES = int(os.getenv("EDUEVAL_OCR_SPACE_MAX_PDF_PAGES", "8"))
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


class QuestionEvaluationRequest(BaseModel):
    file_path: str
    model_answer: str = ""
    max_marks: float = Field(gt=0)
    question_no: int | None = None


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


@app.post("/evaluate-question")
def evaluate_question(payload: QuestionEvaluationRequest) -> dict[str, Any]:
    model_text = normalize_space(payload.model_answer)
    if not model_text:
        raise HTTPException(
            status_code=400,
            detail="Model answer text is required for question evaluation.",
        )

    file_path = safe_file_path(payload.file_path)
    student_text = extract_text_from_file(file_path)
    scoped_student_text = extract_answer_for_question(student_text, payload.question_no)
    if not student_text or not scoped_student_text:
        feedback = unreadable_feedback(payload.max_marks)
        feedback["extracted_full_answer_sheet"] = student_text[:2000]
        return {
            "marks": 0.0,
            "confidence": 0.1,
            "feedback": feedback,
        }

    feedback = build_feedback(model_text, scoped_student_text)
    feedback["extracted_full_answer_sheet"] = student_text[:2000]
    if payload.question_no is not None:
        feedback["question_no"] = payload.question_no
    scores = feedback["score_breakdown"]
    weighted_score = sum(scores[key] * weight for key, weight in SCORING_WEIGHTS.items())
    marks = round(max(0.0, min(payload.max_marks, weighted_score * payload.max_marks)), 2)
    confidence = confidence_from_feedback(feedback, weighted_score)
    feedback["scoring_weights"] = SCORING_WEIGHTS
    feedback["mark_calculation"] = {
        "weighted_score": round(weighted_score, 3),
        "total_marks": payload.max_marks,
        "awarded_marks": marks,
        "formula": (
            "marks = max_marks * "
            "(keyword_score*0.40 + semantic_score*0.35 + "
            "sentence_score*0.15 + length_score*0.10)"
        ),
    }

    return {
        "marks": marks,
        "confidence": confidence,
        "feedback": feedback,
    }


def extract_text_from_upload(relative_path: str) -> str:
    file_path = safe_upload_path(relative_path)
    return extract_text_from_file(file_path)


def extract_text_from_file(file_path: Path) -> str:
    stat = file_path.stat()
    return _extract_text_from_file_cached(str(file_path), stat.st_mtime_ns, stat.st_size)


@lru_cache(maxsize=64)
def _extract_text_from_file_cached(file_path_value: str, _mtime_ns: int, _size: int) -> str:
    file_path = Path(file_path_value)
    suffix = file_path.suffix.lower()

    if suffix == ".pdf":
        return extract_pdf_text(file_path)

    if suffix in {".txt", ".md"}:
        return file_path.read_text(encoding="utf-8", errors="ignore")

    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return extract_image_text(file_path)

    raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")


def extract_answer_for_question(answer_sheet_text: str, question_no: int | None) -> str:
    normalized = normalize_space(answer_sheet_text)
    if not normalized or question_no is None:
        return normalized

    labels = find_question_labels(normalized)
    if not labels:
        return normalized

    current_label = next((label for label in labels if label["number"] == question_no), None)
    next_label = next((label for label in labels if label["number"] > question_no), None)

    if current_label:
        start = current_label["end"]
        end = next_label["start"] if next_label else len(normalized)
        scoped = normalize_space(normalized[start:end])
        return scoped

    if question_no == 1 and next_label:
        scoped = normalize_space(normalized[:next_label["start"]])
        scoped = re.sub(
            r"^(?:question|ques|answer|ans)\b\s*[:#.\-]*\s*",
            "",
            scoped,
            flags=re.IGNORECASE,
        )
        return scoped

    return ""


def find_question_labels(value: str) -> list[dict[str, int]]:
    label_pattern = re.compile(
        r"""
        (?:
            \b(?:q|ques|question|answer|ans)\s*
            (?:no\.?|number|num|\#|:|\-|\.|\))?\s*
            (?P<word_num>one|two|three|four|five|six|seven|eight|nine|ten|[0-9]{1,2})
            \b
        )
        |
        (?:
            (?<!\d)
            (?P<bare_num>[0-9]{1,2})
            \s*[\).:-]
        )
        """,
        flags=re.IGNORECASE | re.VERBOSE,
    )
    labels: list[dict[str, int]] = []
    seen_positions: set[int] = set()

    for match in label_pattern.finditer(value):
        number_value = match.group("word_num") or match.group("bare_num")
        number = parse_question_number(number_value)
        if number is None or number < 1 or number > 50 or match.start() in seen_positions:
            continue
        seen_positions.add(match.start())
        labels.append({"number": number, "start": match.start(), "end": match.end()})

    return sorted(labels, key=lambda label: label["start"])


def parse_question_number(value: str) -> int | None:
    words = {
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
        "ten": 10,
    }
    cleaned = value.strip().lower()
    if cleaned.isdigit():
        return int(cleaned)
    return words.get(cleaned)


def unreadable_submission_result(payload: EvaluationRequest) -> dict[str, Any]:
    feedback = {
        "error": "Could not extract readable text from the submitted answer sheet.",
        "keyword_analysis": {
            "covered": [],
            "missing": [],
        },
        "sentence_analysis": {
            "missing_points": [],
            "additional_content": [],
        },
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
    return validate_readable_path(file_path, relative_path)


def safe_file_path(path_value: str) -> Path:
    candidate = Path(path_value)
    file_path = candidate.resolve() if candidate.is_absolute() else (UPLOAD_ROOT / path_value).resolve()
    return validate_readable_path(file_path, path_value)


def validate_readable_path(file_path: Path, original_value: str) -> Path:
    if not file_path.is_relative_to(UPLOAD_ROOT):
        raise HTTPException(status_code=400, detail="Invalid file path.")

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {original_value}")

    return file_path


def extract_pdf_text(file_path: Path) -> str:
    ocr_text = extract_ocr_space_text(file_path, is_pdf=True)
    if ocr_text:
        return ocr_text

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
    return extract_ocr_space_text(file_path, is_pdf=False)


def extract_ocr_space_text(file_path: Path, is_pdf: bool) -> str:
    data = {
        "language": OCR_SPACE_LANGUAGE,
        "OCREngine": "3",
        "isOverlayRequired": "false",
        "scale": "true",
    }
    if is_pdf:
        data["filetype"] = "PDF"
        data["isCreateSearchablePdf"] = "false"
        data["pages"] = f"1-{OCR_SPACE_MAX_PDF_PAGES}"

    try:
        with file_path.open("rb") as file_obj:
            response = requests.post(
                OCR_SPACE_API_URL,
                headers={"apikey": OCR_SPACE_API_KEY},
                data=data,
                files={"file": (file_path.name, file_obj)},
                timeout=OCR_SPACE_TIMEOUT,
            )
        response.raise_for_status()
        result = response.json()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"OCR.Space request failed: {exc}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="OCR.Space returned invalid JSON.") from exc

    if result.get("IsErroredOnProcessing"):
        error_message = result.get("ErrorMessage") or result.get("ErrorDetails") or "OCR.Space processing failed."
        if isinstance(error_message, list):
            error_message = " ".join(str(item) for item in error_message)
        raise HTTPException(status_code=502, detail=str(error_message))

    parsed_results = result.get("ParsedResults") or []
    parsed_text = "\n".join(item.get("ParsedText", "") for item in parsed_results)
    return normalize_space(parsed_text)


def unreadable_feedback(total_marks: float) -> dict[str, Any]:
    return {
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
            "total_marks": total_marks,
            "awarded_marks": 0.0,
            "formula": "marks = 0 when no readable answer text can be extracted",
        },
    }


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
        "keyword_analysis": {
            "covered": covered,
            "missing": missing,
        },
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
