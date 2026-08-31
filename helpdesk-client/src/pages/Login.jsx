// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const loggedIn = await login(email, password);
      // staff go straight to the ticket dashboard; customers to their tickets
      const isStaff = loggedIn.role === 'agent' || loggedIn.role === 'admin';
      navigate(isStaff ? '/admin' : '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="card">
        <h1>Welcome back</h1>
        <p className="muted">Log in to your support account.</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert">{error}</div>}
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
        </form>
        <p className="muted">No account? <Link to="/register">Register</Link></p>
      </div>
    </div>
  );
}
