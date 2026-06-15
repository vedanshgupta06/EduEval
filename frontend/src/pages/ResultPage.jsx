import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import FeedbackCard from '../components/FeedbackCard';
import { ArrowLeft, Clock, CheckCircle2, XCircle } from 'lucide-react';

/* ── helpers ───────────────────────────────────────────────────────────────── */

function getExtractedText(aiFeedback) {
  const feedback = aiFeedback?.feedback || aiFeedback;
  if (feedback?.not_evaluated) return feedback?.extracted_student_answer || '';
  return feedback?.extracted_student_answer || feedback?.extracted_full_answer_sheet || '';
}

function getFeedback(aiFeedback) {
  return aiFeedback?.feedback || aiFeedback || {};
}

function getGrade(pct) {
  if (pct >= 90) return { label: 'A+', bg: '#dcfce7', color: '#15803d' };
  if (pct >= 80) return { label: 'A',  bg: '#dcfce7', color: '#15803d' };
  if (pct >= 70) return { label: 'B+', bg: '#dcfce7', color: '#15803d' };
  if (pct >= 60) return { label: 'B',  bg: '#fef9c3', color: '#a16207' };
  if (pct >= 50) return { label: 'C',  bg: '#fef9c3', color: '#a16207' };
  return               { label: 'F',  bg: '#fee2e2', color: '#b91c1c' };
}

function ScoreBar({ label, value }) {
  const pct = Math.round(value * 100);
  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="score-bar-value">{pct}%</span>
    </div>
  );
}

/* ── main component ────────────────────────────────────────────────────────── */

export default function ResultPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission]   = useState(null);
  const [exam, setExam]               = useState(null);
  const [evaluation, setEvaluation]   = useState(null);
  const [questionEvals, setQuestionEvals] = useState([]);
  const [loading, setLoading]         = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const subRes = await api.get(`/api/submissions/${submissionId}`);
      setSubmission(subRes.data);

      const examRes = await api.get(`/api/exams/${subRes.data.examId}`);
      setExam(examRes.data);

      if (examRes.data.isMultiQuestion) {
        const qeRes = await api.get(`/api/submissions/${submissionId}/question-evaluations`);
        setQuestionEvals(qeRes.data);
      } else {
        const evalRes = await api.get(`/api/evaluations/${submissionId}`);
        setEvaluation(evalRes.data);
      }
    } catch {
      toast.error('Failed to load result');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading">Loading result...</div>;

  const isMulti = exam?.isMultiQuestion;

  /* processing state */
  const isProcessing =
    submission?.status === 'PENDING' || submission?.status === 'PROCESSING';

  if (
    isProcessing ||
    (!isMulti && !evaluation) ||
    (isMulti && questionEvals.length === 0)
  ) {
    return (
      <div className="page">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="processing-state">
          <Clock size={48} className="spin" />
          <h3>Evaluation in progress…</h3>
          <p>Your answer sheet has been submitted. The AI is evaluating it now.</p>
          <p>Your teacher will review the result shortly.</p>
          <button className="btn-primary" onClick={fetchData}>Refresh</button>
        </div>
      </div>
    );
  }

  /* score maths */
  const multiEffective = questionEvals.reduce(
    (s, q) => s + (q.effectiveMarks ?? q.aiMarks ?? 0), 0
  );
  const multiAi = questionEvals.reduce((s, q) => s + (q.aiMarks ?? 0), 0);
  const totalMax = exam?.totalMarks || 0;

  const mainScore = isMulti
    ? multiEffective
    : (evaluation?.teacherMarks ?? evaluation?.aiMarks ?? 0);

  const pct   = totalMax > 0 ? Math.round((mainScore / totalMax) * 100) : 0;
  const grade = getGrade(pct);

  /* single-question feedback data */
  const fb         = evaluation?.aiFeedbackJson || {};
  const scores     = fb.scores || {};
  const keywords   = fb.keyword_analysis || {};
  const covered    = keywords.matched_keywords || [];
  const missing    = keywords.missing_keywords || [];
  const missingFb  = fb.missing_points || [];
  const extraFb    = fb.additional_points || [];
  const extracted  = fb.extracted_student_answer || fb.extracted_full_answer_sheet || '';
  const confidence = evaluation?.aiConfidence;

  return (
    <div className="page">

      {/* ── back + title ── */}
      <div>
        <button className="btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="page-header" style={{ marginTop: '0.5rem' }}>
          <div>
            <h2>{submission?.examTitle}</h2>
            <p className="page-subtitle">
              {submission?.classroomName} · Submitted{' '}
              {new Date(submission?.submittedAt).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* ── notice (only if not yet reviewed) ── */}
      {!evaluation?.isReviewed && !isMulti && (
        <div className="card notice-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <Clock size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>AI evaluation shown below. Your teacher will review and may adjust the marks.</span>
        </div>
      )}

      {/* ── teacher comment ── */}
      {!isMulti && evaluation?.teacherComment && (
        <div className="card teacher-comment-card">
          <h4>Teacher feedback</h4>
          <p style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>{evaluation.teacherComment}</p>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SCORE HERO CARD
      ════════════════════════════════════════════ */}
      <div className="card">
        {/* grade + main number */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            background: grade.bg, color: grade.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem', fontWeight: 700,
          }}>
            {grade.label}
          </div>

          <div style={{ flex: 1 }}>
            <p className="page-subtitle" style={{ marginBottom: '0.15rem' }}>Final score</p>
            <p style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: 'var(--gray-800)' }}>
              {mainScore.toFixed(1)}
              <span style={{ fontSize: '1.1rem', fontWeight: 400, color: 'var(--gray-400)', marginLeft: 4 }}>
                / {totalMax}
              </span>
            </p>
            <p className="page-subtitle" style={{ marginTop: '0.2rem' }}>{pct}%</p>

            {/* status badges */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
              {evaluation?.isReviewed ? (
                <span className="deadline-badge active">Teacher reviewed</span>
              ) : (
                <span className="deadline-badge past">Pending review</span>
              )}
              {confidence && (
                <span
                  className="deadline-badge"
                  style={{
                    background: confidence === 'HIGH' ? '#dcfce7'
                      : confidence === 'MEDIUM' ? '#fef9c3' : '#fee2e2',
                    color: confidence === 'HIGH' ? '#15803d'
                      : confidence === 'MEDIUM' ? '#a16207' : '#b91c1c',
                  }}
                >
                  Confidence: {confidence.toLowerCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* AI vs Teacher split */}
        {!isMulti && evaluation && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', margin: '1rem 0' }} />
            <div className="dual-marks">
              <div className="dual-mark-item">
                <span>AI marks</span>
                <strong>
                  {evaluation.aiMarks?.toFixed(1) ?? '—'}
                  <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--gray-400)' }}>
                    {' '}/ {evaluation.totalMarks}
                  </span>
                </strong>
              </div>
              <div className="dual-mark-item">
                <span>Teacher marks</span>
                <strong>
                  {evaluation.teacherMarks != null
                    ? `${evaluation.teacherMarks.toFixed(1)}`
                    : '—'}
                  <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--gray-400)' }}>
                    {evaluation.teacherMarks != null ? ` / ${evaluation.totalMarks}` : ''}
                  </span>
                </strong>
              </div>
            </div>
          </>
        )}

        {/* multi-question adjustment note */}
        {isMulti && multiAi !== multiEffective && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', margin: '1rem 0' }} />
            <p className="field-hint" style={{ textAlign: 'center' }}>
              AI awarded {multiAi.toFixed(1)} · Teacher adjusted to {multiEffective.toFixed(1)}
            </p>
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════
          SINGLE QUESTION MODE
      ════════════════════════════════════════════ */}
      {!isMulti && evaluation && (
        <>
          {/* Score breakdown bars */}
          {Object.keys(scores).length > 0 && (
            <div className="card feedback-card">
              <div className="feedback-section">
                <h4>Score breakdown</h4>
                <div className="score-bars" style={{ marginTop: '0.75rem' }}>
                  {Object.entries(scores).map(([key, val]) => (
                    <ScoreBar key={key} label={key} value={val} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Keyword analysis */}
          {(covered.length > 0 || missing.length > 0) && (
            <div className="card feedback-card">
              <div className="feedback-section">
                <h4>Keyword analysis</h4>
                <div className="keyword-grid" style={{ marginTop: '0.75rem' }}>
                  <div className="keyword-col">
                    <p className="keyword-col-title covered">
                      <CheckCircle2 size={14} /> Covered
                    </p>
                    {covered.map((kw, i) => (
                      <span key={i} className="keyword-tag covered">{kw}</span>
                    ))}
                    {covered.length === 0 && (
                      <p className="field-hint">None detected</p>
                    )}
                  </div>
                  <div className="keyword-col">
                    <p className="keyword-col-title missing">
                      <XCircle size={14} /> Missing
                    </p>
                    {missing.map((kw, i) => (
                      <span key={i} className="keyword-tag missing">{kw}</span>
                    ))}
                    {missing.length === 0 && (
                      <p className="field-hint">Nothing missing</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback points */}
          {(missingFb.length > 0 || extraFb.length > 0) && (
            <div className="card feedback-card">
              <div className="feedback-section">
                <h4>Feedback</h4>
                {missingFb.length > 0 && (
                  <ul className="feedback-list missing" style={{ marginTop: '0.75rem' }}>
                    {missingFb.map((pt, i) => <li key={i}>{pt}</li>)}
                  </ul>
                )}
                {extraFb.length > 0 && (
                  <ul className="feedback-list additional" style={{ marginTop: '0.5rem' }}>
                    {extraFb.map((pt, i) => <li key={i}>{pt}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Extracted answer */}
          {extracted && (
            <div className="card feedback-card">
              <div className="feedback-section">
                <h4>Extracted answer text</h4>
                <p className="field-hint" style={{ marginBottom: '0.5rem' }}>
                  Text extracted from your uploaded answer sheet
                </p>
                <div className="extracted-answer">
                  <p>{extracted}</p>
                </div>
                {fb.word_count != null && (
                  <p className="field-hint" style={{ marginTop: '0.5rem' }}>
                    Word count: {fb.word_count}
                    {fb.model_answer_word_count
                      ? ` · Model answer: ${fb.model_answer_word_count} words`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Fallback: raw FeedbackCard if structured data unavailable */}
          {Object.keys(scores).length === 0 && covered.length === 0 && (
            <FeedbackCard
              feedbackJson={evaluation.aiFeedbackJson}
              aiMarks={evaluation.aiMarks}
              teacherMarks={evaluation.teacherMarks}
              totalMarks={evaluation.totalMarks}
              confidence={evaluation.aiConfidence}
            />
          )}
        </>
      )}

      {/* ════════════════════════════════════════════
          MULTI-QUESTION MODE
      ════════════════════════════════════════════ */}
      {isMulti && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questionEvals.map((qe) => {
            const feedback      = getFeedback(qe.aiFeedback);
            const notEvaluated  = Boolean(feedback.not_evaluated);
            const effective     = qe.effectiveMarks ?? qe.aiMarks ?? 0;
            const extractedText = getExtractedText(qe.aiFeedback);
            const qPct          = qe.maxMarks > 0
              ? Math.round((effective / qe.maxMarks) * 100)
              : 0;
            const qGrade        = getGrade(qPct);

            return (
              <div key={qe.questionSubmissionId} className="card">
                {/* question header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Q{qe.questionNo}</span>
                    <span className="field-hint" style={{ marginLeft: '0.5rem' }}>
                      {qe.maxMarks} marks
                    </span>
                  </div>
                  {!notEvaluated && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        className="deadline-badge"
                        style={{ background: qGrade.bg, color: qGrade.color }}
                      >
                        {qPct}%
                      </span>
                      <span style={{ fontWeight: 700 }}>
                        {effective.toFixed(1)} / {qe.maxMarks}
                      </span>
                    </div>
                  )}
                </div>

                {/* question text */}
                <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  {qe.questionText}
                </p>

                <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', marginBottom: '0.75rem' }} />

                {/* extracted / not evaluated */}
                {extractedText ? (
                  <div className="feedback-section extracted-answer">
                    <h4 style={{ marginBottom: '0.4rem' }}>Extracted answer</h4>
                    <p>{extractedText}</p>
                  </div>
                ) : notEvaluated ? (
                  <p className="field-hint">
                    {feedback.error || 'No answer was detected for this question.'}
                  </p>
                ) : (
                  <p className="field-hint">No extracted text available yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}