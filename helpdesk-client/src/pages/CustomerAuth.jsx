// src/pages/CustomerAuth.jsx — the customer sign-in and sign-up screens.
//
// Clerk renders the whole flow: email/password, OAuth, verification codes, 2FA,
// password reset. There is no form here to keep in step with the server, which is
// the point of handing customer identity over.
//
// `routing="path"` + `path` is required for the multi-step screens: Clerk needs to
// own /login/factor-one, /login/sso-callback and friends, so App.jsx mounts these
// on splat routes. With the default hash routing those sub-screens would live in
// the fragment and break a refresh mid-flow.
//
// Staff do NOT come through here — they use the password form at /admin/login.
import { Link } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/clerk-react';
import AuthLayout from '../components/AuthLayout';
import { CLERK_SETUP_HINT } from '../clerk';

// Clerk's widget sits inside AuthLayout's own card, so its card chrome is removed
// rather than nested. Colours are the app's design tokens (see index.css :root) —
// resolved with getComputedStyle would be fiddlier than repeating three hex values.
const appearance = {
  variables: {
    colorPrimary: '#4f46e5',
    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
    colorDanger: '#dc2626',
    borderRadius: '8px',
    fontFamily: "'Inter', 'Segoe UI', Roboto, -apple-system, sans-serif",
    fontSize: '15px',
  },
  elements: {
    rootBox: { width: '100%' },
    cardBox: { width: '100%', boxShadow: 'none', border: 'none' },
    card: { width: '100%', boxShadow: 'none', border: 'none', background: 'transparent', padding: 0 },
    // AuthLayout already prints the title and subtitle.
    header: { display: 'none' },
    footer: { background: 'transparent' },
  },
};

const StaffHint = () => (
  <p className="muted small" style={{ marginTop: 18 }}>
    Support agent or administrator? <Link to="/admin/login">Sign in to the staff console</Link>.
  </p>
);

export function CustomerSignIn() {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to raise a ticket or check on one you have open.">
      <SignIn routing="path" path="/login" signUpUrl="/signup" fallbackRedirectUrl="/" appearance={appearance} />
      <StaffHint />
    </AuthLayout>
  );
}

export function CustomerSignUp() {
  return (
    <AuthLayout title="Create your account" subtitle="Takes a minute. Then you can raise your first ticket.">
      <SignUp routing="path" path="/signup" signInUrl="/login" fallbackRedirectUrl="/" appearance={appearance} />
      <StaffHint />
    </AuthLayout>
  );
}

// Stands in for both screens when VITE_CLERK_PUBLISHABLE_KEY is missing. <SignIn>
// and <SignUp> throw without a <ClerkProvider> above them, so App.jsx swaps in this
// component at module scope instead of rendering them and catching the crash.
export function CustomerAuthUnavailable() {
  return (
    <AuthLayout title="Customer sign-in unavailable" subtitle="This part of OptiDesk is not configured yet.">
      <p className="muted">{CLERK_SETUP_HINT}</p>
      <StaffHint />
    </AuthLayout>
  );
}
