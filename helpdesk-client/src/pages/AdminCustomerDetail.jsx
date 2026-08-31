// src/pages/AdminCustomerDetail.jsx — one customer and every ticket they raised
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { fmtDate, fmtDay, initials, statusLabel } from '../utils/format';

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get(`/users/${id}`)
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

      <div className="card" style={{ marginTop: 20 }}>
        <h2>Tickets from this customer</h2>
        <table className="table">
          <thead>
            <tr><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Raised</th></tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t._id}>
                <td><Link to={`/admin/tickets/${t._id}`}>{t.subject}</Link></td>
                <td>{t.category}</td>
                <td><span className={`pill pill-${t.priority}`}>{t.priority}</span></td>
                <td><span className={`chip chip-${t.status}`}>{statusLabel(t.status)}</span></td>
                <td className="muted small nowrap">{fmtDate(t.createdAt)}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={5} className="muted center">This customer hasn’t raised any tickets yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
