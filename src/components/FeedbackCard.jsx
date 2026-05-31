import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function FeedbackCard({ feedbackJson, aiMarks, teacherMarks, totalMarks, confidence }) {
  if (!feedbackJson) return null;

  let feedback;
  try {
    const parsed = typeof feedbackJson === 'string' ? JSON.parse(feedbackJson) : feedbackJson;
    feedback = parsed.feedback || parsed;
  } catch {
    return <p className="error">Could not parse feedback.</p>;
  }

  const { keyword_analysis, sentence_analysis, score_breakdown, word_count_model, word_count_student } = feedback;
  const finalMarks = teacherMarks ?? aiMarks;
  const confidenceLabel = confidence >= 0.75 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low';
  const confidenceColor = confidence >= 0.75 ? 'green' : confidence >= 0.5 ? 'orange' : 'red';

  return (
    <div className="feedback-card">

      {/* Marks summary */}
      <div className="feedback-marks">
        <div className="marks-final">
          <span className="marks-number">{finalMarks?.toFixed(1)}</span>
          <span className="marks-total">/ {totalMarks}</span>
        </div>
        <div className="marks-meta">
          {teacherMarks != null && (
            <span className="badge badge-reviewed">Teacher Reviewed</span>
          )}
          {teacherMarks == null && (
            <span className="badge badge-ai">AI Evaluated</span>
          )}
          <span className="badge" style={{ background: confidenceColor }}>
            Confidence: {confidenceLabel}
          </span>
        </div>
      </div>

      {/* Dual marks */}
      {aiMarks != null && teacherMarks != null && (
        <div className="dual-marks">
          <div className="dual-mark-item">
            <span>AI Marks</span>
            <strong>{aiMarks?.toFixed(1)} / {totalMarks}</strong>
          </div>
          <div className="dual-mark-item">
            <span>Teacher Marks</span>
            <strong>{teacherMarks?.toFixed(1)} / {totalMarks}</strong>
          </div>
        </div>
      )}

      {/* Score breakdown */}
      {score_breakdown && (
        <div className="feedback-section">
          <h4>Score Breakdown</h4>
          <div className="score-bars">
            {Object.entries(score_breakdown).map(([key, val]) => (
              <div key={key} className="score-bar-row">
                <span className="score-bar-label">
                  {key.replace('_score', '').replace('_', ' ')}
                </span>
                <div className="score-bar-track">
                  <div
                    className="score-bar-fill"
                    style={{ width: `${(val * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="score-bar-value">{(val * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyword analysis */}
      {keyword_analysis && (
        <div className="feedback-section">
          <h4>Keyword Analysis</h4>
          <div className="keyword-grid">
            <div className="keyword-col">
              <p className="keyword-col-title covered">
                <CheckCircle size={14} /> Covered
              </p>
              {keyword_analysis.covered?.length > 0
                ? keyword_analysis.covered.map((kw) => (
                    <span key={kw} className="keyword-tag covered">{kw}</span>
                  ))
                : <span className="empty-state">None</span>
              }
            </div>
            <div className="keyword-col">
              <p className="keyword-col-title missing">
                <XCircle size={14} /> Missing
              </p>
              {keyword_analysis.missing?.length > 0
                ? keyword_analysis.missing.map((kw) => (
                    <span key={kw} className="keyword-tag missing">{kw}</span>
                  ))
                : <span className="empty-state">All covered!</span>
              }
            </div>
          </div>
        </div>
      )}

      {/* Missing points */}
      {sentence_analysis?.missing_points?.length > 0 && (
        <div className="feedback-section">
          <h4><XCircle size={14} /> Points Not Addressed</h4>
          <ul className="feedback-list missing">
            {sentence_analysis.missing_points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Additional content */}
      {sentence_analysis?.additional_content?.length > 0 && (
        <div className="feedback-section">
          <h4><AlertCircle size={14} /> Additional Content (verify manually)</h4>
          <ul className="feedback-list additional">
            {sentence_analysis.additional_content.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Word count */}
      <div className="feedback-section word-counts">
        <span>Model answer: <strong>{word_count_model} words</strong></span>
        <span>Your answer: <strong>{word_count_student} words</strong></span>
        <span>Coverage: <strong>
          {word_count_model > 0
            ? `${Math.min(Math.round((word_count_student / word_count_model) * 100), 100)}%`
            : 'N/A'}
        </strong></span>
      </div>

    </div>
  );
}