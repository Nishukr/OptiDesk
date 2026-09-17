// src/components/Navbar.jsx
//
// Three groups, not two: brand / page navigation / session. The split is what
// lets the bar reflow on a phone — below 768px the session group (who you are
// + Log out) stays on the brand row and the page links drop to a second row.
// Cramming all four items onto one 375px row overflowed the viewport, which
// gave every page in the app a horizontal scrollbar.
//
// Three session states now, because there are two sign-ins:
//   staff (custom JWT)     → name · role badge + Log out, staff page links
//   customer (Clerk)       → <UserButton />, "My Tickets"
//   signed out             → Sign in / Get started
import { Link, useNavigate } from 'react-router-dom';
import { UserButton, useUser } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';
import { clerkEnabled } from '../clerk';

// Chosen once, at module scope. Clerk's hooks throw without a <ClerkProvider>, and
// the provider is only mounted when the publishable key is present — but the set of
// hooks Navbar calls still has to be identical on every render, so the choice
// cannot be made inside the component body.
const useCustomerSession = clerkEnabled
  ? () => {
      const { isLoaded, isSignedIn, user } = useUser();
      return {
        loaded: isLoaded,
        signedIn: Boolean(isSignedIn),
        name: user?.fullName || user?.primaryEmailAddress?.emailAddress || '',
      };
    }
  : () => ({ loaded: true, signedIn: false, name: '' });

export default function Navbar() {
  const { user, logout } = useAuth();
  const customer = useCustomerSession();
  const navigate = useNavigate();

  const isStaff = user && (user.role === 'agent' || user.role === 'admin');

  // Staff sign out of the JWT session and land back on the staff form; Clerk owns
  // its own sign-out inside <UserButton />.
  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const pageLinks = isStaff
    ? [
        ['/admin', 'Dashboard'],
        ['/admin/customers', 'Customers'],
      ]
    : customer.signedIn
      ? [['/', 'My Tickets']]
      : [];

  return (
    <nav className="navbar">
      <Link to={isStaff ? '/admin' : '/'} className="brand">
        <span className="brand-mark" aria-hidden="true">⚡</span>
        OptiDesk
      </Link>

      {pageLinks.length > 0 && (
        <div className="nav-links">
          {pageLinks.map(([to, label]) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
        </div>
      )}

      <div className="nav-session">
        {isStaff ? (
          <>
            {/* Split so mobile can drop the long name and keep the short role
                without either being lost on desktop. */}
            <span className="badge">
              <span className="badge-who">{user.name || user.email}</span>
              <span className="badge-sep" aria-hidden="true">·</span>
              <span className="badge-role">{user.role}</span>
            </span>
            <button className="btn-ghost" onClick={handleLogout}>Log out</button>
          </>
        ) : customer.signedIn ? (
          <>
            <span className="badge">
              <span className="badge-who">{customer.name}</span>
            </span>
            {/* Clerk's own menu: profile, security, sign out. Replaces the
                hand-rolled customer profile menu. */}
            <UserButton
              appearance={{ elements: { avatarBox: { width: 32, height: 32 } } }}
            />
          </>
        ) : (
          // Held back until Clerk has answered, so a signed-in customer never sees
          // "Sign in" flash on the first paint.
          customer.loaded && (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/signup">Get started</Link>
            </>
          )
        )}
      </div>
    </nav>
  );
}
