// src/pages/AdminLogin.jsx — STAFF sign-in. Custom JWT, deliberately not Clerk.
//
// Was src/pages/Login.jsx, moved to /admin/login when customers went to Clerk. The
// mechanism is unchanged on purpose: POST /api/auth/login → JWT in localStorage →
// AuthContext, plus the 403 + needsVerification branch that drives the Resend
// verification email. Agents and admins are not in Clerk at all, so this form is
// the only way into the staff console.
import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import PasswordField from '../components/PasswordField';
import api from '../api/axios';

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // The server answers 403 + needsVerification when the password is right but
  // the address was never confirmed. That is a different problem from a bad
  // password, so it gets its own message and a resend button.
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState('');
  const [busy, setBusy] = useState(false);

  // Where ProtectedRoute bounced them from, if anywhere.
  const from = location.state?.from?.pathname || '/admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setUnverified(false);
    setResent('');
    setBusy(true);
    try {
      await login(email, password);
      // Only agents and admins can authenticate here — the API refuses customer
      // rows on this endpoint and points them at Clerk — so the staff console is
      // always the right destination.
      navigate(from, { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 403 && data?.needsVerification) setUnverified(true);
      setError(data?.error || 'Login failed. Check your email and password.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResent('');
    try {
      const res = await api.post('/auth/resend', { email });
      setResent(res.data.message || 'Verification email sent.');
    } catch (err) {
      setResent(err.response?.data?.error || 'Could not resend the email.');
    }
  };

  return (
    <AuthLayout title="Staff sign-in" subtitle="For OptiDesk support agents and administrators.">
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="alert">{error}</div>}

        {unverified && (
          <div className="notice">
            Your email address is not verified yet.{' '}
            <button type="button" className="link-btn" onClick={resend}>
              Resend the link
            </button>
            {resent && <div className="small" style={{ marginTop: 6 }}>{resent}</div>}
          </div>
        )}

        <label htmlFor="login-email">Work email address</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@company.com"
          required
        />

        <label htmlFor="login-pass">Password</label>
        <PasswordField
          id="login-pass"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
        />

        <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>

      <p className="auth-foot">
        Need an admin account? <Link to="/admin/register">Register with your sign-up code</Link>
      </p>
      <p className="muted small">
        Are you a customer? <Link to="/login">Sign in here instead</Link>.
      </p>
    </AuthLayout>
  );
}
