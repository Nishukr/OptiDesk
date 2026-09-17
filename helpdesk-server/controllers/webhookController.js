// controllers/webhookController.js — Clerk → MongoDB synchronisation.
//
// Clerk owns customer identity, but this app still needs a local row per customer:
// Ticket.user is an ObjectId ref and the admin board joins on it. This webhook is
// what keeps the two in step — a customer who signs up, renames themselves or
// deletes their account in Clerk is reflected here without anybody logging in.
//
// Verification is not optional. The endpoint is public (Clerk's servers call it,
// not a signed-in browser), so an unverified handler would let anyone POST a
// fabricated user.created and plant rows in the User collection.
const { Webhook } = require('svix');
const User = require('../models/User');
const { upsertCustomerFromClerk, primaryEmail, displayName } = require('../middleware/clerkAuth');

const secret = () => String(process.env.CLERK_WEBHOOK_SECRET || '').trim();

/** True when this endpoint can verify a signature. Reported at boot by server.js. */
const isWebhookConfigured = () => /^whsec_/.test(secret());

// POST /api/webhooks/clerk
exports.clerkWebhook = async (req, res, next) => {
  if (!isWebhookConfigured())
    return res.status(503).json({
      error: 'CLERK_WEBHOOK_SECRET is not set, so this endpoint cannot verify Clerk signatures.',
      code: 'webhook_not_configured',
    });

  // express.raw() leaves a Buffer here. Svix signs the EXACT bytes Clerk sent, so
  // this must never be re-serialised from a parsed object — JSON.stringify would
  // reorder keys or change spacing and the signature would stop matching. See the
  // mount order in app.js.
  const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null;
  if (payload === null)
    return res.status(500).json({
      error: 'Webhook body was parsed before it could be verified — express.raw() must run on this route.',
      code: 'body_not_raw',
    });

  let event;
  try {
    // svix v2's verify() returns nothing — it throws on a bad signature and is
    // silent on a good one (it calls the native verifier with jsonParse:false).
    // v1 returned the parsed payload, so relying on a return value here yields
    // `undefined` and a 500 on every VALID webhook. Parse the raw string instead,
    // after verification, never before.
    new Webhook(secret()).verify(payload, {
      'svix-id': req.headers['svix-id'],
      'svix-timestamp': req.headers['svix-timestamp'],
      'svix-signature': req.headers['svix-signature'],
    });
    event = JSON.parse(payload);
  } catch (err) {
    // Wrong secret, replayed/expired timestamp, or a forged call.
    console.warn(`🔗 Clerk webhook rejected: ${err.message}`);
    return res.status(400).json({ error: 'Invalid webhook signature', code: 'bad_signature' });
  }

  try {
    const { type, data } = event || {};

    switch (type) {
      case 'user.created':
      case 'user.updated': {
        const user = await upsertCustomerFromClerk({
          clerkId: data.id,
          email: primaryEmail(data),
          name: displayName(data),
        });
        console.log(`🔗 Clerk ${type}: ${user.email} → user ${user._id}`);
        break;
      }

      case 'user.deleted': {
        // Soft delete. Their tickets and messages still reference this row, so
        // removing it would leave the admin board with unresolvable owners.
        const user = await User.findOneAndUpdate(
          { clerkId: data.id },
          { deletedAt: new Date() },
          { new: true }
        );
        console.log(
          user
            ? `🔗 Clerk user.deleted: ${user.email} soft-deleted (tickets kept)`
            : `🔗 Clerk user.deleted: ${data.id} had no local record`
        );
        break;
      }

      default:
        // Clerk sends far more event types than this app cares about. Anything
        // unhandled is still acknowledged, or Clerk retries it for hours.
        break;
    }

    // Always 200 on a verified event. A non-2xx makes Clerk retry, which is right
    // for a transient fault but wrong for "we don't handle this type".
    res.json({ received: true, type });
  } catch (err) {
    // A real failure (database down) SHOULD be retried, so let the error handler
    // answer 5xx rather than swallowing it.
    if (err.status === 409) {
      // A staff email arriving from Clerk is a permanent conflict, not a blip —
      // retrying forever would never fix it.
      console.warn(`🔗 Clerk webhook: ${err.message}`);
      return res.status(200).json({ received: true, ignored: err.code });
    }
    next(err);
  }
};

exports.isWebhookConfigured = isWebhookConfigured;
