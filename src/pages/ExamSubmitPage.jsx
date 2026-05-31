import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Upload, FileText, Clock } from 'lucide-react';

export default function ExamSubmitPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    api.get(`/api/exams/${examId}`)
      .then((res) => setExam(res.data))
      .catch(() => toast.error('Failed to load exam'))
      .finally(() => setLoading(false));
  }, [examId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return toast.error('Only PDF, JPEG, PNG, or WEBP files are allowed');
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(
        `/api/student/exams/${examId}/submit`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success('Answer sheet submitted! AI evaluation in progress...');
      navigate(`/student/result/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Loading exam...</div>;
  if (!exam) return <div className="error">Exam not found</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>{exam.title}</h2>
          <p className="page-subtitle">{exam.classroomName} · {exam.totalMarks} marks</p>
        </div>
      </div>

      <div className="card form-card">
        <div className="exam-deadline-info">
          <Clock size={16} />
          <span>
            Deadline: <strong>
              {new Date(exam.deadline).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </strong>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="submit-form">
          <div className="form-group">
            <label>Upload Answer Sheet</label>
            <p className="field-hint">PDF, JPEG, PNG or WEBP — max 20MB</p>

            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const dropped = e.dataTransfer.files[0];
                if (dropped) setFile(dropped);
              }}
              onClick={() => document.getElementById('file-input').click()}
            >
              {file ? (
                <div className="file-selected">
                  <FileText size={32} />
                  <p>{file.name}</p>
                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              ) : (
                <div className="drop-zone-prompt">
                  <Upload size={32} />
                  <p>Drag & drop or click to upload</p>
                  <span>PDF, JPEG, PNG, WEBP</span>
                </div>
              )}
            </div>

            <input
              id="file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || !file}>
              {submitting ? 'Submitting...' : 'Submit Answer Sheet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}