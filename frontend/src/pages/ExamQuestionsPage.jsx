import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Clock, Edit3, FileText, Save, X } from 'lucide-react';
import api from '../api/axios';

export default function ExamQuestionsPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState({ questionText: '', marks: '', modelAnswerText: '' });
  const [saving, setSaving] = useState(false);

  const fetchExam = useCallback(async () => {
    try {
      const res = await api.get(`/api/teacher/exams/${examId}`);
      setExam(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load exam questions');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => { fetchExam(); }, [fetchExam]);

  const items = useMemo(() => {
    if (!exam) return [];
    if (exam.isMultiQuestion) return exam.questions || [];
    return [{
      id: 'single',
      questionNo: 1,
      marks: exam.totalMarks,
      questionText: exam.questionText,
      modelAnswerText: exam.modelAnswerText,
      updatedAt: exam.updatedAt,
    }];
  }, [exam]);

  const formatDateTime = (value) => {
    if (!value) return 'Not edited yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not edited yet';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const startEdit = (item) => {
    setEditingKey(item.id);
    setDraft({
      questionText: item.questionText || '',
      marks: item.marks || '',
      modelAnswerText: item.modelAnswerText || '',
    });
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft({ questionText: '', marks: '', modelAnswerText: '' });
  };

  const saveEdit = async (item) => {
    const nextMarks = parseInt(draft.marks, 10);
    if (!draft.questionText.trim() || !draft.modelAnswerText.trim() || !Number.isInteger(nextMarks) || nextMarks <= 0) {
      toast.error('Question, marks, and model answer are required');
      return;
    }

    setSaving(true);
    try {
      if (exam.isMultiQuestion) {
        const res = await api.put(`/api/teacher/exam-questions/${item.id}`, {
          questionText: draft.questionText,
          marks: nextMarks,
          modelAnswerText: draft.modelAnswerText,
        });
        setExam(prev => {
          const questions = prev.questions.map(q => q.id === item.id ? res.data : q);
          return {
            ...prev,
            totalMarks: questions.reduce((sum, q) => sum + (q.marks || 0), 0),
            questions,
          };
        });
      } else {
        const res = await api.put(`/api/teacher/exams/${exam.id}`, {
          questionText: draft.questionText,
          totalMarks: nextMarks,
          modelAnswerText: draft.modelAnswerText,
        });
        setExam(res.data);
      }
      toast.success('Question updated');
      cancelEdit();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update question');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading questions...</div>;
  if (!exam) return <div className="error">Exam not found</div>;

  return (
    <div className="page exam-questions-page">
      <div>
        <button className="btn-back" onClick={() => navigate(`/teacher/classroom/${exam.classroomId}`)}>
          <ArrowLeft size={15} /> Back to Classroom
        </button>
        <div className="page-header">
          <div>
            <h2>{exam.title}</h2>
            <p className="page-subtitle">
              Questions and model answers · {exam.totalMarks} marks
            </p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state-page">
          <FileText size={48} />
          <p>No question details are available for this exam.</p>
        </div>
      ) : (
        <div className="question-detail-list">
          {items.map((item) => {
            const isEditing = editingKey === item.id;
            return (
              <section key={item.id} className="question-detail-card">
                <div className="question-detail-header">
                  <div>
                    <h3>Q{item.questionNo} · {item.marks} marks</h3>
                    <p>
                      <Clock size={13} />
                      Last edited: {formatDateTime(item.updatedAt)}
                    </p>
                  </div>
                  {!isEditing && (
                    <button className="btn-secondary" onClick={() => startEdit(item)}>
                      <Edit3 size={15} /> Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="question-edit-form">
                    <div className="form-group">
                      <label>Question</label>
                      <textarea
                        rows={5}
                        value={draft.questionText}
                        onChange={(e) => setDraft(prev => ({ ...prev, questionText: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Marks</label>
                      <input
                        type="number"
                        min={1}
                        value={draft.marks}
                        onChange={(e) => setDraft(prev => ({ ...prev, marks: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Model Answer</label>
                      <textarea
                        rows={10}
                        value={draft.modelAnswerText}
                        onChange={(e) => setDraft(prev => ({ ...prev, modelAnswerText: e.target.value }))}
                      />
                    </div>
                    <div className="form-actions">
                      <button className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                        <X size={15} /> Cancel
                      </button>
                      <button className="btn-primary" onClick={() => saveEdit(item)} disabled={saving}>
                        <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="question-readout">
                    <div>
                      <span>Question</span>
                      <p>{item.questionText || 'No question text saved.'}</p>
                    </div>
                    <div>
                      <span>Model Answer</span>
                      <p>{item.modelAnswerText || 'No model answer saved.'}</p>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
