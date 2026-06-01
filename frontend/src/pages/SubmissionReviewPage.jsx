import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import FeedbackCard from '../components/FeedbackCard';
import { Save, RefreshCw, ArrowLeft, Clock, AlertCircle } from 'lucide-react';

export default function SubmissionReviewPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [startingEvaluation, setStartingEvaluation] = useState(false);
  const [marks, setMarks] = useState('');
  const [comment, setComment] = useState('');
  const autoStartAttempted = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const subRes = await api.get(`/api/submissions/${submissionId}`);
      let evalRes = null;

      try {
        evalRes = await api.get(`/api/evaluations/${submissionId}`);
      } catch (err) {
        if (err.response?.status !== 404) throw err;
      }

      setSubmission(subRes.data);
      setEvaluation(evalRes?.data || null);
      setStartingEvaluation(false);

      if (evalRes?.data?.teacherMarks != null) {
        setMarks(evalRes.data.teacherMarks);
        setComment(evalRes.data.teacherComment || '');
      } else if (evalRes?.data?.aiMarks != null) {
        setMarks(evalRes.data.aiMarks);
      }
    } catch {
      toast.error('Failed to load submission');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (submission?.status !== 'PROCESSING') return undefined;
    const timer = setInterval(fetchData, 5000);
    return () => clearInterval(timer);
  }, [fetchData, submission?.status]);

  const saveReview = async () => {
    if (marks === '' || isNaN(marks)) return toast.error('Enter valid marks');
    const totalMarks = submission?.totalMarks || 100;
    if (parseFloat(marks) > totalMarks) {
      return toast.error(`Marks cannot exceed ${totalMarks}`);
    }
    if (!evaluation?.id) return toast.error('Start AI evaluation before saving review');

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

  const triggerReEvaluation = useCallback(async () => {
    setReEvaluating(true);
    setStartingEvaluation(true);
    try {
      if (evaluation?.id) {
        await api.post(`/api/teacher/evaluations/${evaluation.id}/re-evaluate`);
      } else {
        await api.post(`/api/teacher/submissions/${submissionId}/evaluate`);
      }
      setSubmission((current) => current ? { ...current, status: 'PROCESSING' } : current);
      toast.success('Evaluation started. Check back in a moment');
      setTimeout(fetchData, 3000);
    } catch {
      setStartingEvaluation(false);
      toast.error('Failed to start evaluation');
    } finally {
      setReEvaluating(false);
    }
  }, [evaluation, fetchData, submissionId]);

  const hasAiResult = Boolean(evaluation?.aiFeedbackJson && evaluation?.aiMarks != null);
  const isProcessing = submission?.status === 'PROCESSING' || startingEvaluation;

  useEffect(() => {
    if (
      loading ||
      autoStartAttempted.current ||
      !submission ||
      hasAiResult ||
      submission.status !== 'PENDING'
    ) {
      return;
    }

    autoStartAttempted.current = true;
    triggerReEvaluation();
  }, [hasAiResult, loading, submission, triggerReEvaluation]);

  const openAnswerSheet = async () => {
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
  };

  if (loading) return <div className="loading">Loading review...</div>;
  if (!submission) return <div className="error">Submission not found</div>;

  const totalMarks = submission.totalMarks || evaluation?.totalMarks;

  return (
    <div className="page">
      <button className="btn-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="page-header">
        <div>
          <h2>Evaluation - {submission.studentName}</h2>
          <p className="page-subtitle">
            {submission.examTitle} - Submitted{' '}
            {new Date(submission.submittedAt).toLocaleDateString('en-IN')}
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={triggerReEvaluation}
          disabled={reEvaluating}
        >
          <RefreshCw size={14} className={reEvaluating ? 'spin' : ''} />
          {reEvaluating ? 'Loading...' : hasAiResult ? 'Re-evaluate' : 'Start Evaluation'}
        </button>
      </div>

      <div className="review-layout">
        <div className="review-left">
          <h3>AI Evaluation</h3>
          {hasAiResult ? (
            <FeedbackCard
              feedbackJson={evaluation.aiFeedbackJson}
              aiMarks={evaluation.aiMarks}
              teacherMarks={evaluation.teacherMarks}
              totalMarks={totalMarks}
              confidence={evaluation.aiConfidence}
            />
          ) : (
            <div className="card evaluation-state-card">
              {isProcessing ? (
                <>
                  <Clock size={40} className="spin icon-blue" />
                  <h4>Evaluation is running</h4>
                  <p>
                    The backend has sent this answer sheet to the Python AI service.
                    This page refreshes automatically while it is processing.
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle size={40} className="icon-orange" />
                  <h4>No AI result yet</h4>
                  <p>
                    The first evaluation did not finish or the AI service was unavailable.
                    Start evaluation again after the Python service is running on port 8000.
                  </p>
                  <button
                    className="btn-primary"
                    onClick={triggerReEvaluation}
                    disabled={reEvaluating}
                  >
                    <RefreshCw size={14} className={reEvaluating ? 'spin' : ''} />
                    {reEvaluating ? 'Loading...' : 'Start Evaluation'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

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
                disabled={!hasAiResult}
              />
              {evaluation?.aiMarks != null && (
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
                disabled={!hasAiResult}
              />
            </div>

            <button
              className="btn-primary full-width"
              onClick={saveReview}
              disabled={saving || !hasAiResult}
            >
              <Save size={15} />
              {saving ? 'Saving...' : evaluation?.isReviewed ? 'Update Review' : 'Save Review'}
            </button>

            {evaluation?.isReviewed && (
              <p className="reviewed-note">
                Reviewed by {evaluation.reviewedBy} on{' '}
                {new Date(evaluation.reviewedAt).toLocaleDateString('en-IN')}
              </p>
            )}
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <h3>Answer Sheet</h3>
            <button className="btn-secondary full-width" onClick={openAnswerSheet}>
              Open Answer Sheet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
