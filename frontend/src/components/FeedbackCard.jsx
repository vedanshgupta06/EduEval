import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

export default function FeedbackCard({ feedbackJson, aiMarks, teacherMarks, totalMarks, confidence }) {
  if (!feedbackJson) return null;

  let feedback;
  try {
    const parsed = typeof feedbackJson === 'string' ? JSON.parse(feedbackJson) : feedbackJson;
    feedback = parsed.feedback || parsed;
  } catch {
    return <p className="error">Could not parse feedback.</p>;
  }

  const {
    keyword_analysis,
    sentence_analysis,
    score_breakdown,
    scoring_weights,
    mark_calculation,
    word_count_model,
    word_count_student,
    extracted_student_answer,
    extracted_full_answer_sheet,
  } = feedback;
  const extractedText = extracted_student_answer || extracted_full_answer_sheet;
  const finalMarks = teacherMarks ?? aiMarks;
  const confidenceLabel = confidence >= 0.75 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low';
  const confidenceColor = confidence >= 0.75 ? 'green' : confidence >= 0.5 ? 'orange' : 'red';
  const formatLabel = (key) => key.replace('_score', '').replace('_', ' ');
  const scoreRows = score_breakdown
    ? Object.entries(score_breakdown).map(([key, val]) => ({
        key,
        label: formatLabel(key),
        value: Number(val) || 0,
        weight: scoring_weights?.[key] ?? null,
      }))
    : [];

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
            {scoreRows.map(({ key, label, value, weight }) => (
              <div key={key} className="score-bar-row">
                <span className="score-bar-label">
                  {label}
                </span>
                <div className="score-bar-track">
                  <div
                    className="score-bar-fill"
                    style={{ width: `${(value * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="score-bar-value">{(value * 100).toFixed(0)}%</span>
                {weight != null && (
                  <span className="score-bar-weight">
                    weight {(weight * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {mark_calculation && (
        <div className="feedback-section evaluation-basis">
          <h4><Info size={14} /> How Marks Were Allocated</h4>
          <div className="basis-summary">
            <div>
              <span>Weighted score</span>
              <strong>{((mark_calculation.weighted_score ?? 0) * 100).toFixed(1)}%</strong>
            </div>
            <div>
              <span>Calculated marks</span>
              <strong>
                {(mark_calculation.awarded_marks ?? aiMarks)?.toFixed?.(1) ?? mark_calculation.awarded_marks}
                {' / '}
                {mark_calculation.total_marks ?? totalMarks}
              </strong>
            </div>
          </div>
          <p className="formula-text">{mark_calculation.formula}</p>
          {mark_calculation.basis?.length > 0 && (
            <ul className="basis-list">
              {mark_calculation.basis.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
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

      {extractedText && (
        <div className="feedback-section extracted-answer">
          <h4>Text Extracted From Image</h4>
          <p>{extractedText}</p>
        </div>
      )}

    </div>
  );
}
