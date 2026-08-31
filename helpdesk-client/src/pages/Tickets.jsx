// src/pages/Tickets.jsx — customer's ticket list + create form
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const priorityClass = (p) => `pill pill-${p}`;

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
    try {
      await api.post('/tickets', { subject, body });
      setSubject('');
      setBody('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create ticket');
    }
  };

  return (
    <div className="container">
      <div className="grid">
        <div className="card">
          <h2>Raise a ticket</h2>
          <form onSubmit={createTicket}>
            {error && <div className="alert">{error}</div>}
            <label>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
            <label>Describe your issue</label>
            <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
            <button className="btn">Submit ticket</button>
          </form>
        </div>

        <div className="card">
          <h2>Your tickets</h2>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="muted">No tickets yet. Create one on the left.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th></tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t._id}>
                    <td><Link to={`/tickets/${t._id}`}>{t.subject}</Link></td>
                    <td>{t.category}</td>
                    <td><span className={priorityClass(t.priority)}>{t.priority}</span></td>
                    <td>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
