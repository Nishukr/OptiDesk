// src/components/Navbar.jsx
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isStaff = user && (user.role === 'agent' || user.role === 'admin');

  return (
    <nav className="navbar">
      <Link to="/" className="brand">🎧 AI Helpdesk</Link>
      <div className="nav-links">
        {user && !isStaff && <Link to="/">My Tickets</Link>}
        {isStaff && <Link to="/admin">Dashboard</Link>}
        {isStaff && <Link to="/admin/customers">Customers</Link>}
        {user ? (
          <>
            <span className="badge">{user.name || user.email} · {user.role}</span>
            <button className="btn-ghost" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
