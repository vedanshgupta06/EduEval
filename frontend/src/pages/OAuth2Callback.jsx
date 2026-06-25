import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function OAuth2Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const isNewUser = searchParams.get('newUser') === 'true';

    if (!token) {
      toast.error('Google login failed. Please try again.');
      navigate('/login');
      return;
    }

    api.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        login(res.data, token);
        if (isNewUser) {
          toast.success(`Welcome, ${res.data.name}! Please select your role.`);
          navigate('/select-role');
        } else {
          toast.success(`Welcome back, ${res.data.name}!`);
          navigate(res.data.role === 'TEACHER' ? '/teacher' : '/student');
        }
      })
      .catch(() => {
        toast.error('Google login failed. Please try again.');
        navigate('/login');
      });
  }, []);

  return (
    <div className="auth-page">
      <div style={{ textAlign: 'center', marginTop: '40vh' }}>
        <p>Signing you in with Google...</p>
      </div>
    </div>
  );
}