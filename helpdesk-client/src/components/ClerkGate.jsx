// src/components/ClerkGate.jsx — mounts <ClerkProvider>, but only when it can.
//
// <ClerkProvider> throws synchronously on a missing or malformed publishableKey.
// Because it wraps the router, that throw is not "customer sign-in is broken" — it
// is a blank page for the whole app, staff sign-in included. So the provider is
// mounted behind the clerkEnabled shape check and the tree renders without it
// otherwise; the customer routes then explain themselves individually.
//
// Must sit INSIDE <BrowserRouter>: routerPush/routerReplace below are what keep
// Clerk's multi-step flows (SSO callback, 2FA, password reset) navigating through
// React Router instead of doing a full page reload.
import { useEffect } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { CLERK_PUBLISHABLE_KEY, clerkEnabled } from '../clerk';
import { setClerkTokenGetter } from '../api/axios';

// Hands Clerk's getToken to the axios request interceptor.
//
// Installed twice, deliberately:
//   • during render — effects run children-first, so an effect alone would fire
//     AFTER CustomerContext's /me call and the first customer request would go out
//     unauthenticated. Rendering a parent always precedes mounting its children.
//   • in the effect — StrictMode mounts, unmounts and remounts in development. The
//     cleanup below nulls the getter, and without a setup that puts it back the
//     app would spend the rest of the session sending no token at all.
// The assignment is idempotent, so doing it in both places costs nothing.
function ClerkTokenBridge({ children }) {
  const { getToken } = useAuth();
  setClerkTokenGetter(getToken);

  useEffect(() => {
    setClerkTokenGetter(getToken);
    return () => setClerkTokenGetter(null);
  }, [getToken]);

  return children;
}

function ClerkRouted({ children }) {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      // Supplied as a pair — Clerk rejects one without the other.
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/login"
      signUpUrl="/signup"
      // Where Clerk lands people when it has no better idea. "/" is the customer
      // ticket list; signing out drops them back on it, which redirects to /login.
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/login"
    >
      <ClerkTokenBridge>{children}</ClerkTokenBridge>
    </ClerkProvider>
  );
}

export default function ClerkGate({ children }) {
  if (!clerkEnabled) return children;
  return <ClerkRouted>{children}</ClerkRouted>;
}
