import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Users, FileText, TrendingUp, AlertCircle, Download } from 'lucide-react';
import { downloadReport } from '../api/reports';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#4f46e5', '#16a34a', '#d97706', '#dc2626', '#0891b2'];

export default function AnalyticsPage() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [classroomId]);

  const fetchData = async () => {
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
  };

  if (loading) return <div className="loading">Loading analytics...</div>;
  if (!analytics) return <div className="error">No analytics available yet.</div>;

  // Prepare chart data
  const examPerformanceData = analytics.examStats?.map((e) => ({
    name: e.examTitle?.length > 15 ? e.examTitle.substring(0, 15) + '...' : e.examTitle,
    average: parseFloat((e.averageMarks || 0).toFixed(1)),
    submissions: e.submissionCount || 0,
    total: e.totalMarks || 10,
  })) || [];

  const submissionStatusData = [
    { name: 'Reviewed',     value: analytics.reviewedCount     || 0 },
    { name: 'AI Evaluated', value: analytics.aiEvaluatedCount  || 0 },
    { name: 'Processing',   value: analytics.processingCount   || 0 },
    { name: 'Pending',      value: analytics.pendingCount      || 0 },
  ].filter(d => d.value > 0);

  const weakKeywords = analytics.weakKeywords || [];

  return (
    <div className="page">
      <button className="btn-back" onClick={() => navigate(`/teacher/classroom/${classroomId}`)}>
        <ArrowLeft size={16} /> Back to Classroom
      </button>

      <div className="page-header">
        <div>
          <h2>{classroom?.className} — Analytics</h2>
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
          <Download size={15} /> Download Full Report
        </button>
      </div>

      {/* Summary stats */}
      <div className="analytics-stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ede9fe' }}>
            <Users size={20} color="#4f46e5" />
          </div>
          <div>
            <p className="stat-label">Total Students</p>
            <p className="stat-value">{analytics.totalStudents || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7' }}>
            <FileText size={20} color="#16a34a" />
          </div>
          <div>
            <p className="stat-label">Total Exams</p>
            <p className="stat-value">{analytics.totalExams || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef9c3' }}>
            <TrendingUp size={20} color="#d97706" />
          </div>
          <div>
            <p className="stat-label">Avg Score</p>
            <p className="stat-value">
              {analytics.overallAverage != null
                ? `${analytics.overallAverage.toFixed(1)}%`
                : '—'}
            </p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fee2e2' }}>
            <AlertCircle size={20} color="#dc2626" />
          </div>
          <div>
            <p className="stat-label">Pending Reviews</p>
            <p className="stat-value">{analytics.pendingReviews || 0}</p>
          </div>
        </div>
      </div>

      {/* Exam performance chart */}
      {examPerformanceData.length > 0 && (
        <div className="card">
          <h3>Average Marks per Exam</h3>
          <p className="page-subtitle" style={{ marginBottom: '1rem' }}>
            Average AI + teacher marks across all submissions
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={examPerformanceData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [
                  name === 'average' ? `${value} marks` : value,
                  name === 'average' ? 'Average Marks' : 'Submissions'
                ]}
              />
              <Bar dataKey="average" fill="#4f46e5" radius={[4, 4, 0, 0]} name="average" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="analytics-two-col">

        {/* Submission status pie */}
        {submissionStatusData.length > 0 && (
          <div className="card">
            <h3>Submission Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={submissionStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {submissionStatusData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Weak keywords */}
        <div className="card">
          <h3>Commonly Missed Keywords</h3>
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
                    <div
                      className="weak-keyword-bar-fill"
                      style={{ width: `${kw.missRate * 100}%` }}
                    />
                  </div>
                  <span className="weak-keyword-rate">
                    {(kw.missRate * 100).toFixed(0)}% missed
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Per exam breakdown table */}
      {examPerformanceData.length > 0 && (
        <div className="card">
          <h3>Exam Breakdown</h3>
          <table className="results-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Total Marks</th>
                <th>Submissions</th>
                <th>Average Marks</th>
                <th>Avg %</th>
              </tr>
            </thead>
            <tbody>
              {analytics.examStats?.map((e) => (
                <tr key={e.examId}>
                  <td><strong>{e.examTitle}</strong></td>
                  <td>{e.totalMarks}</td>
                  <td>{e.submissionCount}</td>
                  <td>{e.averageMarks != null ? e.averageMarks.toFixed(1) : '—'}</td>
                  <td>
                    {e.averageMarks != null && e.totalMarks
                      ? `${((e.averageMarks / e.totalMarks) * 100).toFixed(0)}%`
                      : '—'}
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