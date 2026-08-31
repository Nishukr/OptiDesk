// src/pages/AdminDashboard.jsx — staff ticket board: who raised what, live.
// The "Customer" column comes from ticket.user, which the API now populates
// with { _id, name, email } instead of just an id.
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api/axios';
import CustomerCell from '../components/CustomerCell';
import { fmtDate, statusLabel } from '../utils/format';

const API_ROOT = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['urgent', 'high', 'normal', 'low'];

export default function AdminDashboard() {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  // The API does the filtering (GET /api/tickets?status=&priority=&q=).
  const load = useCallback(async () => {
    try {
      const res = await api.get('/tickets', { params: { status, priority, q: q.trim() || undefined } });
      setTickets(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [status, priority, q]);

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Keep the newest `load` reachable from the socket effect without reconnecting.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const socket = io(API_ROOT, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('join:admins'));
    socket.on('ticket:new', () => loadRef.current());
    socket.on('ticket:updated', () => loadRef.current());
    return () => socket.disconnect();
  }, []);

  const setTicketStatus = async (id, next) => {
    try {
      const res = await api.patch(`/tickets/${id}`, { status: next });
      setTickets((prev) => prev.map((t) => (t._id === id ? res.data : t)));
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    }
  };

  const sorted = [...tickets].sort(
    (a, b) => (ORDER[a.priority] ?? 9) - (ORDER[b.priority] ?? 9)
  );
  const openCount = tickets.filter((t) => t.status === 'open').length;
  const customerCount = new Set(
    tickets.map((t) => t.user?._id).filter(Boolean)
  ).size;

  return (
    <div className="container wide">
      <div className="stats">
        <div className="stat"><span className="stat-n">{tickets.length}</span><span className="stat-l">Tickets shown</span></div>
        <div className="stat"><span className="stat-n">{openCount}</span><span className="stat-l">Still open</span></div>
        <div className="stat"><span className="stat-n">{customerCount}</span><span className="stat-l">Customers involved</span></div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Ticket Dashboard <span className="muted small">· live</span></h2>
          <Link to="/admin/customers" className="btn-ghost">All customers →</Link>
        </div>

        <div className="filters">
          <input
            className="search"
            placeholder="Search subject or message…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {error && <div className="alert">{error}</div>}
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th><th>Subject</th><th>Category</th><th>Priority</th>
              <th>Status</th><th>Raised</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t._id}>
                <td><CustomerCell customer={t.user} /></td>
                <td><Link to={`/admin/tickets/${t._id}`}>{t.subject}</Link></td>
                <td>{t.category}</td>
                <td><span className={`pill pill-${t.priority}`}>{t.priority}</span></td>
                <td><span className={`chip chip-${t.status}`}>{statusLabel(t.status)}</span></td>
                <td className="muted small nowrap">{fmtDate(t.createdAt)}</td>
                <td className="actions">
                  <button className="btn-sm" onClick={() => setTicketStatus(t._id, 'in_progress')}>Start</button>
                  <button className="btn-sm" onClick={() => setTicketStatus(t._id, 'resolved')}>Resolve</button>
                </td>
              </tr>
            ))}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={7} className="muted center">No tickets match these filters.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={7} className="muted center">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
