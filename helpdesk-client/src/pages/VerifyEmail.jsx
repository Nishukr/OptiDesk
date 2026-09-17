// src/pages/VerifyEmail.jsx — the page the emailed link opens.
// The link carries the raw token; this page hands it to
// GET /api/auth/verify-email and renders whatever comes back.
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

const OUTCOMES = {
  success: {
    icon: '✅',
    tone: 'ok',
    title: 'Email verified',
    body: 'Your OptiDesk account is active. You can sign in now.',
  },
  already: {
    icon: '👍',
    tone: 'ok',
    title: 'Already verified',
    body: 'This address was confirmed earlier. Just sign in.',
  },
  expired: {
    icon: '⌛',
    tone: 'bad',
    title: 'Link expired',
    body: 'Verification links last 24 hours. Request a fresh one from the sign-in page.',
  },
  invalid: {
    icon: '⚠️',
    tone: 'bad',
    title: 'Link not valid',
    body: 'This link is incomplete or has already been used. Request a new one from the sign-in page.',
  },
  offline: {
    icon: '📡',
    tone: 'bad',
    title: "Couldn't reach the server",
    body: 'The OptiDesk API did not answer. Check that it is running, then open the link again.',
  },
};

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  // Older emails linked straight to the API, which forwarded a ?status= here.
  const [status, setStatus] = useState(() => (token ? null : params.get('status') || 'invalid'));
  const [message, setMessage] = useState('');

  // StrictMode runs effects twice in dev. The token is single-use, so a second
  // call would report "invalid" for a verification that actually succeeded.
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;

    api
      .get('/auth/verify-email', { params: { token } })
      .then((res) => {
        setStatus(res.data.status || 'success');
        setMessage(res.data.message || '');
      })
      .catch((err) => {
        const data = err.response?.data;
        setStatus(data?.status || (err.response ? 'invalid' : 'offline'));
        setMessage(data?.message || '');
      });
  }, [token]);

  if (!status) {
    return (
      <div className="verify-wrap">
        <div className="verify-card">
          <div className="verify-icon" aria-hidden="true">⏳</div>
          <h1>Verifying your email…</h1>
          <p className="muted">One moment while we confirm your link.</p>
        </div>
      </div>
    );
  }

  const outcome = OUTCOMES[status] || OUTCOMES.invalid;

  return (
    <div className="verify-wrap">
      <div className="verify-card">
        <div className={`verify-icon ${outcome.tone}`} aria-hidden="true">{outcome.icon}</div>
        <h1>{outcome.title}</h1>
        <p className="muted">{message || outcome.body}</p>
        <div className="verify-actions">
          {/* Staff flow: only agents/admins get verification email from this app.
              Customer addresses are verified inside Clerk. */}
          <Link to="/admin/login" className="btn inline">Go to staff sign in</Link>
        </div>
      </div>
    </div>
  );
}
