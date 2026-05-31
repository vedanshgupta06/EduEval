from pydantic import BaseModel
from typing import Optional, List


class EvaluateRequest(BaseModel):
    submission_id: str
    file_url: str           # relative path e.g. submissions/examId/uuid.pdf
    model_answer_url: str   # optional — path to model answer file
    model_answer_text: str  # optional — typed model answer text
    total_marks: int


class KeywordAnalysis(BaseModel):
    covered: List[str]
    missing: List[str]
    coverage_score: float   # 0.0 – 1.0


class SentenceAnalysis(BaseModel):
    missing_points: List[str]       # model sentences not addressed
    additional_content: List[str]   # student sentences with no model match


class ScoreBreakdown(BaseModel):
    semantic_score: float
    keyword_score: float
    sentence_score: float
    length_score: float


class FeedbackDetail(BaseModel):
    keyword_analysis: KeywordAnalysis
    sentence_analysis: SentenceAnalysis
    score_breakdown: ScoreBreakdown
    word_count_model: int
    word_count_student: int


class EvaluateResponse(BaseModel):
    submission_id: str
    ai_marks: float
    ai_confidence: float        # 0.0 – 1.0
    feedback: FeedbackDetail    # structured — parsed by Spring Boot via Jackson
