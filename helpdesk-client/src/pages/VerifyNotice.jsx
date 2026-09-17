// src/pages/VerifyNotice.jsx — shown right after registering: "check your inbox".
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

export default function VerifyNotice() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  // sent=0 → the account exists but the email did not go out.
  // cfg=0  → because RESEND_API_KEY is missing from the server environment.
  // cfg=1  → the key is there, so the send itself failed. Saying "add the key"
  //          in that case sends you to fix the wrong thing.
  const sent = params.get('sent') !== '0';
  const configured = params.get('cfg') !== '0';
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    setMsg('');
    setErr('');
    setBusy(true);
    try {
      const res = await api.post('/auth/resend', { email });
      // The endpoint answers the same way for every address on purpose (so it
      // cannot be used to find out who is registered), which means a success
      // message here would be a lie when the server has no mail provider at all.
      // `mailConfigured` describes the server, not the address, so it is safe to
      // act on.
      if (res.data.mailConfigured === false)
        setErr('The server has no mail provider configured, so nothing was sent. RESEND_API_KEY is missing.');
      else setMsg(res.data.message || 'Verification email sent.');
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not resend the email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="verify-wrap">
      <div className="verify-card">
        <div className="verify-icon" aria-hidden="true">📬</div>
        <h1>Check your inbox</h1>

        {sent ? (
          <p className="muted">
            We sent a verification link to <span className="mailto">{email || 'your email address'}</span>.
            Open it to activate your account — you cannot log in until you do.
          </p>
        ) : configured ? (
          <div className="notice" style={{ textAlign: 'left' }}>
            Your account was created, but the verification email could not be sent — the mail
            provider rejected it. The API key <em>is</em> configured, so this is not a missing{' '}
            <code>.env</code> value: the API console has the exact reason (a revoked Resend key,
            an unverified sending domain, or the daily quota are the usual ones). Press Resend
            once it is sorted.
          </div>
        ) : (
          <div className="notice" style={{ textAlign: 'left' }}>
            Your account was created, but the verification email could not be sent. The server needs{' '}
            <code>RESEND_API_KEY</code> in its environment (get one at <code>resend.com/api-keys</code>).
            Add it, restart the API, then press Resend.
          </div>
        )}

        {msg && <div className="success">{msg}</div>}
        {err && <div className="alert">{err}</div>}

        <p className="muted small">
          Nothing arrived? Check your spam folder — the link is valid for 24 hours.
        </p>

        <div className="verify-actions">
          <button className="btn-ghost" onClick={resend} disabled={busy || !email}>
            {busy ? 'Sending…' : 'Resend email'}
          </button>
          <Link to="/admin/login" className="btn-ghost">Go to staff sign in</Link>
        </div>
      </div>
    </div>
  );
}
