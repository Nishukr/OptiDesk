// src/pages/AdminCustomers.jsx — directory of every registered customer
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import CustomerCell from '../components/CustomerCell';
import DataTable from '../components/DataTable';
import { fmtDay } from '../utils/format';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/customers')
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

  const columns = [
    {
      key: 'customer',
      header: 'Customer',
      mobile: 'title',
      cell: (c) => <CustomerCell customer={c} />,
    },
    { key: 'tickets', header: 'Tickets', cell: (c) => c.ticketCount },
    {
      key: 'open',
      header: 'Open',
      cell: (c) =>
        c.openCount > 0 ? (
          <span className="chip chip-open">{c.openCount}</span>
        ) : (
          <span className="muted">0</span>
        ),
    },
    {
      key: 'last',
      header: 'Last ticket',
      tdClass: 'muted small nowrap',
      cell: (c) => fmtDay(c.lastTicketAt),
    },
    {
      key: 'joined',
      header: 'Joined',
      tdClass: 'muted small nowrap',
      cell: (c) => fmtDay(c.createdAt),
    },
  ];

  return (
    <div className="container wide">
      <div className="card">
        <div className="card-head">
          <h2>Customers <span className="muted small">· {customers.length} registered</span></h2>
          <Link to="/admin" className="btn-ghost">← Ticket dashboard</Link>
        </div>

        {error && <div className="alert">{error}</div>}
        <div className="filters">
          <input
            className="search"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search customers"
          />
        </div>

        <DataTable
          label="Customers"
          columns={columns}
          rows={shown}
          rowKey={(c) => c._id}
          loading={loading}
          empty={
            <div className="empty">
              <span className="empty-icon">🙋</span>No customers found.
            </div>
          }
        />
      </div>
    </div>
  );
}
