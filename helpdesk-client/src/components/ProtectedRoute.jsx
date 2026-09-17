// src/components/ProtectedRoute.jsx — the STAFF guard (custom JWT).
//
// Customers are guarded by <CustomerRoute>, which checks Clerk. This one is now
// exclusively about agents and admins: it reads the JWT context, and sends anyone
// without one to the staff form at /admin/login — never to /login, which belongs
// to Clerk and would bounce a staff member into the wrong sign-in.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="container"><p className="muted">Loading…</p></div>;

  // `from` lets /admin/login return them to the page they actually asked for.
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location }} />;

  // A signed-in customer reaching a staff route: home, not the staff sign-in.
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
