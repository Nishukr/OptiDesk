// src/pages/AdminCustomers.jsx — directory of every registered customer
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import CustomerCell from '../components/CustomerCell';
import { fmtDay } from '../utils/format';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/users/customers')
      .then((res) => setCustomers(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load customers'))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(needle) ||
        (c.email || '').toLowerCase().includes(needle)
    );
  }, [customers, q]);

  return (
    <div className="container wide">
      <div className="card">
        <div className="card-head">
          <h2>Customers <span className="muted small">· {customers.length} registered</span></h2>
          <Link to="/admin" className="btn-ghost">← Ticket dashboard</Link>
        </div>

        {error && <div className="alert">{error}</div>}
        <div className="filters">
          <input className="search" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <table className="table">
          <thead>
            <tr><th>Customer</th><th>Tickets</th><th>Open</th><th>Last ticket</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c._id}>
                <td><CustomerCell customer={c} /></td>
                <td>{c.ticketCount}</td>
                <td>{c.openCount > 0 ? <span className="chip chip-open">{c.openCount}</span> : <span className="muted">0</span>}</td>
                <td className="muted small nowrap">{fmtDay(c.lastTicketAt)}</td>
                <td className="muted small nowrap">{fmtDay(c.createdAt)}</td>
              </tr>
            ))}
            {loading && <tr><td colSpan={5} className="muted center">Loading…</td></tr>}
            {!loading && shown.length === 0 && (
              <tr><td colSpan={5} className="muted center">No customers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
