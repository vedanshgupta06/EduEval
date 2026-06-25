import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { BookOpen, GraduationCap } from 'lucide-react';

export default function SelectRolePage() {
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const handleConfirm = async () => {
    if (!selectedRole) {
      toast.error('Please select a role to continue.');
      return;
    }
    setLoading(true);
    try {
      await api.put('/api/auth/set-role', { role: selectedRole });
      updateUser({ ...user, role: selectedRole });
      toast.success(`You're all set as a ${selectedRole.toLowerCase()}!`);
      navigate(selectedRole === 'TEACHER' ? '/teacher' : '/student');
    } catch{
      toast.error('Failed to set role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-welcome">
          <div className="auth-brand">
            <BookOpen size={30} />
            <span>EduEval</span>
          </div>
          <div className="auth-welcome-copy">
            <h1>WELCOME</h1>
            <h2>AI-Powered Answer Evaluation</h2>
            <p>Select your role to get started with your personalized workspace.</p>
          </div>
        </section>

        <div className="auth-card">
          <div className="auth-logo">
            <BookOpen size={28} />
            <h1>EduEval</h1>
          </div>
          <h2>Select your role</h2>
          <p className="auth-subtitle">Choose how you'll use EduEval</p>

          <div style={{ display: 'flex', gap: '1rem', margin: '2rem 0' }}>
            <div
              onClick={() => setSelectedRole('STUDENT')}
              style={{
                flex: 1,
                padding: '1.5rem',
                border: `2px solid ${selectedRole === 'STUDENT' ? '#6366f1' : '#e5e7eb'}`,
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'center',
                background: selectedRole === 'STUDENT' ? '#eef2ff' : 'white',
                transition: 'all 0.2s'
              }}
            >
              <GraduationCap size={36} style={{ color: '#6366f1', marginBottom: '0.5rem' }} />
              <h3 style={{ margin: '0.5rem 0' }}>Student</h3>
              <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                Take exams and view your results
              </p>
            </div>

            <div
              onClick={() => setSelectedRole('TEACHER')}
              style={{
                flex: 1,
                padding: '1.5rem',
                border: `2px solid ${selectedRole === 'TEACHER' ? '#6366f1' : '#e5e7eb'}`,
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'center',
                background: selectedRole === 'TEACHER' ? '#eef2ff' : 'white',
                transition: 'all 0.2s'
              }}
            >
              <BookOpen size={36} style={{ color: '#6366f1', marginBottom: '0.5rem' }} />
              <h3 style={{ margin: '0.5rem 0' }}>Teacher</h3>
              <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                Create exams and evaluate students
              </p>
            </div>
          </div>

          <button
            className="btn-primary auth-submit"
            onClick={handleConfirm}
            disabled={!selectedRole || loading}
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}