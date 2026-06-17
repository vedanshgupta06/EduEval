// frontend/src/pages/CreateAssessmentPage.jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createAssessment } from '../api/assessments';

const QUESTION_TYPES = [
  { value: 'MCQ', label: 'MCQ', hint: 'Single correct answer' },
  { value: 'MULTI_SELECT', label: 'Multi-select', hint: 'Multiple correct answers' },
  { value: 'DESCRIPTIVE', label: 'Descriptive', hint: 'AI-evaluated typed answer' },
];

const emptyQuestion = () => ({
  questionText: '',
  questionType: 'MCQ',
  marks: '',
  options: ['', '', '', ''],
  correctAnswers: [],
  modelAnswerText: '',
  scoringMode: 'PROPORTIONAL',
});

export default function CreateAssessmentPage() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    deadline: '',
    durationMinutes: '',
  });

  const [questions, setQuestions] = useState([emptyQuestion()]);

  const totalMarks = questions.reduce((s, q) => s + (parseInt(q.marks) || 0), 0);

  // ── Question helpers ──────────────────────────────────────────────────────

  const updateQ = (idx, field, value) =>
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));

  const updateOption = (qIdx, optIdx, value) =>
    setQuestions(prev => prev.map((q, i) =>
      i === qIdx
        ? { ...q, options: q.options.map((o, j) => j === optIdx ? value : o) }
        : q
    ));

  const addOption = (qIdx) =>
    setQuestions(prev => prev.map((q, i) =>
      i === qIdx ? { ...q, options: [...q.options, ''] } : q
    ));

  const removeOption = (qIdx, optIdx) =>
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const newOptions = q.options.filter((_, j) => j !== optIdx);
      // Remove from correctAnswers if it was selected, and adjust indices
      const newCorrect = q.correctAnswers
        .filter(c => c !== optIdx)
        .map(c => c > optIdx ? c - 1 : c);
      return { ...q, options: newOptions, correctAnswers: newCorrect };
    }));

  const toggleCorrect = (qIdx, optIdx) =>
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      if (q.questionType === 'MCQ') {
        return { ...q, correctAnswers: [optIdx] };
      }
      // MULTI_SELECT: toggle
      const exists = q.correctAnswers.includes(optIdx);
      return {
        ...q,
        correctAnswers: exists
          ? q.correctAnswers.filter(c => c !== optIdx)
          : [...q.correctAnswers, optIdx],
      };
    }));

  const changeType = (qIdx, newType) =>
    setQuestions(prev => prev.map((q, i) =>
      i === qIdx
        ? { ...q, questionType: newType, correctAnswers: [], options: newType === 'DESCRIPTIVE' ? [] : (q.options.length ? q.options : ['', '', '', '']) }
        : q
    ));

  const addQuestion = () => setQuestions(prev => [...prev, emptyQuestion()]);

  const removeQuestion = (idx) => {
    if (questions.length === 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const moveQuestion = (idx, dir) => {
    const newQ = [...questions];
    const target = idx + dir;
    if (target < 0 || target >= newQ.length) return;
    [newQ[idx], newQ[target]] = [newQ[target], newQ[idx]];
    setQuestions(newQ);
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = () => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) { toast.error(`Q${i + 1}: Question text is required`); return false; }
      if (!q.marks || parseInt(q.marks) < 1) { toast.error(`Q${i + 1}: Marks must be at least 1`); return false; }

      if (q.questionType === 'MCQ' || q.questionType === 'MULTI_SELECT') {
        const filled = q.options.filter(o => o.trim());
        if (filled.length < 2) { toast.error(`Q${i + 1}: At least 2 options are required`); return false; }
        if (q.correctAnswers.length === 0) { toast.error(`Q${i + 1}: Select at least one correct answer`); return false; }
        if (q.questionType === 'MCQ' && q.correctAnswers.length > 1) { toast.error(`Q${i + 1}: MCQ can only have one correct answer`); return false; }
      }

      if (q.questionType === 'DESCRIPTIVE' && !q.modelAnswerText.trim()) {
        toast.error(`Q${i + 1}: Model answer is required for descriptive questions`); return false;
      }
    }
    return true;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        deadline: new Date(form.deadline).toISOString(),
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : null,
        questions: questions.map(q => ({
          questionText: q.questionText,
          questionType: q.questionType,
          marks: parseInt(q.marks),
          options: q.questionType !== 'DESCRIPTIVE' ? q.options.filter(o => o.trim()) : null,
          correctAnswers: q.questionType !== 'DESCRIPTIVE' ? q.correctAnswers : null,
          modelAnswerText: q.questionType === 'DESCRIPTIVE' ? q.modelAnswerText : null,
          scoringMode: q.scoringMode,
        })),
      };

      await createAssessment(classroomId, payload);
      toast.success('Assessment created!');
      navigate(`/teacher/classroom/${classroomId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create assessment');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Create Assessment</h2>
          <p className="page-subtitle">Build a Google Form-style assessment with MCQ, multi-select, and descriptive questions</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── Basic details ─────────────────────────────────────────────── */}
        <div className="card form-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Assessment Details</h3>

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              placeholder="e.g. Unit 4 — Database Concepts"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Description <span style={{ color: 'var(--text-muted, #888)', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              placeholder="Instructions for students..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Submission Deadline</label>
              <input
                type="datetime-local"
                value={form.deadline}
                min={new Date().toISOString().slice(0, 16)}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Time Limit (minutes) <span style={{ color: 'var(--text-muted, #888)', fontWeight: 400 }}>(optional)</span></label>
              <input
                type="number"
                placeholder="e.g. 30"
                value={form.durationMinutes}
                min={1}
                onChange={e => setForm({ ...form, durationMinutes: e.target.value })}
              />
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)', marginTop: '0.25rem' }}>
            Total marks: <strong>{totalMarks}</strong> &nbsp;·&nbsp; Questions: <strong>{questions.length}</strong>
          </div>
        </div>

        {/* ── Questions ─────────────────────────────────────────────────── */}
        {questions.map((q, idx) => (
          <div key={idx} className="card form-card" style={{ marginBottom: '1rem' }}>

            {/* Question header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--primary, #0b83db)' }}>Question {idx + 1}</strong>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}>↑</button>
                <button type="button" className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => moveQuestion(idx, 1)} disabled={idx === questions.length - 1}>↓</button>
                {questions.length > 1 && (
                  <button type="button" className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', color: 'var(--danger, #dc2626)' }}
                    onClick={() => removeQuestion(idx)}>Remove</button>
                )}
              </div>
            </div>

            {/* Question type selector */}
            <div className="form-group">
              <label>Question Type</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {QUESTION_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={q.questionType === t.value ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '0.85rem', padding: '0.3rem 0.9rem' }}
                    onClick={() => changeType(idx, t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="field-hint">{QUESTION_TYPES.find(t => t.value === q.questionType)?.hint}</p>
            </div>

            {/* Question text */}
            <div className="form-group">
              <label>Question Text</label>
              <textarea
                placeholder="Type the question here..."
                value={q.questionText}
                onChange={e => updateQ(idx, 'questionText', e.target.value)}
                rows={2}
                required
              />
            </div>

            {/* Marks */}
            <div className="form-group">
              <label>Marks</label>
              <input
                type="number"
                placeholder="e.g. 5"
                value={q.marks}
                min={1}
                style={{ maxWidth: '120px' }}
                onChange={e => updateQ(idx, 'marks', e.target.value)}
                required
              />
            </div>

            {/* Options — MCQ / MULTI_SELECT */}
            {(q.questionType === 'MCQ' || q.questionType === 'MULTI_SELECT') && (
              <div className="form-group">
                <label>
                  Options &nbsp;
                  <span className="field-hint" style={{ display: 'inline' }}>
                    — click {q.questionType === 'MCQ' ? 'the circle' : 'the checkboxes'} to mark correct answer{q.questionType === 'MULTI_SELECT' ? 's' : ''}
                  </span>
                </label>
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                    {/* Correct answer toggle */}
                    <input
                      type={q.questionType === 'MCQ' ? 'radio' : 'checkbox'}
                      name={`correct-${idx}`}
                      checked={q.correctAnswers.includes(oIdx)}
                      onChange={() => toggleCorrect(idx, oIdx)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                      title="Mark as correct answer"
                    />
                    <input
                      type="text"
                      placeholder={`Option ${oIdx + 1}`}
                      value={opt}
                      onChange={e => updateOption(idx, oIdx, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {q.options.length > 2 && (
                      <button type="button" className="btn-secondary"
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', color: 'var(--danger, #dc2626)' }}
                        onClick={() => removeOption(idx, oIdx)}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn-secondary"
                  style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
                  onClick={() => addOption(idx)}>
                  + Add Option
                </button>

                {/* Scoring mode for MULTI_SELECT */}
                {q.questionType === 'MULTI_SELECT' && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ fontSize: '0.85rem' }}>Scoring Mode</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                      {['PROPORTIONAL', 'STRICT'].map(mode => (
                        <button key={mode} type="button"
                          className={q.scoringMode === mode ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
                          onClick={() => updateQ(idx, 'scoringMode', mode)}>
                          {mode === 'PROPORTIONAL' ? 'Partial credit' : 'All or nothing'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Model answer — DESCRIPTIVE */}
            {q.questionType === 'DESCRIPTIVE' && (
              <div className="form-group">
                <label>Model Answer</label>
                <p className="field-hint">The AI will evaluate student answers against this.</p>
                <textarea
                  placeholder="Enter the ideal answer here..."
                  value={q.modelAnswerText}
                  onChange={e => updateQ(idx, 'modelAnswerText', e.target.value)}
                  rows={5}
                  required
                />
              </div>
            )}
          </div>
        ))}

        {/* Add question button */}
        <button type="button" className="btn-secondary full-width"
          style={{ marginBottom: '1.5rem' }}
          onClick={addQuestion}>
          + Add Question
        </button>

        {/* Form actions */}
        <div className="form-actions">
          <button type="button" className="btn-secondary"
            onClick={() => navigate(`/teacher/classroom/${classroomId}`)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating...' : `Create Assessment (${totalMarks} marks)`}
          </button>
        </div>

      </form>
    </div>
  );
}
