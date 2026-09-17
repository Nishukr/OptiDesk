// app.js — Express app, middleware, and route mounting.
//
// Two authentication systems, split by URL so no request ever has to satisfy both:
//
//   /api/webhooks/*  Clerk's servers      → Svix signature (raw body, no parser)
//   /api/tickets/*   customers            → Clerk session token
//   /api/chat/*      customers            → Clerk session token
//   /api/me          customers            → Clerk session token
//   /api/admin/*     staff                → custom JWT (middleware/auth.js)
//   /api/auth/*      staff sign-in        → custom JWT + Resend verification email
//
// The client's axios interceptor mirrors this table to pick which token to attach,
// so keeping the prefixes disjoint is load-bearing, not cosmetic.
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const chatRoutes = require('./routes/chatRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const { myProfile } = require('./controllers/userController');
const { clerkSession, requireCustomer, isClerkConfigured } = require('./middleware/clerkAuth');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Allowed browser origins. CLIENT_URL is the primary one (it is also the base of
// the emailed verification link); CORS_ORIGINS adds more, comma-separated, which
// you need the moment the frontend is reachable at more than one address —
// localhost during development plus a tunnel or deployed domain for real users.
// Unset means "allow anything", which is only sane locally.
const allowedOrigins = [process.env.CLIENT_URL, ...String(process.env.CORS_ORIGINS || '').split(',')]
  .map((o) => o && o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // No Origin header = curl, Postman, server-to-server. Never blocked.
      if (!origin || allowedOrigins.length === 0) return cb(null, true);
      cb(null, allowedOrigins.includes(origin.replace(/\/$/, '')));
    },
  })
);

// ---- webhooks FIRST, before express.json() ----
// Svix verifies a signature over the exact bytes Clerk sent. Once express.json()
// has consumed the stream there is no way back to those bytes, so this mount has
// to precede it — the router applies express.raw() to its own path only.
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());

// health check
app.get('/api/health', (req, res) =>
  res.json({ ok: true, service: 'optidesk-api', customerAuth: isClerkConfigured() ? 'clerk' : 'off' })
);

// ---- staff: the original custom JWT, unchanged ----
app.use('/api/auth', authRoutes); // password sign-in + Resend email verification
app.use('/api/admin', adminRoutes); // ticket board, triage, resolution, customer directory

// ---- customers: Clerk ----
// clerkSession populates req.auth from the session token; requireCustomer turns
// that into req.user and answers 401/503 itself, so controllers stay auth-agnostic.
app.get('/api/me', clerkSession, requireCustomer, myProfile);
app.use('/api/tickets', clerkSession, ticketRoutes);
app.use('/api/chat', clerkSession, chatRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
module.exports.allowedOrigins = allowedOrigins; // socket.js reuses the same list
