import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { CheckCircle, Clock, AlertCircle, Eye, Download } from 'lucide-react';
import { downloadReport } from '../api/reports';

export default function ReviewQueuePage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => { fetchData(); }, [examId]);

  const fetchData = async () => {
    try {
      const [examRes, subRes] = await Promise.all([
        api.get(`/api/exams/${examId}`),
        api.get(`/api/teacher/exams/${examId}/submissions`),
      ]);
      setExam(examRes.data);
      setSubmissions(subRes.data);
    } catch {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status) => {
    if (status === 'REVIEWED') return <CheckCircle size={14} className="icon-green" />;
    if (status === 'AI_EVALUATED') return <AlertCircle size={14} className="icon-orange" />;
    if (status === 'PROCESSING') return <Clock size={14} className="icon-blue" />;
    return <Clock size={14} className="icon-gray" />;
  };

  const filtered = submissions.filter((s) => {
    if (filter === 'ALL') return true;
    return s.status === filter;
  });

  const counts = {
    ALL: submissions.length,
    PENDING: submissions.filter((s) => s.status === 'PENDING').length,
    PROCESSING: submissions.filter((s) => s.status === 'PROCESSING').length,
    AI_EVALUATED: submissions.filter((s) => s.status === 'AI_EVALUATED').length,
    REVIEWED: submissions.filter((s) => s.status === 'REVIEWED').length,
  };

  if (loading) return <div className="loading">Loading submissions...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>{exam?.title}</h2>
          <p className="page-subtitle">
            {exam?.classroomName} · {exam?.totalMarks} marks ·{' '}
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              await downloadReport('exam', examId);
              toast.success('Report downloaded!');
            } catch {
              toast.error('Failed to download report');
            }
          }}
        >
          <Download size={15} /> Download Report
        </button>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {Object.entries(counts).map(([key, count]) => (
          <button
            key={key}
            className={`filter-tab ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {key.replace('_', ' ')}
            <span className="tab-count">{count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state-page">
          <CheckCircle size={48} />
          <p>No submissions in this category.</p>
        </div>
      ) : (
        <div className="card">
          <table className="results-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>AI Marks</th>
                <th>Final Marks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.studentName}</strong></td>
                  <td>
                    {new Date(s.submittedAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td>
                    <span className="status-badge">
                      {statusIcon(s.status)}
                      {s.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{s.aiMarks != null ? `${s.aiMarks.toFixed(1)} / ${exam?.totalMarks}` : '—'}</td>
                  <td>{s.finalMarks != null ? `${s.finalMarks.toFixed(1)} / ${exam?.totalMarks}` : '—'}</td>
                  <td>
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => navigate(`/teacher/review/${s.id}`)}
                      disabled={s.status === 'PENDING' || s.status === 'PROCESSING'}
                    >
                      <Eye size={13} />
                      {s.status === 'REVIEWED' ? 'View' : 'Review'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}