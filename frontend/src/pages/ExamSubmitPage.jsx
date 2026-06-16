import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../api/axios';
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
  const [loadError, setLoadError] = useState('');

  // Single-answer mode
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Multi-question mode: one answer sheet contains all answers.
  const [multiFile, setMultiFile] = useState(null);
  const [multiUploadStatus, setMultiUploadStatus] = useState('idle');

  const ensureMultiSubmission = async () => {
    if (submissionId) return submissionId;

    const { data: sub } = await api.post(
      `/api/student/exams/${examId}/submit-multi`
    );
    setSubmissionId(sub.id);
    return sub.id;
  };

  // ── Load exam ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data: examData } = await api.get(`/api/exams/${examId}`);
        setExam(examData);

        if (examData.isMultiQuestion) {
          const { data: qData } = await api.get(`/api/exams/${examId}/questions`);
          setQuestions(qData);

          // Create or recover the parent submission row so uploads have an ID.
          const { data: sub } = await api.post(
            `/api/student/exams/${examId}/submit-multi`
          );
          setSubmissionId(sub.id);
        }
      } catch (err) {
        const message = getApiErrorMessage(err, 'Failed to load exam');
        setLoadError(message);
        toast.error(message);
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
  const uploadMultiAnswerSheet = async (existingSubmissionId = null) => {
    if (!multiFile) return false;

    setMultiUploadStatus('uploading');
    const form = new FormData();
    form.append('file', multiFile);

    try {
      const activeSubmissionId = existingSubmissionId || await ensureMultiSubmission();

      await api.post(
        `/api/submissions/${activeSubmissionId}/questions/upload-all`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setMultiUploadStatus('done');
      toast.success('Answer sheet uploaded');
      return true;
    } catch (err) {
      setMultiUploadStatus('error');
      toast.error(getApiErrorMessage(err, 'Upload failed - try again'));
      return false;
    }
  };

  // ── Multi-question: final submit → trigger AI evaluation ─────────────────
  const handleMultiSubmit = async () => {
    setSubmitting(true);
    try {
      const activeSubmissionId = await ensureMultiSubmission();

      if (!multiFile && multiUploadStatus !== 'done') {
        toast.error('Upload at least one answer before submitting');
        return;
      }

      if (multiUploadStatus !== 'done') {
        const uploaded = await uploadMultiAnswerSheet(activeSubmissionId);
        if (!uploaded) return;
      }

      const { data } = await api.post(`/api/submissions/${activeSubmissionId}/evaluate-questions`);
      toast.success(`Submitted! AI evaluated ${data.succeeded ?? 0}/${data.attempted ?? questions.length} questions.`);
      navigate(`/student/result/${activeSubmissionId}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Submission failed'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div className="loading">Loading exam...</div>;
  if (!exam)   return <div className="error">{loadError || 'Exam not found'}</div>;

  const uploadedCount = multiUploadStatus === 'done' ? questions.length : 0;

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

            {exam.questionText && (
              <div className="card" style={{ background: 'var(--gray-50)', marginBottom: '0.5rem' }}>
                <p className="field-hint" style={{ marginBottom: '0.4rem', fontWeight: 600, color: 'var(--gray-800)' }}>
                  Question
                </p>
                <p style={{ fontSize: '0.95rem', color: 'var(--gray-800)', lineHeight: 1.6 }}>
                  {exam.questionText}
                </p>
              </div>
            )}

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
              Upload one answer sheet containing all answers. Label answers as Q1, Q2, Q3, etc. for best evaluation.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label>Upload Answer Sheet</label>
              <p className="field-hint">One PDF, JPEG, PNG or WEBP file for all {questions.length} questions</p>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  setMultiFile(e.target.files[0]);
                  setMultiUploadStatus('idle');
                }}
                style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}
              />
              {multiFile && (
                <p className="field-hint" style={{ marginTop: '0.5rem' }}>
                  Selected: {multiFile.name} ({(multiFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              {multiUploadStatus === 'done' && (
                <p style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  <CheckCircle size={14} /> Uploaded for all questions
                </p>
              )}
              {multiUploadStatus === 'error' && (
                <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' }}>Upload failed</p>
              )}
            </div>

            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
              {questions.map((q) => (
                <div key={q.id} className="card" style={{ padding: '1rem' }}>
                  <strong style={{ color: 'var(--primary, #4f46e5)' }}>Q{q.questionNo}</strong>
                  <span className="field-hint" style={{ marginLeft: '0.5rem' }}>{q.marks} marks</span>
                  <p style={{ fontSize: '0.9rem', color: '#374151', marginTop: '0.5rem' }}>
                    {q.questionText}
                  </p>
                </div>
              ))}
            </div>

            <p className="field-hint" style={{ marginBottom: '1rem' }}>
              {uploadedCount}/{questions.length} questions uploaded
              {uploadedCount < questions.length && ' - selected sheet will be evaluated for every question'}
            </p>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={submitting || (!multiFile && multiUploadStatus !== 'done')}
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