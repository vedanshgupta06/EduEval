import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Users, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function getGradeBadge(pct) {
  if (pct >= 80) return { bg: '#dcfce7', color: '#15803d' };
  if (pct >= 50) return { bg: '#fef9c3', color: '#a16207' };
  return { bg: '#fee2e2', color: '#b91c1c' };
}

function statusLabel(status) {
  const labels = {
    PENDING: 'Awaiting evaluation',
    PROCESSING: 'AI evaluating',
    AI_EVALUATED: 'Awaiting review',
    REVIEWED: 'Reviewed',
    RESUBMIT: 'Resubmit requested',
  };
  return labels[status] || status;
}

export default function ExamAnalyticsPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [examRes, analyticsRes, subsRes] = await Promise.all([
        api.get(`/api/exams/${examId}`),
        api.get(`/api/teacher/exams/${examId}/analytics`),
        api.get(`/api/teacher/exams/${examId}/submissions`),
      ]);
      setExam(examRes.data);
      setAnalytics(analyticsRes.data);
      setSubmissions(subsRes.data);
    } catch {
      toast.error('Failed to load exam analytics');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading">Loading exam analytics...</div>;
  if (!analytics) return <div className="error">No analytics available yet.</div>;

  const totalMarks = analytics.totalMarks || exam?.totalMarks || 0;

  // ── score distribution: bucket each student's marks into 5 bands ──────────
  const bands = [
    { name: '0-20%', min: 0, max: 20 },
    { name: '20-40%', min: 20, max: 40 },
    { name: '40-60%', min: 40, max: 60 },
    { name: '60-80%', min: 60, max: 80 },
    { name: '80-100%', min: 80, max: 100 },
  ];

  const scoredSubmissions = submissions.filter(
    (s) => (s.finalMarks ?? s.aiMarks) != null && totalMarks > 0
  );

  const distributionData = bands.map((band) => ({
    name: band.name,
    count: scoredSubmissions.filter((s) => {
      const pct = ((s.finalMarks ?? s.aiMarks) / totalMarks) * 100;
      return band.max === 100
        ? pct >= band.min && pct <= band.max
        : pct >= band.min && pct < band.max;
    }).length,
  }));

  const pendingCount = analytics.pendingReviewCount ?? 0;

  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <button className="btn-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={15} /> Back
          </button>
          <h2>{analytics.examTitle}</h2>
          <p className="page-subtitle">
            {exam?.classroomName ? `${exam.classroomName} · ` : ''}{totalMarks} marks
            {exam?.isMultiQuestion ? ' · Multi-question exam' : ''}
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="analytics-stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--primary-bg, #e8f5ff)' }}>
            <Users size={20} color="#0b83db" />
          </div>
          <div>
            <p className="stat-label">Submitted</p>
            <p className="stat-value">
              {analytics.submissionCount} / {analytics.totalStudents}
            </p>
            <p className="field-hint">{Math.round(analytics.submissionRate || 0)}% submission rate</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7' }}>
            <FileText size={20} color="#16a34a" />
          </div>
          <div>
            <p className="stat-label">Reviewed</p>
            <p className="stat-value">{analytics.reviewedCount || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef9c3' }}>
            <TrendingUp size={20} color="#d97706" />
          </div>
          <div>
            <p className="stat-label">Avg / Highest / Lowest</p>
            <p className="stat-value" style={{ fontSize: '1.1rem' }}>
              {analytics.averageMarks != null ? analytics.averageMarks.toFixed(1) : '—'}
              {' / '}
              {analytics.highestMarks != null ? analytics.highestMarks.toFixed(1) : '—'}
              {' / '}
              {analytics.lowestMarks != null ? analytics.lowestMarks.toFixed(1) : '—'}
            </p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fee2e2' }}>
            <AlertCircle size={20} color="#dc2626" />
          </div>
          <div>
            <p className="stat-label">Pending review</p>
            <p className="stat-value">{pendingCount}</p>
          </div>
        </div>
      </div>

      {/* ── Score distribution ── */}
      {scoredSubmissions.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '0.25rem' }}>Score distribution</h3>
          <p className="page-subtitle" style={{ marginBottom: '1.25rem' }}>
            How many students fall in each score band
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={distributionData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                formatter={(value) => [`${value} student${value === 1 ? '' : 's'}`, 'Count']}
              />
              <Bar dataKey="count" fill="#0b83db" radius={[4, 4, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Per-student table ── */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Student scores</h3>
        {submissions.length === 0 ? (
          <p className="empty-state">No submissions yet.</p>
        ) : (
          <table className="results-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>AI marks</th>
                <th>Final marks</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const mark = s.finalMarks ?? s.aiMarks;
                const pct = mark != null && totalMarks > 0
                  ? Math.round((mark / totalMarks) * 100)
                  : null;
                const badge = pct != null ? getGradeBadge(pct) : null;
                return (
                  <tr key={s.id}>
                    <td><strong>{s.studentName}</strong></td>
                    <td>
                      <span className="deadline-badge" style={
                        s.status === 'REVIEWED' ? { background: '#dcfce7', color: '#15803d' }
                        : s.status === 'RESUBMIT' ? { background: '#fee2e2', color: '#b91c1c' }
                        : {}
                      }>
                        {statusLabel(s.status)}
                      </span>
                    </td>
                    <td>{s.aiMarks != null ? s.aiMarks.toFixed(1) : '—'}</td>
                    <td>{s.finalMarks != null ? s.finalMarks.toFixed(1) : '—'}</td>
                    <td>
                      {pct != null ? (
                        <span className="deadline-badge" style={badge}>{pct}%</span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}