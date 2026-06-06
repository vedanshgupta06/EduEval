import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Upload, FileText, Clock, CheckCircle } from 'lucide-react';

export default function ExamSubmitPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [submissionId, setSubmissionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Single-answer mode
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Multi-question mode: { [questionId]: { file, status: 'idle'|'uploading'|'done'|'error' } }
  const [qFiles, setQFiles] = useState({});

  // ── Load exam ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data: examData } = await api.get(`/api/exams/${examId}`);
        setExam(examData);

        if (examData.isMultiQuestion) {
          const { data: qData } = await api.get(`/api/exams/${examId}/questions`);
          setQuestions(qData);
          const init = {};
          qData.forEach(q => { init[q.id] = { file: null, status: 'idle' }; });
          setQFiles(init);

          // Create the parent submission row immediately so we have an ID
         const { data: sub } = await api.post(
            `/api/student/exams/${examId}/submit-multi`
          );
          console.log('Submission created:', sub.id);
          setSubmissionId(sub.id);
        }
      } catch {
        toast.error('Failed to load exam');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [examId]);

  // ── Single-answer submit ──────────────────────────────────────────────────
  const handleSingleSubmit = async (e) => {
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

  // ── Multi-question: upload one question file ──────────────────────────────
  const uploadQuestionFile = async (questionId) => {
    const state = qFiles[questionId];
    if (!state?.file) return;

    setQFiles(prev => ({ ...prev, [questionId]: { ...prev[questionId], status: 'uploading' } }));

    const form = new FormData();
    form.append('file', state.file);

    try {
      await api.post(
        `/api/submissions/${submissionId}/questions/${questionId}/upload`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setQFiles(prev => ({ ...prev, [questionId]: { ...prev[questionId], status: 'done' } }));
      toast.success(`Question ${questions.find(q => q.id === questionId)?.questionNo} uploaded`);
    } catch {
      setQFiles(prev => ({ ...prev, [questionId]: { ...prev[questionId], status: 'error' } }));
      toast.error('Upload failed — try again');
    }
  };

  // ── Multi-question: final submit → trigger AI evaluation ─────────────────
  const handleMultiSubmit = async () => {
    // Auto-upload any files not yet uploaded
    for (const q of questions) {
      if (qFiles[q.id]?.file && qFiles[q.id]?.status !== 'done') {
        await uploadQuestionFile(q.id);
      }
    }

    const uploadedCount = questions.filter(q => qFiles[q.id]?.status === 'done').length;
    if (uploadedCount === 0) {
      return toast.error('Upload at least one answer before submitting');
    }

    setSubmitting(true);
    try {
      await api.post(`/api/submissions/${submissionId}/evaluate-questions`);
      toast.success('Submitted! AI evaluation in progress...');
      navigate(`/student/result/${submissionId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div className="loading">Loading exam...</div>;
  if (!exam)   return <div className="error">Exam not found</div>;

  const uploadedCount = questions.filter(q => qFiles[q.id]?.status === 'done').length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>{exam.title}</h2>
          <p className="page-subtitle">
            {exam.classroomName} · {exam.totalMarks} marks
            {exam.isMultiQuestion && ` · ${questions.length} questions`}
          </p>
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

        {/* ── SINGLE ANSWER MODE ──────────────────────────────────────────── */}
        {!exam.isMultiQuestion && (
          <form onSubmit={handleSingleSubmit} className="submit-form">
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
        )}

        {/* ── MULTI-QUESTION MODE ─────────────────────────────────────────── */}
        {exam.isMultiQuestion && (
          <div className="submit-form">
            <p className="field-hint" style={{ marginBottom: '1.25rem', color: '#4f46e5' }}>
              Upload one file per question. Skipped questions receive 0 marks.
            </p>

            {questions.map((q) => {
              const state = qFiles[q.id] || {};
              return (
                <div key={q.id} className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <strong style={{ color: 'var(--primary, #4f46e5)' }}>
                        Q{q.questionNo}
                      </strong>
                      <span className="field-hint" style={{ marginLeft: '0.5rem' }}>
                        {q.marks} marks
                      </span>
                    </div>
                    {state.status === 'done' && (
                      <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                        <CheckCircle size={14} /> Uploaded
                      </span>
                    )}
                    {state.status === 'error' && (
                      <span style={{ color: '#dc2626', fontSize: '0.85rem' }}>Upload failed</span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: '0.75rem' }}>
                    {q.questionText}
                  </p>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) =>
                        setQFiles(prev => ({
                          ...prev,
                          [q.id]: { file: e.target.files[0], status: 'idle' },
                        }))
                      }
                      style={{ fontSize: '0.85rem' }}
                    />
                    {state.file && state.status !== 'done' && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.9rem', fontSize: '0.85rem' }}
                        disabled={state.status === 'uploading'}
                        onClick={() => uploadQuestionFile(q.id)}
                      >
                        {state.status === 'uploading' ? 'Uploading...' : 'Upload'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <p className="field-hint" style={{ marginBottom: '1rem' }}>
              {uploadedCount}/{questions.length} questions uploaded
              {uploadedCount < questions.length && ' · unuploaded questions = 0 marks'}
            </p>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={submitting || uploadedCount === 0}
                onClick={handleMultiSubmit}
              >
                {submitting ? 'Submitting...' : 'Submit All & Evaluate'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}