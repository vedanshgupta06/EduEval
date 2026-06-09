import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import FeedbackCard from '../components/FeedbackCard';
import { Save, RefreshCw, ArrowLeft, Clock, AlertCircle } from 'lucide-react';

function getExtractedText(aiFeedback) {
  const feedback = aiFeedback?.feedback || aiFeedback;
  if (feedback?.not_evaluated) {
    return feedback?.extracted_student_answer || '';
  }
  return (
    feedback?.extracted_student_answer ||
    feedback?.extracted_full_answer_sheet ||
    ''
  );
}

function getFeedback(aiFeedback) {
  return aiFeedback?.feedback || aiFeedback || {};
}

export default function SubmissionReviewPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [exam, setExam] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [questionEvals, setQuestionEvals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [startingEvaluation, setStartingEvaluation] = useState(false);
  const [marks, setMarks] = useState('');
  const [comment, setComment] = useState('');
  const [qOverrides, setQOverrides] = useState({});
  const autoStartAttempted = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const subRes = await api.get(`/api/submissions/${submissionId}`);
      const examRes = await api.get(`/api/exams/${subRes.data.examId}`);

      setSubmission(subRes.data);
      setExam(examRes.data);
      setStartingEvaluation(false);

      if (examRes.data.isMultiQuestion) {
        const qeRes = await api.get(`/api/submissions/${submissionId}/question-evaluations`);
        const init = {};

        qeRes.data.forEach((q) => {
          init[q.questionSubmissionId] = {
            marks: q.teacherMarks ?? '',
            comment: q.teacherComment ?? '',
            saving: false,
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

      setSubmission((current) => current ? { ...current, status: 'PROCESSING' } : current);
      toast.success('Evaluation started. Check back in a moment');
      setTimeout(fetchData, 3000);
    } catch {
      setStartingEvaluation(false);
      toast.error('Failed to start evaluation');
    } finally {
      setReEvaluating(false);
    }
  }, [evaluation, fetchData, submissionId]);

  const hasAiResult = Boolean(evaluation?.aiFeedbackJson && evaluation?.aiMarks != null);
  const isMulti = Boolean(exam?.isMultiQuestion);
  const isProcessing = !isMulti && (submission?.status === 'PROCESSING' || startingEvaluation);

  useEffect(() => {
    if (
      loading ||
      isMulti ||
      autoStartAttempted.current ||
      !submission ||
      hasAiResult ||
      submission.status !== 'PENDING'
    ) {
      return;
    }

    autoStartAttempted.current = true;
    triggerReEvaluation();
  }, [hasAiResult, isMulti, loading, submission, triggerReEvaluation]);

  const saveReview = async () => {
    if (marks === '' || isNaN(marks)) return toast.error('Enter valid marks');
    const totalMarks = submission?.totalMarks || evaluation?.totalMarks || 100;

    if (parseFloat(marks) > totalMarks) {
      return toast.error(`Marks cannot exceed ${totalMarks}`);
    }

    if (!evaluation?.id) return toast.error('Start AI evaluation before saving review');

    setSaving(true);
    try {
      await api.patch(`/api/teacher/evaluations/${evaluation.id}/review`, {
        marks: parseFloat(marks),
        comment,
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
    setQOverrides((prev) => ({
      ...prev,
      [qsId]: { ...prev[qsId], [field]: value },
    }));
  };

  const saveQuestionOverride = async (qsId, maxMarks) => {
    const override = qOverrides[qsId];
    if (override.marks === '' || isNaN(override.marks)) return toast.error('Enter valid marks');
    if (parseFloat(override.marks) > maxMarks) {
      return toast.error(`Marks cannot exceed ${maxMarks}`);
    }

    setQOverrides((prev) => ({
      ...prev,
      [qsId]: { ...prev[qsId], saving: true },
    }));

    try {
      await api.patch(`/api/teacher/question-submissions/${qsId}/review`, {
        teacherMarks: parseFloat(override.marks),
        teacherComment: override.comment,
      });
      toast.success('Override saved!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save override');
    } finally {
      setQOverrides((prev) => ({
        ...prev,
        [qsId]: { ...prev[qsId], saving: false },
      }));
    }
  };

  const openFile = async (fileUrl, errorMessage) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:8080/api/files/${fileUrl}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      toast.error(errorMessage);
    }
  };

  if (loading) return <div className="loading">Loading review...</div>;
  if (!submission) return <div className="error">Submission not found</div>;

  const totalMarks = submission.totalMarks || evaluation?.totalMarks || exam?.totalMarks;
  const multiEffective = questionEvals.reduce(
    (sum, q) => sum + (q.effectiveMarks ?? q.teacherMarks ?? q.aiMarks ?? 0),
    0
  );

  return (
    <div className="page">
      <button className="btn-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="page-header">
        <div>
          <h2>{isMulti ? 'Question Review' : 'Evaluation'} - {submission.studentName}</h2>
          <p className="page-subtitle">
            {submission.examTitle} - Submitted{' '}
            {new Date(submission.submittedAt).toLocaleDateString('en-IN')}
          </p>
        </div>

        {!isMulti && (
          <button
            className="btn-secondary"
            onClick={triggerReEvaluation}
            disabled={reEvaluating}
          >
            <RefreshCw size={14} className={reEvaluating ? 'spin' : ''} />
            {reEvaluating ? 'Loading...' : hasAiResult ? 'Re-evaluate' : 'Start Evaluation'}
          </button>
        )}
      </div>

      {!isMulti && (
        <div className="review-layout">
          <div className="review-left">
            <h3>AI Evaluation</h3>
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
                    <p>
                      The backend has sent this answer sheet to the Python AI service.
                      This page refreshes automatically while it is processing.
                    </p>
                  </>
                ) : (
                  <>
                    <AlertCircle size={40} className="icon-orange" />
                    <h4>No AI result yet</h4>
                    <p>
                      The first evaluation did not finish or the AI service was unavailable.
                      Start evaluation again after the Python service is running on port 8000.
                    </p>
                    <button
                      className="btn-primary"
                      onClick={triggerReEvaluation}
                      disabled={reEvaluating}
                    >
                      <RefreshCw size={14} className={reEvaluating ? 'spin' : ''} />
                      {reEvaluating ? 'Loading...' : 'Start Evaluation'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="review-right">
            <div className="card override-card">
              <h3>Teacher Override</h3>
              <p className="field-hint">The AI mark is a suggestion. Adjust if needed.</p>

              <div className="form-group">
                <label>Marks Awarded <span className="total-marks">/ {totalMarks}</span></label>
                <input
                  type="number"
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  min={0}
                  max={totalMarks}
                  step={0.5}
                  disabled={!hasAiResult}
                />
                {evaluation?.aiMarks != null && (
                  <p className="field-hint">AI suggested: {evaluation.aiMarks.toFixed(1)}</p>
                )}
              </div>

              <div className="form-group">
                <label>Comment <span className="optional">(optional)</span></label>
                <textarea
                  placeholder="Add feedback for the student..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  disabled={!hasAiResult}
                />
              </div>

              <button
                className="btn-primary full-width"
                onClick={saveReview}
                disabled={saving || !hasAiResult}
              >
                <Save size={15} />
                {saving ? 'Saving...' : evaluation?.isReviewed ? 'Update Review' : 'Save Review'}
              </button>

              {evaluation?.isReviewed && (
                <p className="reviewed-note">
                  Reviewed by {evaluation.reviewedBy} on{' '}
                  {new Date(evaluation.reviewedAt).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>

            <div className="card" style={{ marginTop: '1rem' }}>
              <h3>Answer Sheet</h3>
              <button
                className="btn-secondary full-width"
                onClick={() => openFile(submission.fileUrl, 'Could not open answer sheet')}
              >
                Open Answer Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {isMulti && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Total Score</h3>
                <p className="field-hint">Aggregate of all question marks</p>
              </div>
              <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4f46e5' }}>
                {multiEffective.toFixed(1)} / {exam?.totalMarks ?? totalMarks}
              </span>
            </div>
          </div>

          {questionEvals.map((qe) => {
            const feedback = getFeedback(qe.aiFeedback);
            const notEvaluated = Boolean(feedback.not_evaluated);
            const override = qOverrides[qe.questionSubmissionId] || {};
            const effective = qe.effectiveMarks ?? qe.teacherMarks ?? qe.aiMarks ?? 0;
            const extractedText = getExtractedText(qe.aiFeedback);

            return (
              <div
                key={qe.questionSubmissionId}
                className="card"
                style={{ marginBottom: '1rem', padding: '1.25rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <strong style={{ color: '#4f46e5' }}>Q{qe.questionNo}</strong>
                    <span className="field-hint" style={{ marginLeft: '0.5rem' }}>{qe.maxMarks} marks</span>
                    {qe.status === 'REVIEWED' && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#dcfce7', color: '#16a34a', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                        Reviewed
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                    {notEvaluated ? 'Not evaluated' : `${effective.toFixed(1)} / ${qe.maxMarks}`}
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: '0.75rem' }}>
                  {qe.questionText}
                </p>

                {qe.fileUrl && (
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', marginBottom: '0.75rem' }}
                    onClick={() => openFile(qe.fileUrl, 'Could not open answer file')}
                  >
                    View Answer
                  </button>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                  <span>AI Marks: <strong>{notEvaluated ? 'Not evaluated' : (qe.aiMarks?.toFixed(1) ?? '-')}</strong></span>
                  <span>
                    Confidence:{' '}
                    <strong>
                      {qe.aiConfidence != null ? `${Math.round(qe.aiConfidence * 100)}%` : '-'}
                    </strong>
                  </span>
                  {qe.teacherMarks != null && (
                    <span>Teacher: <strong>{qe.teacherMarks.toFixed(1)}</strong></span>
                  )}
                </div>

                {qe.aiFeedback && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    {(qe.aiFeedback.matched_keywords || []).map((keyword, index) => (
                      <span
                        key={`matched-${index}`}
                        style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '999px', marginRight: '0.3rem', display: 'inline-block', marginBottom: '0.3rem' }}
                      >
                        + {keyword}
                      </span>
                    ))}
                    {(qe.aiFeedback.missed_keywords || []).map((keyword, index) => (
                      <span
                        key={`missed-${index}`}
                        style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '999px', marginRight: '0.3rem', display: 'inline-block', marginBottom: '0.3rem' }}
                      >
                        - {keyword}
                      </span>
                    ))}
                  </div>
                )}

                {extractedText && (
                  <div className="feedback-section extracted-answer" style={{ marginBottom: '0.75rem' }}>
                    <h4>Text Extracted From Image</h4>
                    <p>{extractedText}</p>
                  </div>
                )}

                {notEvaluated && !extractedText && (
                  <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
                    {feedback.error || 'No answer was detected for this question.'}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    value={override.marks ?? ''}
                    onChange={(e) => updateQOverride(qe.questionSubmissionId, 'marks', e.target.value)}
                    min={0}
                    max={qe.maxMarks}
                    step={0.5}
                    placeholder="Marks"
                    style={{ width: '90px' }}
                  />
                  <input
                    type="text"
                    value={override.comment ?? ''}
                    onChange={(e) => updateQOverride(qe.questionSubmissionId, 'comment', e.target.value)}
                    placeholder="Override comment (optional)"
                    style={{ flex: 1, minWidth: '160px' }}
                  />
                  <button
                    className="btn-primary"
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    disabled={override.saving || override.marks === ''}
                    onClick={() => saveQuestionOverride(qe.questionSubmissionId, qe.maxMarks)}
                  >
                    <Save size={13} />
                    {override.saving ? 'Saving...' : 'Override'}
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
