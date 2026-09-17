// src/pages/AdminCustomerDetail.jsx — one customer and every ticket they raised
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import { fmtDate, fmtDay, initials, statusLabel } from '../utils/format';

const COLUMNS = [
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
    key: 'created',
    header: 'Raised',
    tdClass: 'muted small nowrap',
    cell: (t) => fmtDate(t.createdAt),
  },
];

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get(`/admin/customers/${id}`)
      .then((res) => alive && setData(res.data))
      .catch((err) => alive && setError(err.response?.data?.error || 'Failed to load customer'));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) return <div className="container"><div className="card"><div className="alert">{error}</div></div></div>;
  if (!data) return <div className="container"><p className="muted">Loading…</p></div>;

  const { user, tickets } = data;
  const open = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <div className="container wide">
      <p className="crumb"><Link to="/admin/customers">← All customers</Link></p>

      <div className="card">
        <div className="who who-big">
          <span className="avatar avatar-lg" aria-hidden="true">{initials(user.name || user.email)}</span>
          <span className="who-text">
            <span className="who-name">{user.name || 'Unnamed customer'}</span>
            <span className="who-mail">{user.email}</span>
          </span>
        </div>
        <div className="kv">
          <span>Role</span><b>{user.role}</b>
          <span>Joined</span><b>{fmtDay(user.createdAt)}</b>
          <span>Tickets</span><b>{tickets.length} total · {open} still open</b>
        </div>
      </div>

      <div className="card">
        <h2>Tickets from this customer</h2>
        <DataTable
          label="Tickets from this customer"
          columns={COLUMNS}
          rows={tickets}
          rowKey={(t) => t._id}
          empty={
            <div className="empty">
              <span className="empty-icon">🎫</span>
              This customer hasn’t raised any tickets yet.
            </div>
          }
        />
      </div>
    </div>
  );
}
