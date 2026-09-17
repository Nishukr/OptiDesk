// middleware/clerkAuth.js — customer authentication, delegated to Clerk.
//
// Two auth systems live side by side in this API, and they never mix:
//   • CUSTOMERS → Clerk. The browser holds the session; requests arrive as
//     `Authorization: Bearer <clerk session token>`. Passwords, sign-up, email
//     verification and session lifetime stop being this server's problem.
//   • STAFF     → the original custom JWT in middleware/auth.js, untouched.
//
// A Clerk session always resolves to role 'customer' (see resolveCustomer), and a
// custom JWT is never read on a customer route. app.js decides which router gets
// which guard.
//
// Why not `requireAuth()`? In @clerk/express v2 it is deprecated, and on failure
// it 302-redirects to a sign-in page instead of answering 401. This API is called
// by XHR, which would follow that redirect and get HTML — so the guard below uses
// the pattern Clerk's own deprecation notice recommends: clerkMiddleware() to
// populate the request, then getAuth() plus an explicit JSON 401.
const { clerkMiddleware, clerkClient, getAuth } = require('@clerk/express');
const User = require('../models/User');

/** Clerk needs both keys: the secret verifies tokens, the publishable one names the instance. */
const isClerkConfigured = () =>
  Boolean(
    String(process.env.CLERK_SECRET_KEY || '').trim() &&
      String(process.env.CLERK_PUBLISHABLE_KEY || '').trim()
  );

const notConfigured = (res) =>
  res.status(503).json({
    error:
      'Customer sign-in is not configured on this server: set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY (dashboard.clerk.com → API keys).',
    code: 'clerk_not_configured',
  });

// clerkMiddleware() calls next(err) when the keys are missing, which would turn
// EVERY request it touches into a 500 — so it is created lazily and swapped for a
// passthrough when Clerk is not set up. That keeps /api/health and the whole
// staff half of the app working on a fresh clone with no Clerk account.
let sessionMw = null;
function clerkSession(req, res, next) {
  if (!isClerkConfigured()) return next();
  if (!sessionMw) sessionMw = clerkMiddleware();
  return sessionMw(req, res, next);
}

// Clerk hands out two shapes of the same user: camelCase from the backend SDK and
// snake_case in webhook payloads. Both readers accept either, so the webhook and
// the lazy resolver below can share one mapping to our schema.
const primaryEmail = (u) => {
  const list = u?.emailAddresses || u?.email_addresses || [];
  const primaryId = u?.primaryEmailAddressId || u?.primary_email_address_id;
  const hit = list.find((e) => e?.id && e.id === primaryId) || list[0];
  return String(hit?.emailAddress || hit?.email_address || '')
    .toLowerCase()
    .trim();
};

const displayName = (u) =>
  [u?.firstName ?? u?.first_name, u?.lastName ?? u?.last_name].filter(Boolean).join(' ').trim() ||
  u?.username ||
  '';

/**
 * Create or update the local mirror of a Clerk user.
 *
 * Why a mirror at all: Ticket.user is an ObjectId ref, and the admin board's
 * "Customer" column is a populate() of it. Storing a Clerk id string there would
 * fail schema validation and lose every join, so each Clerk account gets exactly
 * one User document and `clerkId` is the link between the two systems.
 *
 * Role is hard-coded to 'customer'. Clerk is the customer front door only, so an
 * account whose email happens to match a staff row is refused rather than
 * adopted — otherwise anyone able to receive mail at the admin address could sign
 * up through Clerk and inherit that row's admin role.
 */
async function upsertCustomerFromClerk({ clerkId, email, name }) {
  const mirrored = await User.findOne({ clerkId });
  const addr = String(email || '').toLowerCase().trim();

  if (mirrored) {
    if (addr && mirrored.email !== addr) mirrored.email = addr;
    if (name && mirrored.name !== name) mirrored.name = name;
    mirrored.isVerified = true; // Clerk does not issue a session for an unverified address
    mirrored.deletedAt = undefined; // a returning account is live again
    await mirrored.save();
    return mirrored;
  }

  if (addr) {
    const byEmail = await User.findOne({ email: addr });
    if (byEmail) {
      if (byEmail.role !== 'customer') {
        const err = new Error(
          'That email address belongs to an OptiDesk staff account. Staff sign in with a password at /admin/login.'
        );
        err.status = 409;
        err.code = 'staff_email_conflict';
        throw err;
      }
      byEmail.clerkId = clerkId;
      byEmail.isVerified = true;
      byEmail.deletedAt = undefined;
      if (name) byEmail.name = name;
      await byEmail.save();
      return byEmail;
    }
  }

  return User.create({
    clerkId,
    email: addr || `${clerkId}@users.clerk.invalid`, // email is required; Clerk allows phone-only accounts
    name: name || '',
    role: 'customer',
    isVerified: true,
  });
}

/**
 * Clerk user id → our User document.
 *
 * POST /api/webhooks/clerk is the normal way the mirror appears, but it is
 * asynchronous and is often not configured at all in local development, so the
 * first request from a brand-new account creates the mirror itself. Without this
 * fallback, signing up through Clerk appears to work and then every ticket call
 * fails with "customer not found".
 */
async function resolveCustomer(clerkId) {
  const mirrored = await User.findOne({ clerkId });
  if (mirrored && !mirrored.deletedAt) return mirrored;

  const clerkUser = await clerkClient.users.getUser(clerkId);
  try {
    return await upsertCustomerFromClerk({
      clerkId,
      email: primaryEmail(clerkUser),
      name: displayName(clerkUser),
    });
  } catch (err) {
    // Two concurrent first-requests can both miss and both insert. The loser of
    // that race gets E11000; the row it wanted now exists, so read it back.
    if (err?.code === 11000) return User.findOne({ clerkId });
    throw err;
  }
}

/**
 * Guard for every customer-facing route.
 *
 * Reads the Clerk user id from `req.auth` (via getAuth) and maps it onto the
 * local User document, then presents it to the controllers in the shape they
 * already expect — `req.user = { id, role }` — so ticketController and
 * chatController need no knowledge of which auth system the caller used.
 * `req.customer` carries the full document for anything that wants the profile.
 */
async function requireCustomer(req, res, next) {
  if (!isClerkConfigured()) return notConfigured(res);

  let auth;
  try {
    auth = getAuth(req); // throws if clerkSession did not run first
  } catch {
    return notConfigured(res);
  }

  const clerkId = auth?.userId;
  if (!clerkId)
    return res.status(401).json({ error: 'Sign in to continue', code: 'signed_out' });

  try {
    const customer = await resolveCustomer(clerkId);
    if (!customer)
      return res.status(401).json({ error: 'Your account could not be loaded', code: 'no_mirror' });

    req.customer = customer;
    // Role is fixed, never read from the token: a Clerk session can only ever be
    // a customer session, so no claim in it can widen these permissions.
    req.user = { id: String(customer._id), role: 'customer', clerkId, email: customer.email };
    next();
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    next(err);
  }
}

module.exports = {
  clerkSession,
  requireCustomer,
  isClerkConfigured,
  upsertCustomerFromClerk,
  resolveCustomer,
  primaryEmail,
  displayName,
};
