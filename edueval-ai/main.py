from __future__ import annotations

import math
import os
import re
import string
import logging
from io import BytesIO
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
logging.basicConfig(level=logging.INFO)

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
OCR_SPACE_ENGINE = os.getenv("EDUEVAL_OCR_SPACE_ENGINE", "2")
OCR_SPACE_LANGUAGE = os.getenv(
    "EDUEVAL_OCR_SPACE_LANGUAGE",
    "auto" if OCR_SPACE_ENGINE in {"2", "3"} else "eng",
)
OCR_SPACE_TIMEOUT = int(os.getenv("EDUEVAL_OCR_SPACE_TIMEOUT", "60"))
OCR_SPACE_MAX_PDF_PAGES = int(os.getenv("EDUEVAL_OCR_SPACE_MAX_PDF_PAGES", "8"))
OCR_SPACE_MAX_UPLOAD_BYTES = int(os.getenv("EDUEVAL_OCR_SPACE_MAX_UPLOAD_BYTES", "900000"))
OCR_SPACE_IMAGE_MAX_SIDE = int(os.getenv("EDUEVAL_OCR_SPACE_IMAGE_MAX_SIDE", "1600"))
OCR_SPACE_COMPARE_ENGINES = os.getenv("EDUEVAL_OCR_SPACE_COMPARE_ENGINES", "true").lower() == "true"
logger = logging.getLogger("edueval-ai")
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

OCR_COMMON_WORDS = {
    "about", "activation", "again", "answer", "automatically", "backpropagation",
    "because", "before", "better", "changed", "choose", "classification",
    "clear", "complex", "concept", "data", "deep", "different", "directly",
    "dropout", "early", "examples", "extraction", "feature", "features",
    "functions", "general", "gradients", "humans", "images", "instead",
    "learn", "learning", "line", "loss", "machine", "method", "model",
    "networks", "neural", "non", "only", "overfitting", "patterns",
    "perform", "question", "raw", "reduced", "regularisation", "regularization",
    "relationship", "relu", "scanned", "sigmoid", "simple", "size",
    "speech", "stopping", "text", "traditional", "training", "type",
    "unseen", "updates", "using", "weights", "well", "when", "with",
}

OCR_KNOWN_CORRECTIONS = {
    "adivation": "activation",
    "coith": "with",
    "deacent": "descent",
    "disecty": "directly",
    "disely": "directly",
    "dundon": "function",
    "durchiona": "functions",
    "featuse": "feature",
    "humane": "humans",
    "layero": "layers",
    "learnin": "learning",
    "lineority": "linearity",
    "marually": "manually",
    "mang": "many",
    "needa": "needs",
    "netwarks": "networks",
    "networks": "networks",
    "non-lineority": "non-linearity",
    "seature": "feature",
    "setore": "before",
    "trairing": "training",
    "traning": "training",
    "ually": "usually",
    "uding": "using",
    "unes": "uses",
    "wred": "uses",
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
    logger.info("POST /evaluate-question received for question %s", payload.question_no)
    model_text = normalize_space(payload.model_answer)
    if not model_text:
        raise HTTPException(
            status_code=400,
            detail="Model answer text is required for question evaluation.",
        )

    file_path = safe_file_path(payload.file_path)
    student_text = extract_text_from_file(file_path)
    scoped_student_text = extract_answer_for_question(student_text, payload.question_no)
    if scoped_student_text:
        scoped_student_text = correct_ocr_text(scoped_student_text, model_text)
    if not student_text or not scoped_student_text:
        logger.warning("No readable text extracted for question %s", payload.question_no)
        feedback = unreadable_feedback_with_reason(
            payload.max_marks,
            (
                "No answer was detected below this question number. "
                "Write each answer under a clear label such as Q1, Q2, Q3."
            )
            if student_text
            else "Could not extract readable OCR text from the submitted answer sheet.",
        )
        feedback["extracted_full_answer_sheet"] = student_text[:2000]
        if payload.question_no is not None:
            feedback["question_no"] = payload.question_no
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

    logger.info(
        "Completed /evaluate-question for question %s with %.2f/%s marks",
        payload.question_no,
        marks,
        payload.max_marks,
    )

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
        logger.warning("No question labels found in extracted answer sheet text.")
        return ""

    current_index = next((index for index, label in enumerate(labels) if label["number"] == question_no), None)
    if current_index is None:
        logger.warning("Question %s label was not found in extracted answer sheet text.", question_no)
        return ""

    current_label = labels[current_index]
    next_label = labels[current_index + 1] if current_index + 1 < len(labels) else None
    start = current_label["end"]
    end = next_label["start"] if next_label else len(normalized)
    scoped = normalize_space(normalized[start:end])
    scoped = re.sub(
        r"^(?:ans|answer)\b\s*[:#*?.\-]*\s*",
        "",
        scoped,
        flags=re.IGNORECASE,
    )
    scoped = re.sub(r"\s*#\s*$", "", scoped)
    if not is_meaningful_answer_text(scoped):
        logger.warning("Question %s label exists, but no meaningful answer text was found below it.", question_no)
        return ""

    return scoped


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


def is_meaningful_answer_text(value: str) -> bool:
    tokens = content_tokens(value)
    if len(tokens) < 3:
        return False

    readable_words = sum(1 for token in tokens if is_readable_word(token))
    return safe_ratio(readable_words, len(tokens)) >= 0.45


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
    embedded_text = normalize_space("\n".join(pages))
    if embedded_text:
        return embedded_text

    image_text = extract_pdf_embedded_image_text(reader)
    if image_text:
        return image_text

    try:
        ocr_text = extract_ocr_space_text(file_path, is_pdf=True)
    except HTTPException as exc:
        logger.warning("OCR failed for PDF %s: %s", file_path.name, exc.detail)
        return ""
    if ocr_text:
        return ocr_text

    return ""


def extract_image_text(file_path: Path) -> str:
    try:
        return extract_ocr_space_text(file_path, is_pdf=False)
    except HTTPException as exc:
        logger.warning("OCR failed for image %s: %s", file_path.name, exc.detail)
        return ""


def extract_ocr_space_text(file_path: Path, is_pdf: bool) -> str:
    upload_name, upload_bytes, content_type = prepare_ocr_upload(file_path, is_pdf)
    return extract_ocr_space_upload(upload_name, upload_bytes, content_type, is_pdf)


def extract_ocr_space_upload(
    upload_name: str,
    upload_bytes: bytes,
    content_type: str,
    is_pdf: bool,
) -> str:
    errors: list[str] = []
    candidates: list[dict[str, Any]] = []

    for engine in ocr_space_engines_to_try():
        try:
            result = request_ocr_space(
                upload_name=upload_name,
                upload_bytes=upload_bytes,
                content_type=content_type,
                is_pdf=is_pdf,
                engine=engine,
            )
        except HTTPException as exc:
            errors.append(f"engine {engine}: {exc.detail}")
            logger.warning("OCR.Space engine %s failed for %s: %s", engine, upload_name, exc.detail)
            continue

        parsed_results = result.get("ParsedResults") or []
        parsed_text = "\n".join(item.get("ParsedText", "") for item in parsed_results)
        normalized_text = normalize_ocr_text(parsed_text)
        candidates.append(
            {
                "engine": engine,
                "text": normalized_text,
                "score": ocr_text_quality_score(normalized_text),
            }
        )
        if not OCR_SPACE_COMPARE_ENGINES:
            break

    if not candidates:
        raise HTTPException(
            status_code=502,
            detail="OCR.Space failed for all configured engines: " + "; ".join(errors),
        )

    best = max(candidates, key=lambda candidate: candidate["score"])
    logger.info(
        "Selected OCR.Space engine %s with quality score %.3f",
        best["engine"],
        best["score"],
    )
    if not is_readable_ocr_text(best["text"]):
        raise HTTPException(
            status_code=502,
            detail=(
                "OCR text was too noisy to evaluate reliably. "
                "Upload a clearer scan with dark writing, good lighting, and question labels."
            ),
        )
    return best["text"]


def extract_pdf_embedded_image_text(reader: Any) -> str:
    page_texts: list[str] = []
    for page_index, page in enumerate(reader.pages[:MAX_PDF_PAGES], start=1):
        images = list(getattr(page, "images", []) or [])
        if not images:
            continue

        image_candidates: list[str] = []
        for image_index, image in enumerate(images, start=1):
            image_name = getattr(image, "name", None) or f"page{page_index}_image{image_index}.jpg"
            content_type = guess_image_content_type(image_name)
            try:
                image_text = extract_ocr_space_upload(
                    image_name,
                    image.data,
                    content_type,
                    is_pdf=False,
                )
            except HTTPException as exc:
                logger.warning(
                    "OCR failed for PDF page %s image %s: %s",
                    page_index,
                    image_index,
                    exc.detail,
                )
                continue
            if image_text:
                image_candidates.append(image_text)

        if image_candidates:
            page_texts.append(max(image_candidates, key=ocr_text_quality_score))

    return normalize_space(" ".join(page_texts))


def guess_image_content_type(file_name: str) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix in {".png"}:
        return "image/png"
    if suffix in {".webp"}:
        return "image/webp"
    return "image/jpeg"


def ocr_space_engines_to_try() -> list[str]:
    preferred = OCR_SPACE_ENGINE if OCR_SPACE_ENGINE in {"1", "2", "3"} else "2"
    return list(dict.fromkeys([preferred, "3", "2", "1"]))


def request_ocr_space(
    *,
    upload_name: str,
    upload_bytes: bytes,
    content_type: str,
    is_pdf: bool,
    engine: str,
) -> dict[str, Any]:
    data = {
        "apikey": OCR_SPACE_API_KEY,
        "language": OCR_SPACE_LANGUAGE if engine in {"2", "3"} else "eng",
        "OCREngine": engine,
        "isOverlayRequired": "false",
        "detectOrientation": "true",
        "scale": "true",
        "filetype": "PDF" if is_pdf else "JPG",
    }
    if is_pdf:
        data["isCreateSearchablePdf"] = "false"

    try:
        logger.info(
            "Sending %s to OCR.Space engine %s (%s bytes)",
            upload_name,
            engine,
            len(upload_bytes),
        )
        response = requests.post(
            OCR_SPACE_API_URL,
            headers={"apikey": OCR_SPACE_API_KEY},
            data=data,
            files={"file": (upload_name, upload_bytes, content_type)},
            timeout=OCR_SPACE_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"request failed before response: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"HTTP {response.status_code}: {ocr_space_error_text(response)}",
        )

    try:
        result = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="returned invalid JSON") from exc

    if result.get("IsErroredOnProcessing"):
        raise HTTPException(status_code=502, detail=ocr_space_result_error(result))

    return result


def ocr_space_error_text(response: requests.Response) -> str:
    try:
        return ocr_space_result_error(response.json())
    except ValueError:
        return normalize_space(response.text)[:500] or response.reason


def ocr_space_result_error(result: dict[str, Any]) -> str:
    error_message = result.get("ErrorMessage") or result.get("ErrorDetails") or "OCR.Space processing failed."
    if isinstance(error_message, list):
        return " ".join(str(item) for item in error_message)
    return str(error_message)


def normalize_ocr_text(value: str) -> str:
    text = normalize_space(value)
    replacements = {
        " DAITE ": " ",
        " DATE ": " ",
        "Questlon": "Question",
        "Queslion": "Question",
        "0uestion": "Question",
        "Ans ?": "Ans",
        "Tt ": "It ",
        " dała ": " data ",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"^(?:DATE|DAITE)\s*#?\s*", "", text, flags=re.IGNORECASE)
    return normalize_space(text)


def correct_ocr_text(value: str, reference_text: str) -> str:
    value = normalize_ocr_text(value)
    vocabulary = correction_vocabulary(reference_text)

    def replace_word(match: re.Match[str]) -> str:
        original = match.group(0)
        lower = original.lower()
        if lower in OCR_KNOWN_CORRECTIONS:
            replacement = OCR_KNOWN_CORRECTIONS[lower]
            return replacement.capitalize() if original[:1].isupper() else replacement
        if len(lower) <= 3 or lower in vocabulary or lower in STOP_WORDS:
            return original
        if is_readable_word(lower):
            return original

        replacement = closest_ocr_word(lower, vocabulary)
        if not replacement:
            return original
        if original[:1].isupper():
            return replacement.capitalize()
        return replacement

    corrected = re.sub(r"[A-Za-z]{4,}", replace_word, value)
    corrected = re.sub(r"\bos\s+usually\s+needs\b", "usually needs", corrected, flags=re.IGNORECASE)
    corrected = re.sub(r"\bout\s+deep\b", "but deep", corrected, flags=re.IGNORECASE)
    corrected = re.sub(r"\btatte\s+work\s+directly\b", "work directly", corrected, flags=re.IGNORECASE)
    corrected = re.sub(r"\bsaw\s+data\b", "raw data", corrected, flags=re.IGNORECASE)
    return normalize_space(corrected)


def correction_vocabulary(reference_text: str) -> set[str]:
    vocabulary = set(OCR_COMMON_WORDS) | set(STOP_WORDS)
    vocabulary.update(content_tokens(reference_text))
    return {word for word in vocabulary if word.isalpha() and len(word) > 2}


def closest_ocr_word(word: str, vocabulary: set[str]) -> str | None:
    max_distance = 1 if len(word) <= 4 else 2
    best_word: str | None = None
    best_distance = max_distance + 1

    for candidate in vocabulary:
        if abs(len(candidate) - len(word)) > max_distance:
            continue
        distance = levenshtein_distance(word, candidate, best_distance)
        if distance < best_distance:
            best_word = candidate
            best_distance = distance
            if distance == 1:
                break

    return best_word if best_distance <= max_distance else None


def levenshtein_distance(first: str, second: str, stop_after: int) -> int:
    if abs(len(first) - len(second)) > stop_after:
        return stop_after + 1

    previous = list(range(len(second) + 1))
    for row_index, first_char in enumerate(first, start=1):
        current = [row_index]
        row_min = current[0]
        for column_index, second_char in enumerate(second, start=1):
            cost = 0 if first_char == second_char else 1
            current_value = min(
                previous[column_index] + 1,
                current[column_index - 1] + 1,
                previous[column_index - 1] + cost,
            )
            current.append(current_value)
            row_min = min(row_min, current_value)
        if row_min > stop_after:
            return stop_after + 1
        previous = current

    return previous[-1]


def ocr_text_quality_score(value: str) -> float:
    normalized = normalize_space(value)
    if not normalized:
        return 0.0

    words = re.findall(r"[A-Za-z][A-Za-z'-]*", normalized)
    if not words:
        return 0.0

    readable_words = sum(1 for word in words if is_readable_word(word.lower()))
    label_bonus = min(0.2, len(find_question_labels(normalized)) * 0.04)
    alpha_chars = sum(1 for char in normalized if char.isalpha() or char.isspace())
    alpha_ratio = alpha_chars / max(len(normalized), 1)
    average_word_length = sum(len(word) for word in words) / len(words)
    length_penalty = 0.15 if average_word_length < 3.0 or average_word_length > 13.0 else 0.0

    return (
        safe_ratio(readable_words, len(words)) * 0.65
        + alpha_ratio * 0.25
        + label_bonus
        - length_penalty
    )


def is_readable_ocr_text(value: str) -> bool:
    words = re.findall(r"[A-Za-z][A-Za-z'-]*", normalize_space(value))
    if len(words) < 8:
        return False
    return ocr_text_quality_score(value) >= 0.45


def is_readable_word(value: str) -> bool:
    word = value.lower().strip(string.punctuation)
    if len(word) <= 2:
        return True
    if word in OCR_COMMON_WORDS or word in STOP_WORDS:
        return True
    if word.endswith(("ing", "ed", "tion", "sion", "ment", "ness", "able", "ible", "ally", "ly")):
        return True
    vowels = sum(1 for char in word if char in "aeiou")
    return vowels >= 1 and not re.search(r"[^aeiou]{5,}", word)


def prepare_ocr_upload(file_path: Path, is_pdf: bool) -> tuple[str, bytes, str]:
    if is_pdf:
        data = file_path.read_bytes()
        if len(data) > OCR_SPACE_MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=(
                    "PDF is too large for OCR.Space. Export or scan it as a compressed "
                    "JPG/PNG image, or reduce the PDF size before uploading."
                ),
            )
        return file_path.name, data, "application/pdf"

    return prepare_image_ocr_upload(file_path)


def prepare_image_ocr_upload(file_path: Path) -> tuple[str, bytes, str]:
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Install pillow in edueval-ai to compress image submissions.",
        ) from exc

    try:
        with Image.open(file_path) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail(
                (OCR_SPACE_IMAGE_MAX_SIDE, OCR_SPACE_IMAGE_MAX_SIDE),
                Image.Resampling.LANCZOS,
            )
            if image.mode not in {"RGB", "L"}:
                image = image.convert("RGB")

            for quality in (82, 74, 66, 58, 50, 42):
                buffer = BytesIO()
                image.save(buffer, format="JPEG", quality=quality, optimize=True)
                data = buffer.getvalue()
                if len(data) <= OCR_SPACE_MAX_UPLOAD_BYTES:
                    return f"{file_path.stem}_ocr.jpg", data, "image/jpeg"

            buffer = BytesIO()
            smaller = image.copy()
            smaller.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
            smaller.save(buffer, format="JPEG", quality=38, optimize=True)
            data = buffer.getvalue()
            if len(data) <= OCR_SPACE_MAX_UPLOAD_BYTES:
                return f"{file_path.stem}_ocr.jpg", data, "image/jpeg"

            raise HTTPException(
                status_code=413,
                detail=(
                    "Image is still too large for OCR.Space after compression. "
                    "Please crop extra background or upload a lower-resolution image."
                ),
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image compression failed: {exc}") from exc


def unreadable_feedback(total_marks: float) -> dict[str, Any]:
    return unreadable_feedback_with_reason(
        total_marks,
        "Could not extract readable text from the submitted answer sheet.",
    )


def unreadable_feedback_with_reason(total_marks: float, reason: str) -> dict[str, Any]:
    return {
        "error": reason,
        "not_evaluated": True,
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
