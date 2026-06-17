import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import FeedbackCard from '../components/FeedbackCard';
import { Save, RefreshCw, ArrowLeft, Clock, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

function getExtractedText(aiFeedback) {
  const feedback = aiFeedback?.feedback || aiFeedback;
  if (feedback?.not_evaluated) return feedback?.extracted_student_answer || '';
  return feedback?.extracted_student_answer || feedback?.extracted_full_answer_sheet || '';
}

function getFeedback(aiFeedback) {
  return aiFeedback?.feedback || aiFeedback || {};
}

function getPct(marks, max) {
  if (marks == null || !max) return null;
  return Math.round((marks / max) * 100);
}

function ScorePill({ marks, max }) {
  const pct = getPct(marks, max);
  if (pct == null) return null;
  const cls = pct >= 75 ? 'deadline-badge active'
    : pct >= 50 ? 'deadline-badge'
    : 'deadline-badge past';
  const style = pct >= 50 && pct < 75 ? { background: '#fef9c3', color: '#a16207' } : {};
  return <span className={cls} style={style}>{pct}%</span>;
}

export default function SubmissionReviewPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission]         = useState(null);
  const [exam, setExam]                     = useState(null);
  const [evaluation, setEvaluation]         = useState(null);
  const [questionEvals, setQuestionEvals]   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [savingAll, setSavingAll]           = useState(false);
  const [reEvaluating, setReEvaluating]     = useState(false);
  const [startingEvaluation, setStartingEvaluation] = useState(false);
  const [marks, setMarks]                   = useState('');
  const [comment, setComment]               = useState('');
  const [qOverrides, setQOverrides]         = useState({});
  const autoStartAttempted                  = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const subRes  = await api.get(`/api/submissions/${submissionId}`);
      const examRes = await api.get(`/api/exams/${subRes.data.examId}`);
      setSubmission(subRes.data);
      setExam(examRes.data);
      setStartingEvaluation(false);

      if (examRes.data.isMultiQuestion) {
        const qeRes = await api.get(`/api/submissions/${submissionId}/question-evaluations`);
        console.log('question eval fields:', qeRes.data[0]); 
        const init = {};
        qeRes.data.forEach((q) => {
          init[q.questionSubmissionId] = {
            marks:   q.teacherMarks ?? q.aiMarks ?? '',
            comment: q.teacherComment ?? '',
            saving:  false,
          };
        });
        setEvaluation(null);
        setQuestionEvals(qeRes.data);
        setQOverrides(init);
        return;
      }

      setQuestionEvals([]);
      setQOverrides({});
      let evalRes = null;
      try {
        evalRes = await api.get(`/api/evaluations/${submissionId}`);
      } catch (err) {
        if (err.response?.status !== 404) throw err;
      }
      setEvaluation(evalRes?.data || null);
      if (evalRes?.data?.teacherMarks != null) {
        setMarks(evalRes.data.teacherMarks);
        setComment(evalRes.data.teacherComment || '');
      } else if (evalRes?.data?.aiMarks != null) {
        setMarks(evalRes.data.aiMarks);
      }
    } catch {
      toast.error('Failed to load submission');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (exam?.isMultiQuestion || submission?.status !== 'PROCESSING') return undefined;
    const timer = setInterval(fetchData, 5000);
    return () => clearInterval(timer);
  }, [exam?.isMultiQuestion, fetchData, submission?.status]);

  const triggerReEvaluation = useCallback(async () => {
    setReEvaluating(true);
    setStartingEvaluation(true);
    try {
      if (evaluation?.id) {
        await api.post(`/api/teacher/evaluations/${evaluation.id}/re-evaluate`);
      } else {
        await api.post(`/api/teacher/submissions/${submissionId}/evaluate`);
      }
      setSubmission((c) => c ? { ...c, status: 'PROCESSING' } : c);
      toast.success('Evaluation started. Check back in a moment');
      setTimeout(fetchData, 3000);
    } catch {
      setStartingEvaluation(false);
      toast.error('Failed to start evaluation');
    } finally {
      setReEvaluating(false);
    }
  }, [evaluation, fetchData, submissionId]);

  const hasAiResult  = Boolean(evaluation?.aiFeedbackJson && evaluation?.aiMarks != null);
  const isMulti      = Boolean(exam?.isMultiQuestion);
  const isProcessing = !isMulti && (submission?.status === 'PROCESSING' || startingEvaluation);

  useEffect(() => {
    if (loading || isMulti || autoStartAttempted.current || !submission || hasAiResult || submission.status !== 'PENDING') return;
    autoStartAttempted.current = true;
    triggerReEvaluation();
  }, [hasAiResult, isMulti, loading, submission, triggerReEvaluation]);

  const saveReview = async () => {
    if (marks === '' || isNaN(marks)) return toast.error('Enter valid marks');
    const totalMarks = submission?.totalMarks || evaluation?.totalMarks || 100;
    if (parseFloat(marks) > totalMarks) return toast.error(`Marks cannot exceed ${totalMarks}`);
    if (!evaluation?.id) return toast.error('Start AI evaluation before saving review');
    setSaving(true);
    try {
      await api.patch(`/api/teacher/evaluations/${evaluation.id}/review`, {
        marks: parseFloat(marks), comment,
      });
      toast.success('Review saved!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  const updateQOverride = (qsId, field, value) => {
    setQOverrides((prev) => ({ ...prev, [qsId]: { ...prev[qsId], [field]: value } }));
  };

  const saveQuestionOverride = async (qsId, maxMarks) => {
    const override = qOverrides[qsId];
    if (override.marks === '' || isNaN(override.marks)) return toast.error('Enter valid marks');
    console.log('sending patch:', qsId, {
    teacherMarks: parseFloat(override.marks),
    teacherComment: override.comment,
  });
    if (parseFloat(override.marks) > maxMarks) return toast.error(`Marks cannot exceed ${maxMarks}`);
    setQOverrides((prev) => ({ ...prev, [qsId]: { ...prev[qsId], saving: true } }));
    try {
      await api.patch(`/api/teacher/question-submissions/${qsId}/review`, {
        teacherMarks: parseFloat(override.marks),
        teacherComment: override.comment,
      });
      toast.success('Saved!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save override');
    } finally {
      setQOverrides((prev) => ({ ...prev, [qsId]: { ...prev[qsId], saving: false } }));
    }
  };

  // Save all question overrides at once
  const saveAllOverrides = async () => {
    const entries = questionEvals.map((qe) => ({
      qsId: qe.questionSubmissionId,
      maxMarks: qe.maxMarks,
      override: qOverrides[qe.questionSubmissionId] || {},
    }));

    for (const { override, maxMarks } of entries) {
      if (override.marks !== '' && (isNaN(override.marks) || parseFloat(override.marks) > maxMarks)) {
        return toast.error(`One or more marks values are invalid`);
      }
    }

    setSavingAll(true);
    try {
      await Promise.all(
        entries
          .filter(({ override }) => override.marks !== '')
          .map(({ qsId, override }) =>
            api.patch(`/api/teacher/question-submissions/${qsId}/review`, {
              teacherMarks: parseFloat(override.marks),
              teacherComment: override.comment,
            })
          )
      );
      toast.success('All overrides saved!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save some overrides');
    } finally {
      setSavingAll(false);
    }
  };

  const openFile = async (fileUrl, errorMessage) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:8080/api/files/${fileUrl}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      toast.error(errorMessage);
    }
  };

  if (loading)     return <div className="loading">Loading review...</div>;
  if (!submission) return <div className="error">Submission not found</div>;

  const totalMarks     = submission.totalMarks || evaluation?.totalMarks || exam?.totalMarks;
  const multiEffective = questionEvals.reduce(
    (sum, q) => sum + (q.effectiveMarks ?? q.teacherMarks ?? q.aiMarks ?? 0), 0
  );
  const multiMax = exam?.totalMarks ?? totalMarks;
  const multiPct = multiMax > 0 ? Math.round((multiEffective / multiMax) * 100) : null;

  return (
    <div className="page">
      <button className="btn-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={15} /> Back
      </button>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h2>{submission.studentName}</h2>
          <p className="page-subtitle">
            {submission.examTitle} · Submitted{' '}
            {new Date(submission.submittedAt).toLocaleDateString('en-IN')}
          </p>
        </div>
        {!isMulti && (
          <button className="btn-secondary" onClick={triggerReEvaluation} disabled={reEvaluating}>
            <RefreshCw size={14} className={reEvaluating ? 'spin' : ''} />
            {reEvaluating ? 'Loading…' : hasAiResult ? 'Re-evaluate' : 'Start Evaluation'}
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════
          SINGLE QUESTION MODE
      ══════════════════════════════════════════ */}
      {!isMulti && (
        <div className="review-layout">
          <div className="review-left">
            <h3 style={{ marginBottom: '1rem' }}>AI Evaluation</h3>
            {hasAiResult ? (
              <FeedbackCard
                feedbackJson={evaluation.aiFeedbackJson}
                aiMarks={evaluation.aiMarks}
                teacherMarks={evaluation.teacherMarks}
                totalMarks={totalMarks}
                confidence={evaluation.aiConfidence}
              />
            ) : (
              <div className="card evaluation-state-card">
                {isProcessing ? (
                  <>
                    <Clock size={40} className="spin icon-blue" />
                    <h4>Evaluation is running</h4>
                    <p>This page refreshes automatically while it is processing.</p>
                  </>
                ) : (
                  <>
                    <AlertCircle size={40} className="icon-orange" />
                    <h4>No AI result yet</h4>
                    <p>Start evaluation after the Python service is running on port 8000.</p>
                    <button className="btn-primary" onClick={triggerReEvaluation} disabled={reEvaluating}>
                      <RefreshCw size={14} className={reEvaluating ? 'spin' : ''} />
                      {reEvaluating ? 'Loading…' : 'Start Evaluation'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="review-right">
            <div className="card override-card">
              <h3>Teacher Override</h3>
              <p className="field-hint" style={{ marginBottom: '1rem' }}>The AI mark is a suggestion. Adjust if needed.</p>

              <div className="form-group">
                <label>Marks awarded <span className="total-marks">/ {totalMarks}</span></label>
                <input
                  type="number" value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  min={0} max={totalMarks} step={0.5}
                  disabled={!hasAiResult}
                />
                {evaluation?.aiMarks != null && (
                  <p className="field-hint">AI suggested: {evaluation.aiMarks.toFixed(1)}</p>
                )}
              </div>

              <div className="form-group">
                <label>Comment <span className="optional">(optional)</span></label>
                <textarea
                  placeholder="Add feedback for the student…"
                  value={comment} onChange={(e) => setComment(e.target.value)}
                  rows={4} disabled={!hasAiResult}
                />
              </div>

              <button className="btn-primary full-width" onClick={saveReview} disabled={saving || !hasAiResult}>
                <Save size={15} />
                {saving ? 'Saving…' : evaluation?.isReviewed ? 'Update Review' : 'Save Review'}
              </button>

              {evaluation?.isReviewed && (
                <p className="reviewed-note">
                  Reviewed by {evaluation.reviewedBy} on{' '}
                  {new Date(evaluation.reviewedAt).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>

            <div className="card" style={{ marginTop: '1rem' }}>
              <h3 style={{ marginBottom: '0.75rem' }}>Answer Sheet</h3>
              <button
                className="btn-secondary full-width"
                onClick={() => openFile(submission.fileUrl, 'Could not open answer sheet')}
              >
                <FileText size={14} /> Open Answer Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MULTI-QUESTION MODE
      ══════════════════════════════════════════ */}
      {isMulti && (
        <>
          {/* Total score + save-all bar */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {multiEffective.toFixed(1)}
                </span>
                <span style={{ fontSize: '1rem', color: 'var(--gray-400)' }}>/ {multiMax}</span>
                {multiPct != null && (
                  <ScorePill marks={multiEffective} max={multiMax} />
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {submission.fileUrl && (
                  <button
                    className="btn-secondary"
                    onClick={() => openFile(submission.fileUrl, 'Could not open answer sheet')}
                  >
                    <FileText size={14} /> Answer Sheet
                  </button>
                )}
                <button
                  className="btn-primary"
                  onClick={saveAllOverrides}
                  disabled={savingAll}
                >
                  <Save size={14} />
                  {savingAll ? 'Saving…' : 'Save All Overrides'}
                </button>
              </div>
            </div>
            <p className="field-hint" style={{ marginTop: '0.4rem' }}>
              {questionEvals.filter(q => q.status === 'REVIEWED').length} of {questionEvals.length} questions reviewed
            </p>
          </div>

          {/* Per-question cards */}
          {questionEvals.map((qe) => {
            const feedback     = getFeedback(qe.aiFeedback);
            const notEvaluated = Boolean(feedback.not_evaluated);
            const override     = qOverrides[qe.questionSubmissionId] || {};
            const effective    = qe.effectiveMarks ?? qe.teacherMarks ?? qe.aiMarks ?? 0;
            const extractedText = getExtractedText(qe.aiFeedback);
            const matched      = qe.aiFeedback?.matched_keywords || [];
            const missed       = qe.aiFeedback?.missed_keywords  || [];
            const isReviewed   = qe.status === 'REVIEWED';

            return (
              <div key={qe.questionSubmissionId} className="card" style={{ padding: '1.25rem' }}>

                {/* Question header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary, #0b83db)', fontSize: '1rem' }}>
                      Q{qe.questionNo}
                    </span>
                    <span className="field-hint">{qe.maxMarks} marks</span>
                    {isReviewed && (
                      <span className="deadline-badge active" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle2 size={11} /> Reviewed
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {!notEvaluated && <ScorePill marks={effective} max={qe.maxMarks} />}
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                      {notEvaluated ? '—' : `${effective.toFixed(1)} / ${qe.maxMarks}`}
                    </span>
                  </div>
                </div>

                {/* Question text */}
                <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginBottom: '0.75rem', lineHeight: 1.6 }}>
                  {qe.questionText}
                </p>

                <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', marginBottom: '0.75rem' }} />

                {/* AI marks row */}
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--gray-600)' }}>
                    AI marks:{' '}
                    <strong style={{ color: 'var(--gray-800)' }}>
                      {notEvaluated ? '—' : (qe.aiMarks?.toFixed(1) ?? '—')}
                    </strong>
                  </span>
                  <span style={{ color: 'var(--gray-600)' }}>
                    Confidence:{' '}
                    <strong style={{ color: 'var(--gray-800)' }}>
                      {qe.aiConfidence != null ? `${Math.round(qe.aiConfidence * 100)}%` : '—'}
                    </strong>
                  </span>
                  {qe.teacherMarks != null && (
                    <span style={{ color: 'var(--gray-600)' }}>
                      Teacher override:{' '}
                      <strong style={{ color: 'var(--primary)' }}>{qe.teacherMarks.toFixed(1)}</strong>
                    </span>
                  )}
                </div>

                {/* Keywords */}
                {(matched.length > 0 || missed.length > 0) && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    {matched.map((kw, i) => (
                      <span key={`m-${i}`} className="keyword-tag covered">{kw}</span>
                    ))}
                    {missed.map((kw, i) => (
                      <span key={`x-${i}`} className="keyword-tag missing">{kw}</span>
                    ))}
                  </div>
                )}

                {/* Extracted text */}
                {extractedText ? (
                  <div className="extracted-answer" style={{ marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.4rem' }}>
                      Extracted answer
                    </h4>
                    <p>{extractedText}</p>
                  </div>
                ) : notEvaluated ? (
                  <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
                    {feedback.error || 'No answer was detected for this question.'}
                  </p>
                ) : null}

                {/* Per-question answer file */}
                {qe.fileUrl && (
                  <button
                    className="btn-secondary btn-sm"
                    style={{ marginBottom: '0.75rem' }}
                    onClick={() => openFile(qe.fileUrl, 'Could not open answer file')}
                  >
                    <FileText size={13} /> View answer image
                  </button>
                )}

                {/* Override row */}
                <div style={{
                  display: 'flex', gap: '0.75rem', alignItems: 'center',
                  borderTop: '1px solid var(--gray-100)', paddingTop: '0.75rem', flexWrap: 'wrap',
                }}>
                  <div className="form-group" style={{ margin: 0, flex: '0 0 100px' }}>
                    <label style={{ fontSize: '0.78rem' }}>Override marks <span className="total-marks">/ {qe.maxMarks}</span></label>
                    <input
                      type="number"
                      value={override.marks ?? ''}
                      onChange={(e) => updateQOverride(qe.questionSubmissionId, 'marks', e.target.value)}
                      min={0} max={qe.maxMarks} step={0.5}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '160px' }}>
                    <label style={{ fontSize: '0.78rem' }}>Comment <span className="optional">(optional)</span></label>
                    <input
                      type="text"
                      value={override.comment ?? ''}
                      onChange={(e) => updateQOverride(qe.questionSubmissionId, 'comment', e.target.value)}
                      placeholder="Feedback for this question…"
                    />
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    style={{ marginTop: '1.2rem', flexShrink: 0 }}
                    disabled={override.saving || override.marks === ''}
                    onClick={() => saveQuestionOverride(qe.questionSubmissionId, qe.maxMarks)}
                  >
                    <Save size={13} />
                    {override.saving ? 'Saving…' : 'Save'}
                  </button>
                </div>

              </div>
            );
          })}

          {/* Sticky save-all footer */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)' }}>
              Total: <strong style={{ color: 'var(--primary)' }}>{multiEffective.toFixed(1)} / {multiMax}</strong>
              {multiPct != null && <span className="field-hint" style={{ marginLeft: 8 }}>{multiPct}%</span>}
            </p>
            <button className="btn-primary" onClick={saveAllOverrides} disabled={savingAll}>
              <Save size={14} />
              {savingAll ? 'Saving…' : 'Save All Overrides'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
