// frontend/src/pages/TakeAssessmentPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAssessment, submitAssessment, getMySubmission } from '../api/assessments';

export default function TakeAssessmentPage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [mySubmission, setMySubmission] = useState(null);
  const [error, setError] = useState('');

  // answers: { [questionId]: string }
  // MCQ/MULTI_SELECT: JSON array string like "[2]" or "[0,2]"
  // DESCRIPTIVE: plain text
  const [answers, setAnswers] = useState({});

  // Timer
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  // ── Load assessment ───────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        // Check if already submitted
        try {
          const { data: sub } = await getMySubmission(assessmentId);
          setMySubmission(sub);
          setAlreadySubmitted(true);
          setLoading(false);
          return;
        } catch {
          // Not submitted yet — continue
        }

        const { data } = await getAssessment(assessmentId);
        setAssessment(data);

        // Check deadline
        if (new Date(data.deadline) < new Date()) {
          setError('The deadline for this assessment has passed.');
          setLoading(false);
          return;
        }

        // Initialise answers
        const init = {};
        data.questions.forEach(q => { init[q.id] = q.questionType === 'MULTI_SELECT' ? '[]' : ''; });
        setAnswers(init);

        // Start timer if duration set
        if (data.durationMinutes) {
          setTimeLeft(data.durationMinutes * 60);
        }
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to load assessment';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assessmentId]);

  // ── Countdown timer ───────────────────────────────────────────────────────

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Answer handlers ───────────────────────────────────────────────────────

  const setMcqAnswer = (questionId, optionIndex) =>
    setAnswers(prev => ({ ...prev, [questionId]: JSON.stringify([optionIndex]) }));

  const toggleMultiSelect = (questionId, optionIndex) => {
    setAnswers(prev => {
      const current = (() => {
        try { return JSON.parse(prev[questionId] || '[]'); } catch { return []; }
      })();
      const exists = current.includes(optionIndex);
      const next = exists ? current.filter(i => i !== optionIndex) : [...current, optionIndex];
      return { ...prev, [questionId]: JSON.stringify(next) };
    });
  };

  const setDescriptiveAnswer = (questionId, text) =>
    setAnswers(prev => ({ ...prev, [questionId]: text }));

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (auto = false) => {
    if (!assessment) return;
    if (submitting) return;

    // Validate all answered
    if (!auto) {
      for (const q of assessment.questions) {
        const val = answers[q.id] || '';
        if (q.questionType === 'MULTI_SELECT') {
          try {
            if (JSON.parse(val).length === 0) {
              toast.error(`Q${q.questionNo}: Please select at least one option`);
              return;
            }
          } catch { /* ignore */ }
        } else if (!val.trim()) {
          toast.error(`Q${q.questionNo}: Please answer this question`);
          return;
        }
      }
    }

    setSubmitting(true);
    clearTimeout(timerRef.current);

    try {
      const payload = assessment.questions.map(q => ({
        questionId: q.id,
        answerValue: answers[q.id] || '',
      }));

      const { data } = await submitAssessment(assessmentId, payload);
      toast.success('Assessment submitted!');
      navigate(`/student/assessment/${assessmentId}/result`, { state: { submission: data } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
      setSubmitting(false);
    }
  }, [assessment, answers, assessmentId, submitting, navigate]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      toast.error('Time is up! Submitting automatically...');
      handleSubmit(true);
      return;
    }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, handleSubmit]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const getSelectedIndices = (questionId) => {
    try { return JSON.parse(answers[questionId] || '[]'); } catch { return []; }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="page"><p>Loading assessment...</p></div>;
  if (error) return <div className="page"><div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger, #dc2626)' }}>{error}</div></div>;

  // Already submitted — show result summary
  if (alreadySubmitted && mySubmission) {
    return (
      <div className="page">
        <div className="page-header"><h2>Assessment Result</h2></div>
        <div className="card form-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
          <h3>Already Submitted</h3>
          <p style={{ color: 'var(--text-muted, #888)', marginBottom: '1.5rem' }}>
            You have already completed this assessment.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                {mySubmission.totalMarksObtained ?? '—'}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>
                / {mySubmission.totalMarks} marks
              </div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                {mySubmission.totalMarks > 0
                  ? Math.round((mySubmission.totalMarksObtained / mySubmission.totalMarks) * 100)
                  : '—'}%
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>Score</div>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>
            Status: <strong>{mySubmission.status}</strong>
            {mySubmission.status === 'PARTIALLY_GRADED' && ' — descriptive answers are being evaluated by AI'}
          </p>
        </div>
      </div>
    );
  }

  const deadline = new Date(assessment.deadline);
  const isLowTime = timeLeft !== null && timeLeft < 300; // < 5 mins

  return (
    <div className="page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h2>{assessment.title}</h2>
          {assessment.description && (
            <p className="page-subtitle">{assessment.description}</p>
          )}
          <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>
            {assessment.questions.length} questions &nbsp;·&nbsp; {assessment.totalMarks} marks total
            &nbsp;·&nbsp; Deadline: {deadline.toLocaleString()}
          </p>
        </div>

        {/* Timer */}
        {timeLeft !== null && (
          <div style={{
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            background: isLowTime ? 'var(--danger-bg, #fee2e2)' : 'var(--primary-bg, #e8f5ff)',
            color: isLowTime ? 'var(--danger, #dc2626)' : 'var(--primary, #0b83db)',
            fontWeight: 700,
            fontSize: '1.4rem',
            fontFamily: 'monospace',
            minWidth: '80px',
            textAlign: 'center',
          }}>
            ⏱ {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Questions */}
      {assessment.questions.map((q, idx) => (
        <div key={q.id} className="card form-card" style={{ marginBottom: '1rem' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary, #0b83db)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {q.questionType === 'MCQ' ? 'MCQ' : q.questionType === 'MULTI_SELECT' ? 'Multi-select' : 'Descriptive'}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>
              {q.marks} mark{q.marks !== 1 ? 's' : ''}
            </span>
          </div>

          <p style={{ fontWeight: 500, marginBottom: '1rem', lineHeight: 1.5 }}>
            <span style={{ color: 'var(--text-muted, #888)', marginRight: '0.5rem' }}>Q{idx + 1}.</span>
            {q.questionText}
          </p>

          {/* MCQ options */}
          {q.questionType === 'MCQ' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {q.options.map((opt, oIdx) => {
                const selected = getSelectedIndices(q.id).includes(oIdx);
                return (
                  <label key={oIdx} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 0.9rem', borderRadius: '8px', cursor: 'pointer',
                    border: `1.5px solid ${selected ? 'var(--primary, #0b83db)' : 'var(--border, #e5e7eb)'}`,
                    background: selected ? 'var(--primary-bg, #e8f5ff)' : 'transparent',
                    transition: 'all 0.15s',
                  }}>
                    <input
                      type="radio"
                      name={`mcq-${q.id}`}
                      checked={selected}
                      onChange={() => setMcqAnswer(q.id, oIdx)}
                      style={{ accentColor: 'var(--primary, #0b83db)' }}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* MULTI_SELECT options */}
          {q.questionType === 'MULTI_SELECT' && (
            <>
              <p className="field-hint" style={{ marginBottom: '0.5rem' }}>Select all that apply</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {q.options.map((opt, oIdx) => {
                  const selected = getSelectedIndices(q.id).includes(oIdx);
                  return (
                    <label key={oIdx} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.6rem 0.9rem', borderRadius: '8px', cursor: 'pointer',
                      border: `1.5px solid ${selected ? 'var(--primary, #0b83db)' : 'var(--border, #e5e7eb)'}`,
                      background: selected ? 'var(--primary-bg, #e8f5ff)' : 'transparent',
                      transition: 'all 0.15s',
                    }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMultiSelect(q.id, oIdx)}
                        style={{ accentColor: 'var(--primary, #0b83db)' }}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {/* DESCRIPTIVE */}
          {q.questionType === 'DESCRIPTIVE' && (
            <textarea
              placeholder="Type your answer here..."
              value={answers[q.id] || ''}
              onChange={e => setDescriptiveAnswer(q.id, e.target.value)}
              rows={5}
              style={{ width: '100%', resize: 'vertical' }}
            />
          )}
        </div>
      ))}

      {/* Submit */}
      <div className="form-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn-secondary"
          onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={submitting}
          onClick={() => handleSubmit(false)}
        >
          {submitting ? 'Submitting...' : 'Submit Assessment'}
        </button>
      </div>

    </div>
  );
}
