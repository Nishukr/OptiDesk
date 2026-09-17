// server.js — entry point: connect DB, start HTTP server + Socket.io
require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const { verifyMailCredentials, fromAddress } = require('./services/mailer');
const { isClerkConfigured } = require('./middleware/clerkAuth');
const { isWebhookConfigured } = require('./controllers/webhookController');

const PORT = process.env.PORT || 5000;

// Customer sign-in is Clerk's; staff sign-in is the local JWT. Both are printed
// because the failure modes look identical from the browser (a 503 on every
// customer request) and the cause is always one of the two keys being absent.
function reportClerk() {
  if (!isClerkConfigured()) {
    console.warn('🔐 Customer sign-in (Clerk): OFF — set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY');
    console.warn(
      '    /api/tickets, /api/chat and /api/me answer 503 until then.\n' +
        '    Staff sign-in at /admin/login is unaffected — it uses JWT_SECRET.'
    );
    return;
  }
  console.log('🔐 Customer sign-in: ON via Clerk');
  // A missing webhook secret is survivable, not fatal: the local mirror row is
  // created lazily on the customer's first authenticated request. What is lost is
  // propagation of profile edits and deletions made in Clerk.
  if (!isWebhookConfigured())
    console.warn(
      '    Webhook: OFF — set CLERK_WEBHOOK_SECRET to sync profile edits and deletions.\n' +
        '    Sign-up still works; the local record is created on first request.'
    );
  else console.log('    Webhook: ON at POST /api/webhooks/clerk');
}

// Say out loud whether verification mail can actually be sent. Without this the
// only symptom of a missing/stale API key is `emailSent:false` buried in a
// register response, which looks like the feature is broken.
//
// This asks Resend to accept the key rather than just checking that the env var
// is non-empty: a revoked key is the right shape and still fails. It also reports
// whether the MAIL_FROM domain is verified, which is the other thing that makes
// every send fail while the credentials themselves are fine.
async function reportMail() {
  const { ok, reason, note } = await verifyMailCredentials();
  if (ok) {
    console.log(`✉️  Verification email: ON via Resend, from ${fromAddress()}`);
    if (note) console.warn(`    Note: ${note}`);
  } else {
    console.warn(`✉️  Verification email: OFF — ${reason}`);
    console.warn(
      '    Accounts are still created; the verification link is printed here in the\n' +
        '    console instead. Test credentials any time with: npm run mail:test'
    );
  }
}

async function start() {
  await connectDB();
  const server = http.createServer(app);
  const io = initSocket(server);
  app.set('io', io); // so controllers can emit via req.app.get('io')

  // A busy port means an OLDER server is still up, and every request you make
  // goes to that one — so new routes answer 404 and .env edits look ignored.
  // Node's default here is a bare stack trace that is easy to mistake for a
  // crash, leaving you to debug code that was never actually running.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n❌ Port ${PORT} is already in use — an older API process is still running.\n` +
          '   This one did NOT start, so requests are being answered by the old code.\n' +
          `   Windows: netstat -ano | findstr :${PORT}   then   taskkill /PID <pid> /F\n` +
          '   Then use "npm run dev" (nodemon), which reloads on route and .env changes.\n'
      );
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`);
    reportClerk();
    // Fire-and-forget: the API round-trip must not delay accepting requests.
    reportMail().catch(() => {});
  });
}

start();
