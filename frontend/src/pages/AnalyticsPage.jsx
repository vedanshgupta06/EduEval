import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Users, FileText, TrendingUp, AlertCircle, Download } from 'lucide-react';
import { downloadReport } from '../api/reports';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#4f46e5', '#16a34a', '#d97706', '#dc2626', '#0891b2'];

function getPillClass(pct) {
  if (pct >= 75) return 'deadline-badge active';
  if (pct >= 50) return 'deadline-badge';
  return 'deadline-badge past';
}

function getPillStyle(pct) {
  if (pct >= 75) return {};
  if (pct >= 50) return { background: '#fef9c3', color: '#d97706' };
  return {};
}

export default function AnalyticsPage() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [classRes, analyticsRes] = await Promise.all([
        api.get(`/api/classrooms/${classroomId}`),
        api.get(`/api/teacher/classrooms/${classroomId}/analytics`),
      ]);
      setClassroom(classRes.data);
      setAnalytics(analyticsRes.data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading">Loading analytics...</div>;
  if (!analytics) return <div className="error">No analytics available yet.</div>;

  // ── map API field names to chart data ──────────────────────────────────────
  // API: examBreakdown[], overallAverageMarks, pendingReviewCount (per exam)

  const examBreakdown = analytics.examBreakdown || analytics.examStats || [];

  // only include exams that have an averageMarks value for the bar chart
  const examPerformanceData = examBreakdown
    .filter(e => e.averageMarks != null)
    .map(e => ({
      name: e.examTitle?.length > 15 ? e.examTitle.substring(0, 15) + '...' : e.examTitle,
      average: parseFloat(e.averageMarks.toFixed(1)),
      submissions: e.submissionCount || 0,
      total: e.totalMarks || 10,
    }));

  // submission status: aggregate across all exams
  const totalReviewed    = examBreakdown.reduce((s, e) => s + (e.reviewedCount        || 0), 0);
  const totalPendingRev  = examBreakdown.reduce((s, e) => s + (e.pendingReviewCount   || 0), 0);
  const totalSubmissions = examBreakdown.reduce((s, e) => s + (e.submissionCount      || 0), 0);
  // "pending eval" = submitted but not reviewed and not pending-review (still being AI-processed)
  const totalPendingEval = Math.max(0, totalSubmissions - totalReviewed - totalPendingRev);

  const submissionStatusData = [
    { name: 'Reviewed',       value: totalReviewed    },
    { name: 'Pending review', value: totalPendingRev  },
    { name: 'Pending eval',   value: totalPendingEval },
  ].filter(d => d.value > 0);

  // total pending = waiting for teacher review + still being AI-evaluated
  const totalPendingReviews = totalPendingRev + totalPendingEval;

  const weakKeywords = analytics.weakKeywords || [];

  // overall avg — API uses overallAverageMarks
  const overallAvg = analytics.overallAverageMarks ?? analytics.overallAverage ?? null;

  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <button className="btn-back" onClick={() => navigate(`/teacher/classroom/${classroomId}`)}>
            <ArrowLeft size={15} /> Back to Classroom
          </button>
          <h2>{analytics.classroomName || classroom?.className} — Analytics</h2>
          <p className="page-subtitle">Performance overview across all exams</p>
        </div>
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              await downloadReport('classroom', classroomId);
              toast.success('Report downloaded!');
            } catch {
              toast.error('Failed to download report');
            }
          }}
        >
          <Download size={15} /> Download report
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="analytics-stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ede9fe' }}>
            <Users size={20} color="#4f46e5" />
          </div>
          <div>
            <p className="stat-label">Total students</p>
            <p className="stat-value">{analytics.totalStudents || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7' }}>
            <FileText size={20} color="#16a34a" />
          </div>
          <div>
            <p className="stat-label">Total exams</p>
            <p className="stat-value">{analytics.totalExams || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef9c3' }}>
            <TrendingUp size={20} color="#d97706" />
          </div>
          <div>
            <p className="stat-label">Avg marks</p>
            <p className="stat-value">
              {overallAvg != null ? `${overallAvg.toFixed(1)}` : '—'}
            </p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fee2e2' }}>
            <AlertCircle size={20} color="#dc2626" />
          </div>
          <div>
            <p className="stat-label">Pending</p>
            <p className="stat-value">{totalPendingReviews}</p>
          </div>
        </div>
      </div>

      {/* ── Bar chart ── */}
      {examPerformanceData.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '0.25rem' }}>Average marks per exam</h3>
          <p className="page-subtitle" style={{ marginBottom: '1.25rem' }}>
            AI + teacher marks averaged across all submissions
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={examPerformanceData} margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                formatter={(value, name) => [
                  name === 'average' ? `${value} marks` : value,
                  name === 'average' ? 'Average marks' : 'Submissions',
                ]}
              />
              <Bar dataKey="average" fill="#4f46e5" radius={[4, 4, 0, 0]} name="average" maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Pie + Keywords ── */}
      <div className={submissionStatusData.length > 0 ? 'analytics-two-col' : ''}>

        {submissionStatusData.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '0.25rem' }}>Submission status</h3>
            <p className="page-subtitle" style={{ marginBottom: '1rem' }}>
              Breakdown of all student submissions
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', marginBottom: '0.75rem' }}>
              {submissionStatusData.map((d, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                  {d.name} — {d.value}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={submissionStatusData}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={90}
                  paddingAngle={3} dataKey="value"
                >
                  {submissionStatusData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Keywords */}
        <div className="card">
          <h3 style={{ marginBottom: '0.25rem' }}>Commonly missed keywords</h3>
          <p className="page-subtitle" style={{ marginBottom: '1rem' }}>
            Topics students frequently miss across exams
          </p>
          {weakKeywords.length === 0 ? (
            <p className="empty-state">Not enough data yet.</p>
          ) : (
            <div className="weak-keywords-list">
              {weakKeywords.slice(0, 8).map((kw, i) => (
                <div key={i} className="weak-keyword-row">
                  <span className="weak-keyword-name">{kw.keyword}</span>
                  <div className="weak-keyword-bar-track">
                    <div className="weak-keyword-bar-fill" style={{ width: `${kw.missRate * 100}%` }} />
                  </div>
                  <span className="weak-keyword-rate">{(kw.missRate * 100).toFixed(0)}% missed</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Exam breakdown table ── */}
      {examBreakdown.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Exam breakdown</h3>
          <table className="results-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Total marks</th>
                <th>Submissions</th>
                <th>Avg marks</th>
                <th>Avg %</th>
                <th>Highest</th>
                <th>Lowest</th>
              </tr>
            </thead>
            <tbody>
              {examBreakdown.map((e) => {
                const pct = e.averageMarks != null && e.totalMarks
                  ? Math.round((e.averageMarks / e.totalMarks) * 100)
                  : null;
                return (
                  <tr key={e.examId}>
                    <td><strong>{e.examTitle}</strong></td>
                    <td>{e.totalMarks}</td>
                    <td>
                      {e.submissionCount}
                      <span className="field-hint" style={{ marginLeft: 4 }}>
                        / {e.totalStudents} ({Math.round(e.submissionRate || 0)}%)
                      </span>
                    </td>
                    <td>{e.averageMarks != null ? e.averageMarks.toFixed(1) : '—'}</td>
                    <td>
                      {pct != null ? (
                        <span className={getPillClass(pct)} style={getPillStyle(pct)}>
                          {pct}%
                        </span>
                      ) : '—'}
                    </td>
                    <td>{e.highestMarks != null ? e.highestMarks.toFixed(1) : '—'}</td>
                    <td>{e.lowestMarks  != null ? e.lowestMarks.toFixed(1)  : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}