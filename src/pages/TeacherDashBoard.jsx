import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, Users, BookOpen, Trash2, BarChart2 } from 'lucide-react';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [className, setClassName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchClassrooms(); }, []);

  const fetchClassrooms = async () => {
    try {
      const res = await api.get('/api/teacher/classrooms');
      setClassrooms(res.data);
    } catch {
      toast.error('Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  };

  const createClassroom = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/api/teacher/classrooms', { className });
      toast.success('Classroom created!');
      setClassName('');
      setShowCreate(false);
      fetchClassrooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create classroom');
    } finally {
      setCreating(false);
    }
  };

  const archiveClassroom = async (id) => {
    if (!confirm('Archive this classroom?')) return;
    try {
      await api.delete(`/api/teacher/classrooms/${id}`);
      toast.success('Classroom archived');
      fetchClassrooms();
    } catch {
      toast.error('Failed to archive classroom');
    }
  };

  if (loading) return <div className="loading">Loading classrooms...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>My Classrooms</h2>
          <p className="page-subtitle">{classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} /> New Classroom
        </button>
      </div>

      {/* Create classroom form */}
      {showCreate && (
        <div className="card create-form">
          <h3>Create Classroom</h3>
          <form onSubmit={createClassroom} className="inline-form">
            <input
              type="text"
              placeholder="e.g. Data Structures — Batch A"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              required
              minLength={3}
            />
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Classroom grid */}
      {classrooms.length === 0 ? (
        <div className="empty-state-page">
          <BookOpen size={48} />
          <p>No classrooms yet. Create your first one!</p>
        </div>
      ) : (
        <div className="card-grid">
          {classrooms.map((c) => (
            <div key={c.id} className="classroom-card">
              <div className="classroom-card-header">
                <h3 onClick={() => navigate(`/teacher/classroom/${c.id}`)}>{c.className}</h3>
                <button className="btn-icon danger" onClick={() => archiveClassroom(c.id)}>
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="class-code">
                Code: <strong>{c.classCode}</strong>
              </div>

              <div className="classroom-stats">
                <span><Users size={14} /> {c.studentCount} students</span>
                <span><BookOpen size={14} /> {c.examCount} exams</span>
              </div>

              <div className="classroom-actions">
                <button
                  className="btn-secondary"
                  onClick={() => navigate(`/teacher/classroom/${c.id}`)}
                >
                  View Classroom
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => navigate(`/teacher/classroom/${c.id}/analytics`)}
                >
                  <BarChart2 size={14} /> Analytics
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}