import re
import numpy as np
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
from rapidfuzz import fuzz

from models import (
    KeywordAnalysis,
    SentenceAnalysis,
    ScoreBreakdown,
    FeedbackDetail,
)

# ── Model loading ─────────────────────────────────────────────────────────────

_sentence_model = None

def get_model() -> SentenceTransformer:
    global _sentence_model
    if _sentence_model is None:
        _sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _sentence_model


def ensure_nltk():
    for resource in ["stopwords", "wordnet", "punkt", "punkt_tab"]:
        nltk.download(resource, quiet=True)


# ── Preprocessing ─────────────────────────────────────────────────────────────

def preprocess(text: str) -> str:
    ensure_nltk()
    stop_words = set(stopwords.words("english"))
    lemmatizer = WordNetLemmatizer()

    text = text.lower()
    text = re.sub(r"[^a-z\s]", "", text)
    tokens = nltk.word_tokenize(text)
    tokens = [lemmatizer.lemmatize(w) for w in tokens if w not in stop_words]
    return " ".join(tokens)


# ── Keyword extraction ────────────────────────────────────────────────────────

def extract_keywords(preprocessed_text: str, top_n: int = 10) -> list[str]:
    if not preprocessed_text.strip():
        return []
    tfidf = TfidfVectorizer(ngram_range=(1, 2))
    matrix = tfidf.fit_transform([preprocessed_text])
    scores = matrix.toarray()[0]
    words = tfidf.get_feature_names_out()
    ranked = sorted(zip(words, scores), key=lambda x: x[1], reverse=True)
    return [w for w, _ in ranked[:top_n]]


# ── Keyword matching ──────────────────────────────────────────────────────────

def match_keywords(
    keywords: list[str], student_preprocessed: str
) -> KeywordAnalysis:
    if not keywords or not student_preprocessed.strip():
        return KeywordAnalysis(covered=[], missing=keywords, coverage_score=0.0)

    student_tokens = student_preprocessed.split()
    bigrams = [
        student_tokens[i] + " " + student_tokens[i + 1]
        for i in range(len(student_tokens) - 1)
    ]
    student_phrases = student_tokens + bigrams

    model = get_model()
    kw_embs = model.encode(keywords)
    phrase_embs = model.encode(student_phrases)
    sim_matrix = cosine_similarity(kw_embs, phrase_embs)

    covered, missing = [], []
    for i, kw in enumerate(keywords):
        best = float(np.max(sim_matrix[i]))
        # Also check fuzzy match for close misspellings
        fuzzy_hit = any(
            fuzz.partial_ratio(kw.lower(), p.lower()) > 80
            for p in student_phrases
        )
        if best > 0.65 or fuzzy_hit:
            covered.append(kw)
        else:
            missing.append(kw)

    score = len(covered) / len(keywords) if keywords else 0.0
    return KeywordAnalysis(covered=covered, missing=missing, coverage_score=score)


# ── Sentence analysis ─────────────────────────────────────────────────────────

def analyse_sentences(
    model_answer: str, student_answer: str
) -> tuple[SentenceAnalysis, float]:
    """
    Returns sentence analysis and a sentence coverage score (0-1).
    """
    ensure_nltk()
    model_sents = nltk.sent_tokenize(model_answer)
    student_sents = nltk.sent_tokenize(student_answer)

    if not model_sents or not student_sents:
        return SentenceAnalysis(missing_points=model_sents, additional_content=[]), 0.0

    model_embs = get_model().encode(model_sents)
    student_embs = get_model().encode(student_sents)
    sim_matrix = cosine_similarity(model_embs, student_embs)

    missing_points = [
        ms for i, ms in enumerate(model_sents)
        if float(np.max(sim_matrix[i])) < 0.60
    ]
    additional_content = [
        ss for j, ss in enumerate(student_sents)
        if float(np.max(sim_matrix[:, j])) < 0.60
    ]

    sentence_score = 1.0 - (len(missing_points) / len(model_sents))
    analysis = SentenceAnalysis(
        missing_points=missing_points,
        additional_content=additional_content,
    )
    return analysis, sentence_score


# ── Length score ──────────────────────────────────────────────────────────────

def length_score(student_words: int, model_words: int) -> float:
    if model_words == 0:
        return 0.0
    ratio = student_words / model_words
    if ratio >= 0.8:
        return 1.0
    elif ratio >= 0.4:
        return (ratio - 0.4) / 0.4
    return 0.0


# ── Confidence ────────────────────────────────────────────────────────────────

def compute_confidence(semantic: float, keyword: float, sentence: float) -> float:
    """
    High confidence when all three primary scores agree.
    Divergence = uncertainty = lower confidence.
    """
    std = float(np.std([semantic, keyword, sentence]))
    return round(max(0.0, 1.0 - (std * 3)), 3)


# ── Main evaluation entry point ───────────────────────────────────────────────

def evaluate(
    model_answer: str,
    student_answer: str,
    total_marks: int,
    semantic_w: float = 0.40,
    keyword_w: float  = 0.30,
    sentence_w: float = 0.20,
    length_w: float   = 0.10,
) -> tuple[float, float, FeedbackDetail]:
    """
    Returns (ai_marks, ai_confidence, feedback_detail).
    Weights are auto-normalised.
    """
    # Normalise weights
    total_w = semantic_w + keyword_w + sentence_w + length_w
    sw  = semantic_w / total_w
    kw  = keyword_w  / total_w
    snw = sentence_w / total_w
    lw  = length_w   / total_w

    model = get_model()

    # 1. Semantic similarity
    embs = model.encode([model_answer, student_answer])
    semantic = float(cosine_similarity([embs[0]], [embs[1]])[0][0])

    # 2. Keyword coverage
    clean_model   = preprocess(model_answer)
    clean_student = preprocess(student_answer)
    keywords      = extract_keywords(clean_model, top_n=10)
    kw_analysis   = match_keywords(keywords, clean_student)
    keyword_score_val = kw_analysis.coverage_score

    # 3. Sentence analysis
    sent_analysis, sentence_score_val = analyse_sentences(model_answer, student_answer)

    # 4. Length score
    model_words   = len(model_answer.split())
    student_words = len(student_answer.split())
    length_score_val = length_score(student_words, model_words)

    # 5. Final weighted score
    final_score = (
        sw  * semantic         +
        kw  * keyword_score_val +
        snw * sentence_score_val +
        lw  * length_score_val
    )
    ai_marks = round(final_score * total_marks, 2)

    # 6. Confidence
    confidence = compute_confidence(semantic, keyword_score_val, sentence_score_val)

    # 7. Feedback
    feedback = FeedbackDetail(
        keyword_analysis=kw_analysis,
        sentence_analysis=sent_analysis,
        score_breakdown=ScoreBreakdown(
            semantic_score=round(semantic, 3),
            keyword_score=round(keyword_score_val, 3),
            sentence_score=round(sentence_score_val, 3),
            length_score=round(length_score_val, 3),
        ),
        word_count_model=model_words,
        word_count_student=student_words,
    )

    return ai_marks, confidence, feedback
