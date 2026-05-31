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
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [marks, setMarks] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => { fetchData(); }, [submissionId]);

  const fetchData = async () => {
    try {
      const [subRes, evalRes] = await Promise.all([
        api.get(`/api/submissions/${submissionId}`),
        api.get(`/api/evaluations/${submissionId}`),
      ]);
      setSubmission(subRes.data);
      setEvaluation(evalRes.data);
      console.log('Evaluation data:', evalRes.data);
      if (evalRes.data.teacherMarks != null) {
        setMarks(evalRes.data.teacherMarks);
        setComment(evalRes.data.teacherComment || '');
      } else if (evalRes.data.aiMarks != null) {
        setMarks(evalRes.data.aiMarks);
      }
    } catch {
      toast.error('Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const saveReview = async () => {
    if (marks === '' || isNaN(marks)) return toast.error('Enter valid marks');
    const totalMarks = evaluation?.totalMarks || 100;
    if (parseFloat(marks) > totalMarks) {
      return toast.error(`Marks cannot exceed ${totalMarks}`);
    }
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

  if (loading) return <div className="loading">Loading review...</div>;
  if (!submission || !evaluation) return <div className="error">Data not found</div>;

  const totalMarks = submission.totalMarks || evaluation.totalMarks;

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
        <button
          className="btn-secondary"
          onClick={triggerReEvaluation}
          disabled={reEvaluating}
        >
          <RefreshCw size={14} />
          {reEvaluating ? 'Re-evaluating...' : 'Re-evaluate'}
        </button>
      </div>

      <div className="review-layout">

        {/* Left — AI feedback */}
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

        {/* Right — Teacher override */}
        <div className="review-right">
          <div className="card override-card">
            <h3>Teacher Override</h3>
            <p className="field-hint">
              The AI mark is a suggestion. Adjust if needed.
            </p>

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

          {/* View answer sheet */}
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
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
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
    </div>
  );
}