# EduEval AI Engine

Python FastAPI service for OCR + NLP evaluation.

## Setup

```bash
# 1. Create virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy env file
cp .env.example .env

# 4. Run the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | /health | Health check |
| POST | /evaluate | Evaluate a student submission |
| GET | /docs | Swagger UI (auto-generated) |

## Testing manually

Once running, open http://localhost:8000/docs
to test the /evaluate endpoint from the browser.

## Expected request from Spring Boot

```json
{
  "submission_id": "uuid-string",
  "file_url": "submissions/examId/uuid.pdf",
  "model_answer_url": "",
  "model_answer_text": "The water cycle consists of...",
  "total_marks": 10
}
```

## Expected response to Spring Boot

```json
{
  "submission_id": "uuid-string",
  "ai_marks": 7.5,
  "ai_confidence": 0.82,
  "feedback": {
    "keyword_analysis": {
      "covered": ["evaporation", "condensation"],
      "missing": ["precipitation"],
      "coverage_score": 0.67
    },
    "sentence_analysis": {
      "missing_points": ["The cycle is driven by solar energy."],
      "additional_content": []
    },
    "score_breakdown": {
      "semantic_score": 0.78,
      "keyword_score": 0.67,
      "sentence_score": 0.80,
      "length_score": 0.90
    },
    "word_count_model": 120,
    "word_count_student": 98
  }
}
```
