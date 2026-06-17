import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getAssessmentResults,
  overrideAnswerMarks,
  downloadAssessmentReport,
  getAssessment,
} from '../api/assessments';

export default function AssessmentResultsPage() {
  const { assessmentId } = useParams();

  const [assessment, setAssessment]     = useState(null);
  const [submissions, setSubmissions]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [downloading, setDownloading]   = useState(false);
  const [expandedId, setExpandedId]     = useState(null);   // expanded submission id
  const [overrideState, setOverrideState] = useState({});   // { answerId: { marks, comment } }
  const [savingId, setSavingId]         = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: asmt }, { data: subs }] = await Promise.all([
          getAssessment(assessmentId),
          getAssessmentResults(assessmentId),
        ]);
        setAssessment(asmt);
        setSubmissions(subs);

        // Pre-fill override state from existing teacher marks
        const init = {};
        subs.forEach(sub =>
          sub.answers.forEach(a => {
            init[a.id] = {
              marks:   a.teacherMarks ?? a.marksObtained ?? 0,
              comment: a.teacherComment ?? '',
            };
          })
        );
        setOverrideState(init);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assessmentId]);

  // ── Override save ─────────────────────────────────────────────────────────

  const saveOverride = async (answerId) => {
    setSavingId(answerId);
    try {
      const { marks, comment } = overrideState[answerId];
      await overrideAnswerMarks(assessmentId, { answerId, marks: parseFloat(marks), comment });

      // Update local state
      setSubmissions(prev => prev.map(sub => ({
        ...sub,
        answers: sub.answers.map(a =>
          a.id === answerId
            ? { ...a, teacherMarks: parseFloat(marks), teacherComment: comment, finalMarks: parseFloat(marks) }
            : a
        ),
        totalMarksObtained: sub.answers
          .map(a => a.id === answerId
            ? parseFloat(marks)
            : (a.teacherMarks ?? a.marksObtained ?? 0))
          .reduce((s, v) => s + v, 0),
      })));

      toast.success('Marks updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save override');
    } finally {
      setSavingId(null);
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAssessmentReport(assessmentId, assessment?.title ?? 'Report');
      toast.success('Excel report downloaded!');
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setDownloading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const pct = (obtained, total) =>
    total > 0 ? Math.round((obtained / total) * 100) : 0;

  const statusBadge = (status) => {
    const map = {
      GRADED:           { label: 'Graded',           bg: '#dcfce7', color: '#166534' },
      PARTIALLY_GRADED: { label: 'Partially Graded', bg: '#fef9c3', color: '#854d0e' },
      PENDING:          { label: 'Pending',           bg: '#f3f4f6', color: '#374151' },
    };
    const s = map[status] || map.PENDING;
    return (
      <span style={{
        fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px',
        borderRadius: '4px', background: s.bg, color: s.color,
      }}>
        {s.label}
      </span>
    );
  };

  const questionTypeBadge = (type) => {
    const map = {
      MCQ:          { label: 'MCQ',         color: '#0b83db' },
      MULTI_SELECT: { label: 'Multi-select', color: '#075fa1' },
      DESCRIPTIVE:  { label: 'Descriptive',  color: '#0f766e' },
    };
    const s = map[type] || { label: type, color: '#6b7280' };
    return (
      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: s.color }}>
        [{s.label}]
      </span>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="page"><p>Loading results...</p></div>;

  const graded    = submissions.filter(s => s.status === 'GRADED').length;
  const pending   = submissions.filter(s => s.status !== 'GRADED').length;
  const avgScore  = submissions.length > 0
    ? (submissions.reduce((s, sub) => s + (sub.totalMarksObtained ?? 0), 0) / submissions.length).toFixed(1)
    : '—';

  return (
    <div className="page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h2>{assessment?.title ?? 'Assessment Results'}</h2>
          <p className="page-subtitle">
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
            {assessment?.totalMarks} total marks &nbsp;·&nbsp;
            Average: {avgScore}
          </p>
        </div>
        <button
          className="btn-primary"
          disabled={downloading || submissions.length === 0}
          onClick={handleDownload}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {downloading ? 'Generating...' : '⬇ Download Excel'}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Submissions', value: submissions.length },
          { label: 'Fully Graded', value: graded },
          { label: 'Pending / Partial', value: pending },
          { label: 'Average Score', value: avgScore },
          { label: 'Max Marks', value: assessment?.totalMarks },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginTop: '0.2rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* No submissions */}
      {submissions.length === 0 && (
        <div className="card form-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted, #888)' }}>
          No submissions yet.
        </div>
      )}

      {/* Submissions list */}
      {submissions.map(sub => {
        const isExpanded = expandedId === sub.id;
        const obtained   = sub.totalMarksObtained ?? 0;
        const total      = assessment?.totalMarks ?? 0;

        return (
          <div key={sub.id} className="card" style={{ marginBottom: '0.75rem', overflow: 'hidden' }}>

            {/* Row summary — always visible */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem', cursor: 'pointer',
              }}
              onClick={() => setExpandedId(isExpanded ? null : sub.id)}
            >
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500 }}>{sub.studentName}</span>
                <span style={{ marginLeft: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted, #888)' }}>
                  {sub.studentEmail}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {statusBadge(sub.status)}

                <div style={{ textAlign: 'right', minWidth: '90px' }}>
                  <span style={{ fontWeight: 700 }}>{obtained}</span>
                  <span style={{ color: 'var(--text-muted, #888)' }}> / {total}</span>
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted, #888)' }}>
                    ({pct(obtained, total)}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: '80px', height: '6px', background: 'var(--border, #e5e7eb)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '3px',
                    width: `${pct(obtained, total)}%`,
                    background: pct(obtained, total) >= 60
                      ? 'var(--success, #16a34a)'
                      : pct(obtained, total) >= 35 ? '#f59e0b' : 'var(--danger, #dc2626)',
                  }} />
                </div>

                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #888)' }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {/* Expanded — per-question breakdown */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--border, #e5e7eb)', padding: '1rem 1.25rem' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginBottom: '0.75rem' }}>
                  Submitted: {new Date(sub.submittedAt).toLocaleString()}
                  &nbsp;·&nbsp; Use the fields below to override AI marks for descriptive answers.
                </p>

                {sub.answers
                  .slice()
                  .sort((a, b) => a.questionNo - b.questionNo)
                  .map(answer => {
                    const override = overrideState[answer.id] ?? { marks: answer.finalMarks ?? 0, comment: '' };
                    const isDescriptive = answer.questionType === 'DESCRIPTIVE';

                    return (
                      <div key={answer.id} style={{
                        marginBottom: '1rem', padding: '0.9rem 1rem',
                        border: '1px solid var(--border, #e5e7eb)', borderRadius: '8px',
                        background: 'var(--surface-alt, #f9fafb)',
                      }}>
                        {/* Question header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                            Q{answer.questionNo} {questionTypeBadge(answer.questionType)}
                          </span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #888)' }}>
                            Max: {answer.maxMarks}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.85rem', marginBottom: '0.6rem', color: 'var(--text-secondary, #374151)' }}>
                          {answer.questionText}
                        </p>

                        {/* Student answer */}
                        <div style={{
                          padding: '0.5rem 0.75rem', borderRadius: '6px',
                          background: 'white', border: '1px solid var(--border, #e5e7eb)',
                          fontSize: '0.85rem', marginBottom: '0.6rem', whiteSpace: 'pre-wrap',
                        }}>
                          <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>STUDENT ANSWER</strong>
                          <br />
                          {isDescriptive
                            ? (answer.answerValue || <em>No answer</em>)
                            : (() => {
                                try {
                                  const indices = JSON.parse(answer.answerValue || '[]');
                                  return `Selected option(s): ${indices.map(i => String.fromCharCode(65 + i)).join(', ')}`;
                                } catch {
                                  return answer.answerValue || 'No answer';
                                }
                              })()
                          }
                        </div>

                        {/* AI feedback for descriptive */}
                        {isDescriptive && answer.aiFeedbackJson && (() => {
                          try {
                            const fb = JSON.parse(answer.aiFeedbackJson);
                            return (
                              <div style={{
                                padding: '0.5rem 0.75rem', borderRadius: '6px',
                                background: 'var(--primary-bg, #e8f5ff)', border: '1px solid var(--primary-soft, #d7ecfb)',
                                fontSize: '0.82rem', marginBottom: '0.6rem',
                              }}>
                                <strong style={{ fontSize: '0.75rem', color: 'var(--primary-dark, #075fa1)' }}>AI FEEDBACK</strong>
                                <br />
                                {fb.summary || JSON.stringify(fb)}
                                {answer.aiConfidence != null && (
                                  <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
                                    (confidence: {Math.round(answer.aiConfidence * 100)}%)
                                  </span>
                                )}
                              </div>
                            );
                          } catch { return null; }
                        })()}

                        {/* Marks row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #888)' }}>
                            AI marks: <strong>{answer.marksObtained ?? '—'}</strong>
                            {answer.teacherMarks != null && (
                              <> &nbsp;→ Teacher override: <strong>{answer.teacherMarks}</strong></>
                            )}
                          </span>

                          {/* Teacher override — only for descriptive */}
                          {isDescriptive && (
                            <>
                              <input
                                type="number"
                                min={0}
                                max={answer.maxMarks}
                                step={0.5}
                                value={override.marks}
                                style={{ width: '70px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                onChange={e => setOverrideState(prev => ({
                                  ...prev,
                                  [answer.id]: { ...prev[answer.id], marks: e.target.value },
                                }))}
                              />
                              <input
                                type="text"
                                placeholder="Comment (optional)"
                                value={override.comment}
                                style={{ flex: 1, minWidth: '120px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                onChange={e => setOverrideState(prev => ({
                                  ...prev,
                                  [answer.id]: { ...prev[answer.id], comment: e.target.value },
                                }))}
                              />
                              <button
                                className="btn-primary"
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
                                disabled={savingId === answer.id}
                                onClick={() => saveOverride(answer.id)}
                              >
                                {savingId === answer.id ? 'Saving...' : 'Save'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
