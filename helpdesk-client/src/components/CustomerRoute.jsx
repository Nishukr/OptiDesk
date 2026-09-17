// src/components/CustomerRoute.jsx — the CUSTOMER guard (Clerk).
//
// Three cases that all used to be one:
//   • Clerk not configured → say so. Redirecting to /login would bounce off a page
//     that also cannot work, and the loop hides the real cause.
//   • Staff JWT session → send them to /admin. A staff member is signed in, just not
//     as a customer, and pushing them at Clerk's widget invites a second account.
//   • Nobody signed in → /login, remembering where they were headed.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';
import { clerkEnabled, CLERK_SETUP_HINT } from '../clerk';

const Spinner = () => (
  <div className="container"><p className="muted">Loading…</p></div>
);

function ClerkGuard({ children }) {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user: staff, loading: staffLoading } = useAuth();
  const location = useLocation();

  // Resolve the staff session first: it decides between "go to /admin" and "sign in
  // as a customer", and acting before it loads would flash the wrong destination.
  if (staffLoading || !isLoaded) return <Spinner />;
  if (staff) return <Navigate to="/admin" replace />;
  if (!isSignedIn) return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}

function DisabledGuard() {
  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 560 }}>
        <h2>Customer sign-in unavailable</h2>
        <p className="muted">{CLERK_SETUP_HINT}</p>
      </div>
    </div>
  );
}

// Picked once at module scope so the Clerk hooks above are never called without a
// <ClerkProvider> over them, and so React's hook order never changes per render.
export default clerkEnabled ? ClerkGuard : DisabledGuard;
