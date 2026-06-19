import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { BookOpen } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', form);
      const { token, ...userData } = res.data;
      login(userData, token);
      toast.success(`Welcome back, ${userData.name}!`);
      navigate(userData.role === 'TEACHER' ? '/teacher' : '/student');
    } catch (err) {
      const message = err.response?.data?.message || 'Incorrect email or password';
      setErrorMessage(message);
      toast.error(message);
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
            <p>
              Upload answer sheets, extract handwritten text, and compare student
              responses with teacher model answers in one focused workspace.
            </p>
          </div>
        </section>

        <div className="auth-card">
          <div className="auth-logo">
            <BookOpen size={28} />
            <h1>EduEval</h1>
          </div>
          <h2>Sign in</h2>
          <p className="auth-subtitle">Continue your classroom evaluation</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
            {errorMessage && (
              <div className="form-error" style={{ color: '#dc2626', marginBottom: '1rem' }}>
                {errorMessage}
              </div>
            )}

            <div className="auth-options">
              <label>
                <input type="checkbox" defaultChecked />
                Remember me
              </label>
              <span>Forgot password?</span>
            </div>

            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account? <Link to="/register">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
