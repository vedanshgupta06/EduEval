import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, BookOpen } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <BookOpen size={22} />
        <span>EduEval</span>
      </div>

      {user && (
        <div className="navbar-right">
          <Link
            to={user.role === 'TEACHER' ? '/teacher' : '/student'}
            className="nav-link"
          >
            Dashboard
          </Link>
          <span className="nav-role">{user.role}</span>
          <span className="nav-name">{user.name}</span>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}