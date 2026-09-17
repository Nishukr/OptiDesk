// src/pages/Tickets.jsx — customer's ticket list + create form.
// Tickets where support has proposed a fix are pulled to the top with an
// "Action needed" cue, because nothing progresses until the customer answers.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import { fmtDate, statusLabel } from '../utils/format';

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/tickets');
      setTickets(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createTicket = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/tickets', { subject, body });
      setSubject('');
      setBody('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create ticket');
    } finally {
      setBusy(false);
    }
  };

  const needsMe = (t) => t.resolutionRequestedAt && !t.confirmedByCustomerAt;
  const sorted = [...tickets].sort((a, b) => Number(needsMe(b)) - Number(needsMe(a)));
  const waiting = tickets.filter(needsMe).length;

  const columns = [
    {
      key: 'subject',
      header: 'Subject',
      mobile: 'title',
      cell: (t) => (
        <>
          <Link to={`/tickets/${t._id}`}>{t.subject}</Link>
          {needsMe(t) && (
            <>
              {' '}
              <span className="chip chip-wait">Is it solved?</span>
            </>
          )}
        </>
      ),
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
      key: 'created',
      header: 'Raised',
      tdClass: 'muted small nowrap',
      cell: (t) => fmtDate(t.createdAt),
    },
  ];

  return (
    <div className="container">
      {waiting > 0 && (
        <div className="notice">
          <b>Action needed:</b> support has answered {waiting === 1 ? '1 ticket' : `${waiting} tickets`}.
          Open {waiting === 1 ? 'it' : 'them'} and tell us whether the problem is solved.
        </div>
      )}

      <div className="grid">
        <div className="card">
          <h2>Raise a ticket</h2>
          <p className="muted small">
            Describe the problem in your own words — OptiDesk sorts the category and urgency for you.
          </p>
          <form onSubmit={createTicket}>
            {error && <div className="alert">{error}</div>}
            <label htmlFor="t-sub">Subject</label>
            <input
              id="t-sub"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of the issue"
              required
            />
            <label htmlFor="t-body">Describe your issue</label>
            <textarea
              id="t-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What happened, what you expected, and anything you already tried…"
              required
            />
            <button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit ticket'}</button>
          </form>
        </div>

        <div className="card">
          <h2>Your tickets</h2>
          <DataTable
            label="Your tickets"
            columns={columns}
            rows={sorted}
            rowKey={(t) => t._id}
            loading={loading}
            empty={
              <div className="empty">
                <span className="empty-icon">🎫</span>
                No tickets yet. Create one on the left and the AI assistant will pick it up.
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
