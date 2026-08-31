// src/pages/AdminTicketDetail.jsx — one ticket, with the customer who raised it
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { fmtDate, initials, statusLabel } from '../utils/format';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['urgent', 'high', 'normal', 'low'];

export default function AdminTicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, a] = await Promise.all([api.get(`/tickets/${id}`), api.get('/users/agents')]);
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
    try {
      const res = await api.patch(`/tickets/${id}`, body);
      setTicket(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (error && !ticket) return <div className="container"><div className="card"><div className="alert">{error}</div></div></div>;
  if (!ticket) return <div className="container"><p className="muted">Loading…</p></div>;

  const c = ticket.user || {};

  return (
    <div className="container wide">
      <p className="crumb"><Link to="/admin">← Back to dashboard</Link></p>
      {error && <div className="alert">{error}</div>}

      <div className="grid">
        <div className="card">
          <h2>{ticket.subject}</h2>
          <p className="muted small">
            Raised {fmtDate(ticket.createdAt)} · last update {fmtDate(ticket.updatedAt)}
          </p>
          <p className="ticket-body">{ticket.body}</p>

          <div className="kv">
            <span>Category</span><b>{ticket.category}</b>
            <span>Sentiment</span><b>{typeof ticket.sentimentScore === 'number' ? ticket.sentimentScore : '—'}</b>
            <span>Assigned to</span><b>{ticket.assignedTo?.name || ticket.assignedTo?.email || 'Nobody yet'}</b>
          </div>

          <label>Status</label>
          <select value={ticket.status} disabled={saving} onChange={(e) => patch({ status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>

          <label>Priority</label>
          <select value={ticket.priority} disabled={saving} onChange={(e) => patch({ priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <label>Assign to</label>
          <select
            value={ticket.assignedTo?._id || ''}
            disabled={saving}
            onChange={(e) => e.target.value && patch({ assignedTo: e.target.value })}
          >
            <option value="">— pick an agent —</option>
            {agents.map((a) => <option key={a._id} value={a._id}>{a.name || a.email} ({a.role})</option>)}
          </select>
        </div>

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
      </div>
    </div>
  );
}
