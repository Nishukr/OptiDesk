// src/pages/AdminRegister.jsx — create a STAFF (admin) account. Custom JWT + Resend.
//
// Was the "Support admin" half of src/pages/Register.jsx; the "Customer" half moved
// to Clerk, so the role picker is gone and this form only ever creates an admin.
// The server enforces the same thing — POST /api/auth/register refuses role
// "customer" and points at /signup.
//
// The flow it preserves: register → account starts unverified → Resend emails a
// link → /verify-notice → /verify-email. That is the only remaining consumer of
// services/mailer.js, which is why this page still exists rather than leaving
// "npm run seed:admin" as the sole way in.
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import PasswordField from '../components/PasswordField';

export default function AdminRegister() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await register(name, email, password, 'admin', adminCode || undefined);
      // Nothing to log into yet — go and tell them to check their inbox.
      // `cfg` carries WHY a send failed, so the notice page does not blame the
      // .env when the credentials are actually present.
      const q = new URLSearchParams({
        email,
        sent: res.emailSent ? '1' : '0',
        cfg: res.mailConfigured === false ? '0' : '1',
      });
      navigate(`/verify-notice?${q}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create an admin account"
      subtitle="Staff only. You will need the sign-up code from the server configuration."
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="alert">{error}</div>}

        <label htmlFor="reg-name">Full name</label>
        <input
          id="reg-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="Nishu Kumar"
          required
        />

        <label htmlFor="reg-email">Work email address</label>
        <input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@company.com"
          required
          aria-describedby="reg-email-hint"
        />
        <p id="reg-email-hint" className="muted small" style={{ margin: '6px 0 0' }}>
          We send a verification link here — you cannot log in until you open it.
        </p>

        <label htmlFor="reg-pass">Password</label>
        <PasswordField
          id="reg-pass"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={6}
          placeholder="At least 6 characters"
        />

        <label htmlFor="reg-code">Admin sign-up code</label>
        <PasswordField
          id="reg-code"
          value={adminCode}
          onChange={(e) => setAdminCode(e.target.value)}
          autoComplete="off"
          placeholder="From the server .env"
        />
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Set as <code>ADMIN_SIGNUP_CODE</code> in the server <code>.env</code>. Without it, anyone
          could sign up as admin and read every customer&rsquo;s tickets.
        </p>

        <button className="btn" disabled={busy}>
          {busy ? 'Creating account…' : 'Create admin account'}
        </button>
      </form>

      <p className="auth-foot">
        Already have a staff account? <Link to="/admin/login">Sign in</Link>
      </p>
      <p className="muted small">
        Looking to raise a support ticket? <Link to="/signup">Create a customer account</Link>.
      </p>
    </AuthLayout>
  );
}
