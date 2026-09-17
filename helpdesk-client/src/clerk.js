// src/clerk.js — the single decision about whether customer auth is available.
//
// Clerk owns customers; staff keep the password form at /admin/login and the JWT
// in localStorage. That split is why this file exists: <ClerkProvider> THROWS on a
// missing or malformed publishableKey, and because it wraps the router that throw
// blanks the entire app — including the staff sign-in that does not need Clerk at
// all. A missing key must degrade to "customers cannot sign in", never to a white
// screen for everybody.
//
// The key is public by design (Vite inlines every VITE_* value into the bundle);
// the secret half lives only on the server as CLERK_SECRET_KEY.
export const CLERK_PUBLISHABLE_KEY = String(
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || ''
).trim();

// A shape check, not a truthiness check: `pk_test_` followed by base64. A pasted
// placeholder or a half-copied key is the case worth catching, because it fails
// the same way an absent key does but looks configured.
export const clerkEnabled = /^pk_(test|live)_.{8,}$/.test(CLERK_PUBLISHABLE_KEY);

// Shown wherever a customer-facing screen cannot work without the key. Kept here
// so the wording is identical on every one of them.
export const CLERK_SETUP_HINT =
  'Customer sign-in is not configured. Add VITE_CLERK_PUBLISHABLE_KEY to helpdesk-client/.env ' +
  '(Clerk dashboard → API keys) and restart the dev server. Staff sign-in at /admin/login ' +
  'does not use Clerk and is unaffected.';
