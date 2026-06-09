import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import FeedbackCard from '../components/FeedbackCard';
import { ArrowLeft, Clock } from 'lucide-react';

function getExtractedText(aiFeedback) {
  const feedback = aiFeedback?.feedback || aiFeedback;
  if (feedback?.not_evaluated) {
    return feedback?.extracted_student_answer || '';
  }
  return (
    feedback?.extracted_student_answer ||
    feedback?.extracted_full_answer_sheet ||
    ''
  );
}

function getFeedback(aiFeedback) {
  return aiFeedback?.feedback || aiFeedback || {};
}

export default function ResultPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [exam, setExam] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [questionEvals, setQuestionEvals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const subRes = await api.get(`/api/submissions/${submissionId}`);
      setSubmission(subRes.data);

      const examRes = await api.get(`/api/exams/${subRes.data.examId}`);
      setExam(examRes.data);

      if (examRes.data.isMultiQuestion) {
        const qeRes = await api.get(`/api/submissions/${submissionId}/question-evaluations`);
        setQuestionEvals(qeRes.data);
      } else {
        const evalRes = await api.get(`/api/evaluations/${submissionId}`);
        setEvaluation(evalRes.data);
      }
    } catch {
      toast.error('Failed to load result');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading">Loading result...</div>;

  const isMulti = exam?.isMultiQuestion;

  // Still processing
  const isProcessing = submission?.status === 'PENDING' || submission?.status === 'PROCESSING';
  if (isProcessing || (!isMulti && !evaluation) || (isMulti && questionEvals.length === 0)) {
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
          <button className="btn-primary" onClick={fetchData}>Refresh</button>
        </div>
      </div>
    );
  }

  // Totals for multi
  const multiEffective = questionEvals.reduce((s, q) => s + (q.effectiveMarks ?? q.aiMarks ?? 0), 0);
  const multiAi        = questionEvals.reduce((s, q) => s + (q.aiMarks ?? 0), 0);
  const totalMax = exam?.totalMarks || 0;

  const mainScore = isMulti ? multiEffective : (evaluation?.teacherMarks ?? evaluation?.aiMarks ?? 0);
  const pct = totalMax > 0 ? Math.round((mainScore / totalMax) * 100) : 0;
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';

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

      {/* Score card */}
      <div className="card" style={{ textAlign: 'center', padding: '2rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '3.5rem', fontWeight: 900, color: pct >= 70 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626' }}>
          {grade}
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem' }}>
          {mainScore.toFixed(1)} / {totalMax}
        </div>
        <p className="field-hint">{pct}%</p>
        {isMulti && multiAi !== multiEffective && (
          <p className="field-hint">
            AI awarded {multiAi.toFixed(1)} · Teacher adjusted to {multiEffective.toFixed(1)}
          </p>
        )}
      </div>

      {/* ── SINGLE ANSWER MODE ──────────────────────────────────────────────── */}
      {!isMulti && evaluation && (
        <>
          {evaluation.teacherComment && (
            <div className="card teacher-comment-card">
              <h4>Teacher Feedback</h4>
              <p>{evaluation.teacherComment}</p>
            </div>
          )}

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
            totalMarks={evaluation.totalMarks}
            confidence={evaluation.aiConfidence}
          />
        </>
      )}

      {isMulti && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {questionEvals.map((qe) => {
            const feedback = getFeedback(qe.aiFeedback);
            const notEvaluated = Boolean(feedback.not_evaluated);
            const effective = qe.effectiveMarks ?? qe.aiMarks ?? 0;
            const extractedText = getExtractedText(qe.aiFeedback);

            return (
              <div key={qe.questionSubmissionId} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <strong style={{ color: '#4f46e5' }}>Q{qe.questionNo}</strong>
                    <span className="field-hint" style={{ marginLeft: '0.5rem' }}>{qe.maxMarks} marks</span>
                  </div>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {notEvaluated ? 'Not evaluated' : `${effective.toFixed(1)} / ${qe.maxMarks}`}
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: '0.75rem' }}>
                  {qe.questionText}
                </p>

                {extractedText ? (
                  <div className="feedback-section extracted-answer">
                    <h4>Text Extracted From Image</h4>
                    <p>{extractedText}</p>
                  </div>
                ) : notEvaluated ? (
                  <p className="field-hint">{feedback.error || 'No answer was detected for this question.'}</p>
                ) : (
                  <p className="field-hint">No extracted text is available for this question yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
