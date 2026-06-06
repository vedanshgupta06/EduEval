import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import FeedbackCard from '../components/FeedbackCard';
import { Save, RefreshCw, ArrowLeft } from 'lucide-react';

export default function SubmissionReviewPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [exam, setExam] = useState(null);
  const [evaluation, setEvaluation] = useState(null);         // single mode
  const [questionEvals, setQuestionEvals] = useState([]);     // multi mode
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);

  // Single override state
  const [marks, setMarks] = useState('');
  const [comment, setComment] = useState('');

  // Per-question override state: { [qsId]: { marks, comment, saving } }
  const [qOverrides, setQOverrides] = useState({});

  useEffect(() => { fetchData(); }, [submissionId]);

  const fetchData = async () => {
    try {
      const subRes = await api.get(`/api/submissions/${submissionId}`);
      setSubmission(subRes.data);

      const examRes = await api.get(`/api/exams/${subRes.data.examId}`);
      setExam(examRes.data);

      if (examRes.data.isMultiQuestion) {
        const qeRes = await api.get(`/api/submissions/${submissionId}/question-evaluations`);
        setQuestionEvals(qeRes.data);
        const init = {};
        qeRes.data.forEach(q => {
          init[q.questionSubmissionId] = {
            marks: q.teacherMarks ?? '',
            comment: q.teacherComment ?? '',
            saving: false,
          };
        });
        setQOverrides(init);
      } else {
        const evalRes = await api.get(`/api/evaluations/${submissionId}`);
        setEvaluation(evalRes.data);
        if (evalRes.data.teacherMarks != null) {
          setMarks(evalRes.data.teacherMarks);
          setComment(evalRes.data.teacherComment || '');
        } else if (evalRes.data.aiMarks != null) {
          setMarks(evalRes.data.aiMarks);
        }
      }
    } catch {
      toast.error('Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  // ── Single override ───────────────────────────────────────────────────────
  const saveReview = async () => {
    if (marks === '' || isNaN(marks)) return toast.error('Enter valid marks');
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

  const triggerReEvaluation = async () => {
    setReEvaluating(true);
    try {
      await api.post(`/api/teacher/evaluations/${evaluation.id}/re-evaluate`);
      toast.success('Re-evaluation triggered — check back in a moment');
      setTimeout(fetchData, 3000);
    } catch {
      toast.error('Failed to trigger re-evaluation');
    } finally {
      setReEvaluating(false);
    }
  };

  // ── Per-question override ─────────────────────────────────────────────────
  const updateQOverride = (qsId, field, value) =>
    setQOverrides(prev => ({ ...prev, [qsId]: { ...prev[qsId], [field]: value } }));

  const saveQuestionOverride = async (qsId, maxMarks) => {
    const ov = qOverrides[qsId];
    if (ov.marks === '' || isNaN(ov.marks)) return toast.error('Enter valid marks');
    if (parseFloat(ov.marks) > maxMarks) return toast.error(`Marks cannot exceed ${maxMarks}`);

    setQOverrides(prev => ({ ...prev, [qsId]: { ...prev[qsId], saving: true } }));
    try {
      await api.patch(`/api/teacher/question-submissions/${qsId}/review`, {
        teacherMarks: parseFloat(ov.marks),
        teacherComment: ov.comment,
      });
      toast.success('Override saved!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save override');
    } finally {
      setQOverrides(prev => ({ ...prev, [qsId]: { ...prev[qsId], saving: false } }));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div className="loading">Loading review...</div>;
  if (!submission) return <div className="error">Data not found</div>;

  const isMulti = exam?.isMultiQuestion;
  const totalMarks = submission.totalMarks || evaluation?.totalMarks;

  // Aggregate total for multi
  const multiEffective = questionEvals.reduce((s, q) =>
    s + (q.effectiveMarks ?? q.aiMarks ?? 0), 0);

  return (
    <div className="page">
      <button className="btn-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="page-header">
        <div>
          <h2>Review — {submission.studentName}</h2>
          <p className="page-subtitle">
            {submission.examTitle} · Submitted{' '}
            {new Date(submission.submittedAt).toLocaleDateString('en-IN')}
          </p>
        </div>
        {/* Re-evaluate button only for single-answer exams */}
        {!isMulti && evaluation && (
          <button
            className="btn-secondary"
            onClick={triggerReEvaluation}
            disabled={reEvaluating}
          >
            <RefreshCw size={14} />
            {reEvaluating ? 'Re-evaluating...' : 'Re-evaluate'}
          </button>
        )}
      </div>

      {/* ── SINGLE ANSWER MODE ──────────────────────────────────────────────── */}
      {!isMulti && evaluation && (
        <div className="review-layout">
          <div className="review-left">
            <h3>AI Evaluation</h3>
            <FeedbackCard
              feedbackJson={evaluation.aiFeedbackJson}
              aiMarks={evaluation.aiMarks}
              teacherMarks={evaluation.teacherMarks}
              totalMarks={totalMarks}
              confidence={evaluation.aiConfidence}
            />
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
                />
                {evaluation.aiMarks != null && (
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
                />
              </div>

              <button
                className="btn-primary full-width"
                onClick={saveReview}
                disabled={saving}
              >
                <Save size={15} />
                {saving ? 'Saving...' : evaluation.isReviewed ? 'Update Review' : 'Save Review'}
              </button>

              {evaluation.isReviewed && (
                <p className="reviewed-note">
                  ✓ Reviewed by {evaluation.reviewedBy} on{' '}
                  {new Date(evaluation.reviewedAt).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>

            <div className="card" style={{ marginTop: '1rem' }}>
              <h3>Answer Sheet</h3>
              <button
                className="btn-secondary full-width"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(
                      `http://localhost:8080/api/files/${submission.fileUrl}`,
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const blob = await res.blob();
                    window.open(URL.createObjectURL(blob), '_blank');
                  } catch {
                    toast.error('Could not open answer sheet');
                  }
                }}
              >
                Open Answer Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MULTI-QUESTION MODE ─────────────────────────────────────────────── */}
      {isMulti && (
        <>
          {/* Score summary card */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Total Score</h3>
                <p className="field-hint">Aggregate of all question marks</p>
              </div>
              <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4f46e5' }}>
                {multiEffective.toFixed(1)} / {exam?.totalMarks}
              </span>
            </div>
          </div>

          {/* Per-question cards */}
          {questionEvals.map((qe) => {
            const ov = qOverrides[qe.questionSubmissionId] || {};
            const effective = qe.effectiveMarks ?? qe.aiMarks ?? 0;

            return (
              <div key={qe.questionSubmissionId} className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <strong style={{ color: '#4f46e5' }}>Q{qe.questionNo}</strong>
                    <span className="field-hint" style={{ marginLeft: '0.5rem' }}>{qe.maxMarks} marks</span>
                    {qe.status === 'REVIEWED' && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#dcfce7', color: '#16a34a', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                        Reviewed
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                    {effective.toFixed(1)} / {qe.maxMarks}
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: '0.75rem' }}>
                  {qe.questionText}
                </p>
                {qe.fileUrl && (
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', marginBottom: '0.75rem' }}
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        const res = await fetch(
                          `http://localhost:8080/api/files/${qe.fileUrl}`,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        const blob = await res.blob();
                        window.open(URL.createObjectURL(blob), '_blank');
                      } catch {
                        toast.error('Could not open answer file');
                      }
                    }}
                  >
                    View Answer
                  </button>
                )}
                {/* AI scores */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  <span>AI Marks: <strong>{qe.aiMarks?.toFixed(1) ?? '—'}</strong></span>
                  <span>Confidence: <strong>{qe.aiConfidence != null ? Math.round(qe.aiConfidence * 100) + '%' : '—'}</strong></span>
                  {qe.teacherMarks != null && <span>Teacher: <strong>{qe.teacherMarks.toFixed(1)}</strong></span>}
                </div>

                {/* Feedback keywords */}
                {qe.aiFeedback && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    {(qe.aiFeedback.matched_keywords || []).map((k, i) => (
                      <span key={i} style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '999px', marginRight: '0.3rem' }}>✓ {k}</span>
                    ))}
                    {(qe.aiFeedback.missed_keywords || []).map((k, i) => (
                      <span key={i} style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '999px', marginRight: '0.3rem' }}>✗ {k}</span>
                    ))}
                  </div>
                )}

                {/* Override row */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    value={ov.marks}
                    onChange={(e) => updateQOverride(qe.questionSubmissionId, 'marks', e.target.value)}
                    min={0}
                    max={qe.maxMarks}
                    step={0.5}
                    placeholder="Marks"
                    style={{ width: '90px' }}
                  />
                  <input
                    type="text"
                    value={ov.comment}
                    onChange={(e) => updateQOverride(qe.questionSubmissionId, 'comment', e.target.value)}
                    placeholder="Override comment (optional)"
                    style={{ flex: 1, minWidth: '160px' }}
                  />
                  <button
                    className="btn-primary"
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    disabled={ov.saving || ov.marks === ''}
                    onClick={() => saveQuestionOverride(qe.questionSubmissionId, qe.maxMarks)}
                  >
                    <Save size={13} />
                    {ov.saving ? 'Saving...' : 'Override'}
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