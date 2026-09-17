// src/pages/AdminDashboard.jsx — staff ticket board: who raised what, live.
// The "Customer" column comes from ticket.user, which the API populates with
// { _id, name, email } instead of just an id.
//
// Deletion is intentionally not a one-click action here: a ticket can only be
// removed after the customer has confirmed it is solved, so the button stays
// disabled until ticket.canDelete comes back true from the API.
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import CustomerCell from '../components/CustomerCell';
import DataTable from '../components/DataTable';
import { fmtDate, statusLabel } from '../utils/format';

const API_ROOT = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['urgent', 'high', 'normal', 'low'];

// One glanceable label for where a ticket sits in the resolution handshake.
function stage(t) {
  if (t.confirmedByCustomerAt) return { cls: 'chip-closed', text: 'Customer confirmed' };
  if (t.resolutionRequestedAt) return { cls: 'chip-wait', text: 'Awaiting customer' };
  return { cls: 'chip-neutral', text: 'Not solved yet' };
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const isAdmin = user?.role === 'admin';

  // The API does the filtering (GET /api/tickets?status=&priority=&q=).
  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/tickets', { params: { status, priority, q: q.trim() || undefined } });
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
    // The server refuses unauthenticated sockets and only lets staff into the
    // `admins` room, so the login token has to travel with the handshake.
    const socket = io(API_ROOT, {
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('token') },
    });
    socket.on('connect', () => socket.emit('join:admins'));
    socket.on('ticket:new', () => loadRef.current());
    socket.on('ticket:updated', () => loadRef.current());
    socket.on('ticket:deleted', () => loadRef.current());
    return () => socket.disconnect();
  }, []);

  const setTicketStatus = async (id, next) => {
    try {
      const res = await api.patch(`/admin/tickets/${id}`, { status: next });
      setTickets((prev) => prev.map((t) => (t._id === id ? res.data : t)));
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.subject}" and its message history? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/tickets/${t._id}`);
      setTickets((prev) => prev.filter((x) => x._id !== t._id));
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const sorted = [...tickets].sort((a, b) => (ORDER[a.priority] ?? 9) - (ORDER[b.priority] ?? 9));
  const openCount = tickets.filter((t) => t.status === 'open').length;
  const awaiting = tickets.filter((t) => t.resolutionRequestedAt && !t.confirmedByCustomerAt).length;
  const customerCount = new Set(tickets.map((t) => t.user?._id).filter(Boolean)).size;

  // Described once, rendered as an 8-column table on desktop and as stacked
  // cards below 768px. See components/DataTable.jsx for what `mobile` means.
  const columns = [
    {
      key: 'customer',
      header: 'Customer',
      mobile: 'header',
      cell: (t) => <CustomerCell customer={t.user} />,
    },
    {
      key: 'subject',
      header: 'Subject',
      mobile: 'title',
      cell: (t) => <Link to={`/admin/tickets/${t._id}`}>{t.subject}</Link>,
    },
    { key: 'category', header: 'Category', cell: (t) => t.category },
    {
      key: 'priority',
      header: 'Priority',
      mobile: 'badge',
      cell: (t) => <span className={`pill pill-${t.priority}`}>{t.priority}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      mobile: 'badge',
      cell: (t) => <span className={`chip chip-${t.status}`}>{statusLabel(t.status)}</span>,
    },
    {
      key: 'stage',
      header: 'Resolution',
      mobile: 'badge',
      cell: (t) => {
        const s = stage(t);
        return <span className={`chip ${s.cls}`}>{s.text}</span>;
      },
    },
    {
      key: 'created',
      header: 'Raised',
      tdClass: 'muted small nowrap',
      cell: (t) => fmtDate(t.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      mobile: 'actions',
      tdClass: 'actions',
      cell: (t) => {
        const canDelete = Boolean(t.confirmedByCustomerAt);
        return (
          <>
            {t.status === 'open' && (
              <button className="btn-sm" onClick={() => setTicketStatus(t._id, 'in_progress')}>
                Start
              </button>
            )}
            <Link to={`/admin/tickets/${t._id}`} className="btn-sm ok">
              Solve…
            </Link>
            <button
              className="btn-sm danger"
              onClick={() => remove(t)}
              disabled={!canDelete || !isAdmin}
              title={
                !isAdmin
                  ? 'Only an admin can delete tickets'
                  : canDelete
                    ? 'Delete this ticket'
                    : 'The customer has not confirmed the problem is solved yet'
              }
            >
              Delete
            </button>
          </>
        );
      },
    },
  ];

  return (
    <div className="container wide">
      <div className="stats">
        <div className="stat"><span className="stat-n">{tickets.length}</span><span className="stat-l">Tickets shown</span></div>
        <div className="stat"><span className="stat-n">{openCount}</span><span className="stat-l">Still open</span></div>
        <div className="stat"><span className="stat-n">{awaiting}</span><span className="stat-l">Awaiting confirmation</span></div>
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
            aria-label="Search tickets"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by priority">
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {error && <div className="alert">{error}</div>}

        <DataTable
          label="Tickets"
          columns={columns}
          rows={sorted}
          rowKey={(t) => t._id}
          loading={loading}
          empty={
            <div className="empty">
              <span className="empty-icon">🗂️</span>No tickets match these filters.
            </div>
          }
        />
      </div>
    </div>
  );
}
