import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

const emptyQuestion = () => ({ questionText: '', marks: '', modelAnswerText: '' });

export default function CreateExamPage() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isMultiQuestion, setIsMultiQuestion] = useState(false);

  // Single-answer mode
  const [form, setForm] = useState({
    title: '',
    questionText: '',
    totalMarks: '',
    deadline: '',
    modelAnswerText: '',
  });

  // Multi-question mode
  const [questions, setQuestions] = useState([emptyQuestion()]);

  // ── question helpers ──────────────────────────────────────────────────────
  const updateQ = (idx, field, value) =>
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));

  const addQuestion = () => setQuestions(prev => [...prev, emptyQuestion()]);

  const removeQuestion = (idx) => {
    if (questions.length === 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const totalMarksCalc = questions.reduce((s, q) => s + (parseInt(q.marks) || 0), 0);

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let payload;

      if (isMultiQuestion) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (!q.questionText.trim() || !q.marks || !q.modelAnswerText.trim()) {
            toast.error(`Question ${i + 1} is incomplete`);
            setLoading(false);
            return;
          }
        }
        payload = {
          title: form.title,
          deadline: new Date(form.deadline).toISOString(),
          modelAnswerUrl: '',
          isMultiQuestion: true,
          questions: questions.map(q => ({
            questionText: q.questionText,
            marks: parseInt(q.marks),
            modelAnswerText: q.modelAnswerText,
          })),
        };
      } else {
        if (!form.questionText.trim()) {
          toast.error('Question text is required');
          setLoading(false);
          return;
        }
        payload = {
          title: form.title,
          questionText: form.questionText,
          totalMarks: parseInt(form.totalMarks),
          deadline: new Date(form.deadline).toISOString(),
          modelAnswerText: form.modelAnswerText,
          modelAnswerUrl: '',
          isMultiQuestion: false,
        };
      }

      await api.post(`/api/teacher/classrooms/${classroomId}/exams`, payload);
      toast.success('Exam created!');
      navigate(`/teacher/classroom/${classroomId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Create New Exam</h2>
          <p className="page-subtitle">Fill in the exam details and model answer</p>
        </div>
      </div>

      <div className="card form-card">
        <form onSubmit={handleSubmit} className="exam-form">

          <div className="form-group">
            <label>Exam Title</label>
            <input
              type="text"
              placeholder="e.g. Unit 3 — Data Structures"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Submission Deadline</label>
            <input
              type="datetime-local"
              value={form.deadline}
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Exam Type</label>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem' }}>
              <button
                type="button"
                className={isMultiQuestion ? 'btn-secondary' : 'btn-primary'}
                onClick={() => setIsMultiQuestion(false)}
              >
                Single Answer
              </button>
              <button
                type="button"
                className={isMultiQuestion ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setIsMultiQuestion(true)}
              >
                Multi-Question
              </button>
            </div>
            <p className="field-hint" style={{ marginTop: '0.5rem' }}>
              {isMultiQuestion
                ? 'Students upload one file per question. Total marks auto-calculated.'
                : 'Students upload one file for the whole exam.'}
            </p>
          </div>

          {!isMultiQuestion && (
            <>
              <div className="form-group">
                <label>Question Text</label>
                <p className="field-hint">The question students will see and answer.</p>
                <textarea
                  placeholder="e.g. Explain the concept of recursion with an example."
                  value={form.questionText}
                  onChange={(e) => setForm({ ...form, questionText: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Total Marks</label>
                  <input
                    type="number"
                    placeholder="e.g. 20"
                    value={form.totalMarks}
                    min={1}
                    onChange={(e) => setForm({ ...form, totalMarks: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Model Answer</label>
                <p className="field-hint">
                  Type the expected answer below. The AI will evaluate student answers against this.
                </p>
                <textarea
                  placeholder="Enter the complete model answer here..."
                  value={form.modelAnswerText}
                  onChange={(e) => setForm({ ...form, modelAnswerText: e.target.value })}
                  rows={10}
                  required
                />
              </div>
            </>
          )}

          {isMultiQuestion && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ margin: 0 }}>Questions</label>
                <span className="field-hint" style={{ margin: 0 }}>
                  Total: <strong>{totalMarksCalc} marks</strong>
                </span>
              </div>

              {questions.map((q, idx) => (
                <div key={idx} className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <strong style={{ color: 'var(--primary, #0b83db)' }}>Question {idx + 1}</strong>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => removeQuestion(idx)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Question Text</label>
                    <textarea
                      placeholder="e.g. Explain the process of photosynthesis."
                      value={q.questionText}
                      onChange={(e) => updateQ(idx, 'questionText', e.target.value)}
                      rows={3}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Marks</label>
                    <input
                      type="number"
                      placeholder="e.g. 5"
                      value={q.marks}
                      min={1}
                      style={{ maxWidth: '120px' }}
                      onChange={(e) => updateQ(idx, 'marks', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Model Answer</label>
                    <textarea
                      placeholder="Enter the model answer for this question..."
                      value={q.modelAnswerText}
                      onChange={(e) => updateQ(idx, 'modelAnswerText', e.target.value)}
                      rows={5}
                      required
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="btn-secondary full-width"
                onClick={addQuestion}
              >
                + Add Question
              </button>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate(`/teacher/classroom/${classroomId}`)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Exam'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
