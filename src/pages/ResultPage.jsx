import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import FeedbackCard from '../components/FeedbackCard';
import { ArrowLeft, Clock } from 'lucide-react';

export default function ResultPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [submissionId]);

  const fetchData = async () => {
    try {
      const [subRes, evalRes] = await Promise.all([
        api.get(`/api/submissions/${submissionId}`),
        api.get(`/api/evaluations/${submissionId}`),
      ]);
      setSubmission(subRes.data);
      setEvaluation(evalRes.data);
    } catch {
      toast.error('Failed to load result');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading result...</div>;

  // Still processing
  if (!evaluation || submission?.status === 'PENDING' || submission?.status === 'PROCESSING') {
    return (
      <div className="page">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="processing-state">
          <Clock size={48} className="spin" />
          <h3>Evaluation in progress...</h3>
          <p>Your answer sheet has been submitted. The AI is evaluating it now.</p>
          <p>Your teacher will review the result shortly.</p>
          <button className="btn-primary" onClick={fetchData}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="page-header">
        <div>
          <h2>{submission.examTitle}</h2>
          <p className="page-subtitle">
            {submission.classroomName} · Submitted{' '}
            {new Date(submission.submittedAt).toLocaleDateString('en-IN')}
          </p>
        </div>
      </div>

      {/* Teacher comment */}
      {evaluation.teacherComment && (
        <div className="card teacher-comment-card">
          <h4>Teacher Feedback</h4>
          <p>{evaluation.teacherComment}</p>
        </div>
      )}

      {/* Pending review notice */}
      {!evaluation.isReviewed && (
        <div className="card notice-card">
          <p>
            <Clock size={14} /> AI evaluation is shown below.
            Your teacher will review and may adjust the marks.
          </p>
        </div>
      )}

      {/* Main feedback */}
      <FeedbackCard
        feedbackJson={evaluation.aiFeedbackJson}
        aiMarks={evaluation.aiMarks}
        teacherMarks={evaluation.teacherMarks}
        totalMarks={submission.totalMarks}
        confidence={evaluation.aiConfidence}
      />
    </div>
  );
}