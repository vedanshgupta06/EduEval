# EduEval AI Engine

Local Python evaluation service for the Spring Boot backend.

## Start

```powershell
cd edueval-ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## OCR

EduEval AI uses OCR.Space OCR Engine 3 for image and PDF answer sheets.
For multi-question exams, students can upload one answer sheet containing all
answers; labeling answers as `Q1`, `Q2`, `Q3`, etc. helps the evaluator isolate
the right text for each question.
Set your OCR.Space API key in the project root `.env`:

```powershell
EDUEVAL_OCR_SPACE_API_KEY=your_ocr_space_api_key_here
EDUEVAL_OCR_SPACE_MAX_UPLOAD_BYTES=900000
EDUEVAL_OCR_SPACE_IMAGE_MAX_SIDE=1600
```

The checked-in local `.env` may use OCR.Space's demo key `helloworld`, but that
is rate limited. Use your own key for real testing.

Spring Boot already points to this service with:

```yaml
app:
  ai-engine:
    base-url: http://127.0.0.1:8000
```

PDFs with selectable text can still be read locally as a fallback, but image
and scanned PDF extraction is handled by OCR.Space.
