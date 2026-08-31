// src/components/CustomerCell.jsx — shows the person who raised a ticket.
// `customer` is the populated ticket.user object: { _id, name, email }.
// If it is missing we say so instead of rendering a blank cell.
import { Link } from 'react-router-dom';
import { initials } from '../utils/format';

export default function CustomerCell({ customer, link = true }) {
  if (!customer || typeof customer !== 'object') {
    return <span className="muted small">Unknown customer</span>;
  }

  const label = customer.name || customer.email || 'Unnamed';

  const inner = (
    <span className="who">
      <span className="avatar" aria-hidden="true">{initials(customer.name || customer.email)}</span>
      <span className="who-text">
        <span className="who-name">{label}</span>
        {customer.email && <span className="who-mail">{customer.email}</span>}
      </span>
    </span>
  );

  return link && customer._id ? (
    <Link to={`/admin/customers/${customer._id}`} className="who-link" title="View this customer">
      {inner}
    </Link>
  ) : (
    inner
  );
}
