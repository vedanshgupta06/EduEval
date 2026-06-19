import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { BookOpen, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [classRes, progressRes] = await Promise.all([
        api.get('/api/student/classrooms'),
        api.get('/api/student/analytics'),
      ]);
      setClassrooms(classRes.data);
      setProgress(progressRes.data);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const joinClassroom = async (e) => {
    e.preventDefault();
    setJoining(true);
    try {
      await api.post('/api/student/classrooms/join', { classCode: joinCode.toUpperCase() });
      toast.success('Joined classroom!');
      setJoinCode('');
      setShowJoin(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid class code');
    } finally {
      setJoining(false);
    }
  };

  const statusIcon = (status) => {
    if (status === 'REVIEWED') return <CheckCircle size={14} className="icon-green" />;
    if (status === 'AI_EVALUATED') return <AlertCircle size={14} className="icon-orange" />;
    return <Clock size={14} className="icon-gray" />;
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div className="page">

      {/* Join classroom */}
      <div className="page-header">
        <div>
          <h2>My Classrooms</h2>
          <p className="page-subtitle">{classrooms.length} enrolled</p>
        </div>
        <button className="btn-primary" onClick={() => setShowJoin(!showJoin)}>
          + Join Classroom
        </button>
      </div>

      {showJoin && (
        <div className="card create-form">
          <h3>Enter Class Code</h3>
          <form onSubmit={joinClassroom} className="inline-form">
            <input
              type="text"
              placeholder="e.g. CS101A4X"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
              style={{ textTransform: 'uppercase' }}
            />
            <button type="submit" className="btn-primary" disabled={joining}>
              {joining ? 'Joining...' : 'Join'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowJoin(false)}>
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Classrooms */}
      {classrooms.length === 0 ? (
        <div className="empty-state-page">
          <BookOpen size={48} />
          <p>You haven't joined any classrooms yet.</p>
        </div>
      ) : (
        <div className="card-grid">
          {classrooms.map((c) => (
            <div
              key={c.id}
              className="classroom-card clickable"
              onClick={() => navigate(`/student/classroom/${c.id}`)}
            >
              <h3>{c.className}</h3>
              <p className="teacher-name">by {c.teacherName}</p>
              <div className="classroom-stats">
                <span><BookOpen size={14} /> {c.examCount} exams</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      {progress.length > 0 && (
        <>
          <h2 style={{ marginTop: '2rem' }}>My Results</h2>
          <div className="card">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Classroom</th>
                  <th>Marks</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p) => (
                  <tr key={p.submissionId}>
                    <td>{p.examTitle}</td>
                    <td>{p.classroomName}</td>
                    <td>
                      {p.marksObtained != null
                        ? `${p.marksObtained.toFixed(1)} / ${p.totalMarks}`
                        : '—'}
                    </td>
                    <td>
                      <span className="status-badge">
                        {statusIcon(p.reviewed ? 'REVIEWED' : 'AI_EVALUATED')}
                        {p.reviewed ? 'Reviewed' : 'AI_EVALUATED'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-link"
                        onClick={() => navigate(`/student/result/${p.submissionId}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
