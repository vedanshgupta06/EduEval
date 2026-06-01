import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function CreateExamPage() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    totalMarks: '',
    deadline: '',
    modelAnswerText: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/api/teacher/classrooms/${classroomId}/exams`, {
        title: form.title,
        totalMarks: parseInt(form.totalMarks),
        deadline: new Date(form.deadline).toISOString(),
        modelAnswerText: form.modelAnswerText,
        modelAnswerUrl: '',
      });
      toast.success('Exam created!');
      navigate(`/teacher/classroom/${classroomId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

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