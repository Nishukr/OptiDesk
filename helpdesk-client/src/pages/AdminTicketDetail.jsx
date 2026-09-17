// src/pages/AdminTicketDetail.jsx — one ticket, the customer who raised it, and
// the three-step resolution lifecycle:
//   1. staff send a solution message  → POST /tickets/:id/resolve
//   2. the customer answers "solved?" → POST /tickets/:id/confirm  (customer only)
//   3. only then may an admin delete  → DELETE /tickets/:id
// The Delete button below stays disabled until step 2 has happened, and the API
// refuses the request anyway if anyone tries to skip ahead.
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { fmtDate, initials, statusLabel } from '../utils/format';

const PRIORITIES = ['urgent', 'high', 'normal', 'low'];
// Statuses staff may set directly. Resolving and closing go through the
// handshake instead, so they are not offered here.
const MANUAL_STATUSES = ['open', 'in_progress'];

export default function AdminTicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [agents, setAgents] = useState([]);
  const [solution, setSolution] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, a] = await Promise.all([api.get(`/admin/tickets/${id}`), api.get('/admin/agents')]);
        if (!alive) return;
        setTicket(t.data);
        setAgents(a.data);
      } catch (err) {
        if (alive) setError(err.response?.data?.error || 'Failed to load ticket');
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const patch = async (body) => {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/admin/tickets/${id}`, body);
      setTicket(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  // Step 1: send the fix and ask the customer to confirm it worked.
  const sendSolution = async (e) => {
    e.preventDefault();
    const message = solution.trim();
    if (!message) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/admin/tickets/${id}/resolve`, { message });
      setTicket(res.data);
      setSolution('');
      setNotice('Sent. The customer now sees "Is your problem solved?" on their ticket.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send the solution');
    } finally {
      setSaving(false);
    }
  };

  // Step 3: allowed only after the customer confirmed. Irreversible, so confirm.
  const remove = async () => {
    if (!window.confirm('Delete this ticket and its whole message history? This cannot be undone.')) return;
    setSaving(true);
    setError('');
    try {
      await api.delete(`/admin/tickets/${id}`);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
      setSaving(false);
    }
  };

  if (error && !ticket)
    return <div className="container"><div className="card"><div className="alert">{error}</div></div></div>;
  if (!ticket) return <div className="container"><p className="muted">Loading…</p></div>;

  const c = ticket.user || {};
  const proposed = Boolean(ticket.resolutionRequestedAt);
  const confirmed = Boolean(ticket.confirmedByCustomerAt);
  const isAdmin = user?.role === 'admin';

  return (
    <div className="container wide">
      <p className="crumb"><Link to="/admin">← Back to dashboard</Link></p>
      {error && <div className="alert">{error}</div>}
      {notice && <div className="success">{notice}</div>}

      <div className="grid-2-1">
        <div>
          <div className="card">
            <div className="card-head">
              <h2>{ticket.subject}</h2>
              <span className={`chip chip-${ticket.status}`}>{statusLabel(ticket.status)}</span>
            </div>
            <p className="muted small">
              Raised {fmtDate(ticket.createdAt)} · last update {fmtDate(ticket.updatedAt)}
              {ticket.reopenedCount > 0 && ` · reopened ${ticket.reopenedCount}×`}
            </p>
            <p className="ticket-body">{ticket.body}</p>

            <div className="kv">
              <span>Category</span><b>{ticket.category}</b>
              <span>Sentiment</span>
              <b>{typeof ticket.sentimentScore === 'number' ? ticket.sentimentScore : '—'}</b>
              <span>Assigned to</span>
              <b>{ticket.assignedTo?.name || ticket.assignedTo?.email || 'Nobody yet'}</b>
            </div>
          </div>

          {/* ---------------- step 1: propose the fix ---------------- */}
          <div className="card">
            <h2>Solve this ticket</h2>
            <p className="muted small">
              Send the customer your fix. They get a &ldquo;Is your problem solved?&rdquo; prompt — the
              ticket only closes when they say yes.
            </p>

            {confirmed ? (
              <div className="success" style={{ marginTop: 12 }}>
                The customer confirmed this was solved on {fmtDate(ticket.confirmedByCustomerAt)}.
              </div>
            ) : (
              <form onSubmit={sendSolution}>
                <label htmlFor="sol">Message to the customer</label>
                <textarea
                  id="sol"
                  rows={4}
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  placeholder="Explain what you did and what they should check…"
                  required
                />
                <button className="btn inline" disabled={saving || !solution.trim()}>
                  {saving ? 'Sending…' : proposed ? 'Send another update' : 'Send solution & ask to confirm'}
                </button>
              </form>
            )}

            {proposed && !confirmed && (
              <div className="notice" style={{ margin: '16px 0 0' }}>
                Waiting for the customer to answer. Last asked {fmtDate(ticket.resolutionRequestedAt)}.
              </div>
            )}
          </div>

          {/* ---------------- controls staff still own ---------------- */}
          <div className="card">
            <h2>Triage</h2>
            <label htmlFor="st">Status</label>
            <select
              id="st"
              value={MANUAL_STATUSES.includes(ticket.status) ? ticket.status : ''}
              disabled={saving || confirmed}
              onChange={(e) => e.target.value && patch({ status: e.target.value })}
            >
              {!MANUAL_STATUSES.includes(ticket.status) && (
                <option value="">{statusLabel(ticket.status)} (set by the customer)</option>
              )}
              {MANUAL_STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>

            <label htmlFor="pr">Priority</label>
            <select id="pr" value={ticket.priority} disabled={saving} onChange={(e) => patch({ priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            <label htmlFor="as">Assign to</label>
            <select
              id="as"
              value={ticket.assignedTo?._id || ''}
              disabled={saving}
              onChange={(e) => e.target.value && patch({ assignedTo: e.target.value })}
            >
              <option value="">— pick an agent —</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id}>{a.name || a.email} ({a.role})</option>
              ))}
            </select>
          </div>
        </div>

        {/* ------------------------- side column ------------------------- */}
        <div>
          <div className="card">
            <h2>Raised by</h2>
            <div className="who who-big">
              <span className="avatar avatar-lg" aria-hidden="true">{initials(c.name || c.email)}</span>
              <span className="who-text">
                <span className="who-name">{c.name || 'Unnamed customer'}</span>
                <span className="who-mail">{c.email || 'no email on file'}</span>
              </span>
            </div>
            <div className="kv">
              <span>Role</span><b>{c.role || 'customer'}</b>
              <span>Customer id</span><b className="mono small">{c._id || '—'}</b>
            </div>
            {c._id && (
              <p><Link to={`/admin/customers/${c._id}`}>See all tickets from this customer →</Link></p>
            )}
          </div>

          <div className="card">
            <h2>Lifecycle</h2>
            <div className="handshake">
              <div className={`step ${proposed ? 'done' : 'active'}`}>
                <span className="step-n">1</span>
                <span className="step-text">
                  <span className="step-title">Solution sent</span>
                  <span className="step-sub">
                    {proposed ? fmtDate(ticket.resolutionRequestedAt) : 'Not sent yet'}
                  </span>
                </span>
              </div>
              <div className={`step ${confirmed ? 'done' : proposed ? 'active' : ''}`}>
                <span className="step-n">2</span>
                <span className="step-text">
                  <span className="step-title">Customer confirmed</span>
                  <span className="step-sub">
                    {confirmed
                      ? fmtDate(ticket.confirmedByCustomerAt)
                      : proposed
                        ? 'Waiting on the customer'
                        : 'Blocked until step 1'}
                  </span>
                </span>
              </div>
              <div className={`step ${confirmed ? 'active' : ''}`}>
                <span className="step-n">3</span>
                <span className="step-text">
                  <span className="step-title">Deletion unlocked</span>
                  <span className="step-sub">
                    {confirmed ? 'An admin may now delete this ticket' : 'Locked'}
                  </span>
                </span>
              </div>
            </div>

            <div className="danger-zone">
              <h3>Delete ticket</h3>
              <p>
                {confirmed
                  ? 'Removes the ticket and its whole message history. This cannot be undone.'
                  : 'Disabled: the customer has not confirmed their problem is solved yet.'}
              </p>
              <button
                className="btn-danger"
                onClick={remove}
                disabled={!confirmed || !isAdmin || saving}
                title={
                  !isAdmin
                    ? 'Only an admin can delete tickets'
                    : confirmed
                      ? 'Delete this ticket'
                      : 'Waiting for the customer to confirm'
                }
              >
                🗑 Delete ticket
              </button>
              {!isAdmin && <p className="small" style={{ margin: '8px 0 0' }}>Only admins can delete.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

