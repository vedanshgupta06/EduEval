import easyocr
import fitz          # pymupdf — PDF handling
import httpx
import tempfile
import os
from pathlib import Path

# EasyOCR reader — load once at module level, expensive to init
# gpu=False for safe default; set True if CUDA is available
_reader = None

def get_reader() -> easyocr.Reader:
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(['en'], gpu=False)
    return _reader


def extract_text_from_file(file_path: str, spring_boot_base_url: str) -> str:
    """
    Reads the file directly from disk — both services run on the same machine.
    """
    possible_paths = [
        file_path,  # absolute path from Spring Boot — matches immediately
        os.path.join(r"C:\Users\vedan\edueval-frontend\edueval-backend\uploads", file_path),
        os.path.join(r"C:\Users\vedan\Nlp_Answersheet_Evaluator_Backend\uploads", file_path),
        os.path.join("./uploads", file_path),
    ]

    local_path = None
    for path in possible_paths:
        if os.path.exists(path):
            local_path = path
            break

    if not local_path:
        raise ValueError(f"File not found on disk: {file_path}")

    ext = Path(local_path).suffix.lower()

    if ext == ".pdf":
        return _extract_from_pdf(local_path)
    elif ext in {".jpg", ".jpeg", ".png", ".webp"}:
        return _extract_from_image(local_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def _download_file(url: str, directory: str) -> str:
    """Downloads file from URL and saves to temp directory."""
    with httpx.Client(timeout=30) as client:
        response = client.get(url)
        response.raise_for_status()

    filename = url.split("/")[-1]
    local_path = os.path.join(directory, filename)

    with open(local_path, "wb") as f:
        f.write(response.content)

    return local_path


def _extract_from_image(image_path: str) -> str:
    """Runs EasyOCR on a single image."""
    reader = get_reader()
    results = reader.readtext(image_path, detail=0, paragraph=True)
    return " ".join(results).strip()


def _extract_from_pdf(pdf_path: str) -> str:
    """
    Converts each PDF page to an image, runs OCR on each,
    and concatenates the results.
    Falls back to text extraction if PDF has selectable text.
    """
    doc = fitz.open(pdf_path)
    pages_text = []

    for page_num, page in enumerate(doc):
        text = page.get_text().strip()
        if len(text) > 50:
            pages_text.append(text)
        else:
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat)

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                pix.save(tmp.name)
                page_text = _extract_from_image(tmp.name)
                os.unlink(tmp.name)
                pages_text.append(page_text)

    doc.close()
    return "\n".join(pages_text).strip()