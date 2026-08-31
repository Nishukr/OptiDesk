// src/pages/Register.jsx — sign up as a customer or as a support admin
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  {
    value: 'customer',
    title: 'Customer',
    blurb: 'Raise tickets about your problem and chat with the AI assistant.',
    icon: '🙋',
  },
  {
    value: 'admin',
    title: 'Support admin',
    blurb: 'See every ticket, who raised it, and change its status. Needs a sign-up code.',
    icon: '🛠️',
  },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('customer');
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
      const user = await register(name, email, password, role, adminCode || undefined);
      // Send each role to its own home screen.
      const isStaff = user.role === 'agent' || user.role === 'admin';
      navigate(isStaff ? '/admin' : '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="card">
        <h1>Create your account</h1>
        <p className="muted">Choose how you want to use the helpdesk.</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert">{error}</div>}

          <fieldset className="roles">
            <legend>I am registering as</legend>
            {ROLES.map((r) => (
              <label key={r.value} className={`role-opt ${role === r.value ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                />
                <span className="role-icon" aria-hidden="true">{r.icon}</span>
                <span className="role-text">
                  <span className="role-title">{r.title}</span>
                  <span className="role-blurb">{r.blurb}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label htmlFor="reg-name">Name</label>
          <input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} required />

          <label htmlFor="reg-email">Email</label>
          <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label htmlFor="reg-pass">Password</label>
          <input
            id="reg-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {role === 'admin' && (
            <>
              <label htmlFor="reg-code">Admin sign-up code</label>
              <input
                id="reg-code"
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                required
                aria-describedby="reg-code-hint"
              />
              <p id="reg-code-hint" className="muted small">
                Set as <code>ADMIN_SIGNUP_CODE</code> in the server <code>.env</code>. Without it, anyone
                could sign up as admin and read every customer&rsquo;s tickets.
              </p>
            </>
          )}

          <button className="btn" disabled={busy}>
            {busy ? 'Creating…' : role === 'admin' ? 'Register as admin' : 'Register as customer'}
          </button>
        </form>

        <p className="muted">Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}
