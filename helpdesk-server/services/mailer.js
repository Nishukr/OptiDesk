// services/mailer.js — outbound email for OptiDesk, sent over HTTPS (Resend).
//
// Why this is no longer nodemailer/SMTP: Render — like most PaaS free tiers —
// blocks outbound ports 25/465/587 to keep spam off its IP ranges, and there is
// no setting to open them. transporter.sendMail() therefore stalls and fails
// with ETIMEDOUT no matter how correct the Gmail app password is, which is why
// that error was so easy to mistake for a credentials problem. Resend's REST API
// is an ordinary HTTPS POST to port 443, so nothing in the way blocks it.
//
// .env:
//   RESEND_API_KEY=re_xxxxxxxx                    <- resend.com/api-keys ("Sending access" is enough)
//   MAIL_FROM=OptiDesk <no-reply@yourdomain.com>  <- an address on a domain YOU verified
//   CLIENT_URL=https://your-app.vercel.app        <- base of the emailed link
//   MAIL_REPLY_TO=support@yourdomain.com          <- optional, where replies land
const crypto = require('crypto');
const { Resend } = require('resend');

const APP_NAME = 'OptiDesk';
const BRAND = '#4f46e5'; // indigo — matches the client's --brand-600
const LINK = '#0284c7';

// Resend's shared sandbox sender: needs no DNS setup, so it is the right default
// for a first run — but it only ever delivers to the address that owns the Resend
// account. See the 403 branch in describeMailError().
const TESTING_FROM = `${APP_NAME} <onboarding@resend.dev>`;

// Sending sits on the critical path of POST /api/auth/register, and fetch() has
// no timeout of its own. Without this bound, one stalled connection holds the
// registration request open until the browser gives up.
const SEND_TIMEOUT_MS = Number(process.env.MAIL_TIMEOUT_MS) || 10_000;

// Say it out loud when the old SMTP credentials are still present. They are dead
// config now, so a "fix" applied there changes nothing — and a Gmail app password
// sitting in .env for no reason is a liability rather than a fallback.
if (process.env.EMAIL_PASS || process.env.SMTP_PASS) {
  console.warn(
    '⚠️  EMAIL_USER / EMAIL_PASS / SMTP_* are set but NO LONGER USED: mail now goes\n' +
      '    over HTTPS via RESEND_API_KEY. Delete them from .env, and revoke that Gmail\n' +
      '    app password at myaccount.google.com/apppasswords.'
  );
}

const apiKey = () => String(process.env.RESEND_API_KEY || '').trim();

/** True when .env has enough for us to actually send mail. */
function isMailConfigured() {
  const key = apiKey();
  // Real keys are "re_" plus a random tail. The second test rejects the literal
  // placeholder in .env.example: copying that file without editing it would
  // otherwise report mail as configured and fail on every send instead of saying
  // plainly that the key was never filled in.
  return /^re_[A-Za-z0-9_-]{10,}$/.test(key) && !/^re_x+$/i.test(key);
}

// One client per process. The constructor throws on a missing key, so it is built
// lazily: requiring this module must not crash a server that has no mail set up
// (accounts are still created, the link is printed to the console instead).
let client = null;
function resend() {
  if (!isMailConfigured()) {
    const err = new Error(
      'Email is not configured: set RESEND_API_KEY in the server .env (get one at https://resend.com/api-keys)'
    );
    err.status = 503;
    throw err;
  }
  if (!client) client = new Resend(apiKey());
  return client;
}

/**
 * The From address. Resend will only accept a domain you have verified, so an
 * unset MAIL_FROM falls back to the shared sandbox sender rather than to
 * something invented — a guessed domain fails with a 403 that reads like a bug.
 */
function fromAddress() {
  const configured = String(process.env.MAIL_FROM || '').trim();
  return configured || TESTING_FROM;
}

/** Whether we are on the sandbox sender, which can only reach the account owner. */
const usingTestSender = () => fromAddress() === TESTING_FROM;

/**
 * Turn a Resend error object into something worth reading.
 *
 * The SDK does not throw: it resolves to { data, error } where error is
 * { name, message, statusCode }. Two of those are near-certain to be hit in a
 * fresh setup and are indistinguishable from each other in the raw text, so they
 * get the full explanation.
 */
function describeMailError(err) {
  const name = err?.name;
  const status = err?.statusCode;
  const msg = err?.message || 'Unknown mail error';

  // Order matters. A bad key answers 401 with name "validation_error" and the
  // text "API key is invalid" on POST /emails (but 400 on GET /domains), while a
  // truly absent key answers 401 "missing_api_key". Testing status alone would
  // report a present-but-revoked key as missing and send you to look in the wrong
  // place, so the text is checked first.
  if (/api key is invalid/i.test(msg))
    return (
      'Resend refused the API key (it is invalid, revoked, or truncated).\n' +
      `  • The key in use starts "${apiKey().slice(0, 6)}…" and is ${apiKey().length} characters.\n` +
      '  • Generate a fresh one at https://resend.com/api-keys and update RESEND_API_KEY.'
    );

  if (name === 'missing_api_key')
    return 'Resend rejected the request: RESEND_API_KEY is missing from the environment.';
  if (name === 'restricted_api_key' || name === 'suspended_api_key' || name === 'invalid_permission')
    return `Resend refused this key (${name}): ${msg} — check its permissions at https://resend.com/api-keys.`;

  if (status === 403 && /only send testing emails/i.test(msg))
    return (
      `Resend is in testing mode: with the sandbox sender (${TESTING_FROM}) it will only\n` +
      '  deliver to the email address that owns your Resend account.\n' +
      '  • To email anybody else, verify a domain at https://resend.com/domains and set\n' +
      '    MAIL_FROM to an address on it, e.g. MAIL_FROM="OptiDesk <no-reply@yourdomain.com>".'
    );

  if (status === 403 && /not verified/i.test(msg))
    return (
      `Resend will not send from ${fromAddress()} — that domain is not verified.\n` +
      '  • Add it at https://resend.com/domains, publish the DNS records it gives you,\n' +
      '    wait for "Verified", then retry. Until then, unset MAIL_FROM to use the sandbox sender.'
    );

  if (name === 'daily_quota_exceeded' || name === 'monthly_quota_exceeded')
    return `Resend sending quota reached (${name}): ${msg}`;
  if (name === 'rate_limit_exceeded')
    return `Resend rate limit hit — too many sends per second: ${msg}`;
  if (name === 'validation_error') return `Resend rejected the message (validation): ${msg}`;

  // What a timeout, DNS failure, or aborted request looks like: the SDK's fetch
  // wrapper swallows the cause and reports statusCode null.
  if (status === null || status === undefined)
    return `Could not reach the Resend API (${msg}) — network, DNS, or the ${SEND_TIMEOUT_MS} ms timeout, not credentials.`;

  return `${msg} (${name || 'error'}${status ? ` ${status}` : ''})`;
}

/**
 * Check the credentials at boot without sending anything.
 *
 * GET /domains is the closest thing Resend has to SMTP's `verify()`: it proves
 * the key is live and, as a bonus, tells us whether MAIL_FROM's domain is
 * actually verified — the single most common reason a send fails once the key
 * itself is fine. Resolves to { ok, reason } instead of throwing so the caller
 * needs no try/catch.
 *
 * A "Sending access" key cannot list domains (401 restricted_api_key). That is
 * still a usable key, so it is reported as OK with a note rather than as a fault.
 */
async function verifyMailCredentials() {
  if (!isMailConfigured())
    return { ok: false, reason: 'RESEND_API_KEY is missing from .env (or is not a "re_…" key)' };

  let res;
  try {
    res = await resend().domains.list();
  } catch (err) {
    return { ok: false, reason: err.message };
  }

  if (res.error) {
    if (res.error.name === 'restricted_api_key')
      return { ok: true, note: 'send-only key — domain status could not be checked' };
    return { ok: false, reason: describeMailError(res.error), code: res.error.name };
  }

  if (usingTestSender())
    return {
      ok: true,
      note: `sandbox sender ${TESTING_FROM} — delivers ONLY to your own Resend account address. Verify a domain and set MAIL_FROM to email real users.`,
    };

  // res.data is either an array or { data: [...] } depending on API version.
  const domains = Array.isArray(res.data) ? res.data : res.data?.data || [];
  const host = fromAddress().split('@').pop().replace(/>$/, '').trim().toLowerCase();
  const match = domains.find((d) => String(d.name).toLowerCase() === host);

  if (!match)
    return {
      ok: false,
      reason: `MAIL_FROM uses @${host}, which is not a domain on this Resend account. Add it at https://resend.com/domains, or unset MAIL_FROM to use the sandbox sender.`,
    };
  if (match.status !== 'verified')
    return {
      ok: false,
      reason: `@${host} is on the account but its status is "${match.status}", not "verified" — publish the DNS records Resend lists for it.`,
    };

  return { ok: true };
}

// The name comes from a signup form, so it is never dropped into HTML raw.
const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The token is signed, but it lands inside href="…" — so it is escaped too, and
// percent-encoded so a '+' or '&' in it survives the URL intact.
const verifyUrlFor = (token) => {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${clientUrl}/verify-email?token=${encodeURIComponent(String(token))}`;
};

function buildHtml(who, verificationLink) {
  const href = escapeHtml(verificationLink);
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f1f5f9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
            <h2 style="color: ${BRAND};">Welcome to ${APP_NAME}!</h2>
            <p style="color: #555555;">Dear ${who},</p>
            <p style="color: #555555;">
                Thank you for signing up with ${APP_NAME}. Before we can complete your registration, we need to verify your email address.
                Please click the button below to verify your email:
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${href}"
                    style="background-color: ${BRAND}; color: white; padding: 12px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">
                    Verify Email
                </a>
            </div>
            <p style="color: #555555;">If the button above doesn't work, copy and paste the following link into your browser:</p>
            <p style="color: ${LINK}; word-break: break-all;">${href}</p>
            <p style="color: #888888; font-size: 13px;">This link expires in 24 hours. You will not be able to sign in until your email is verified.</p>
            <hr style="border-top: 1px solid #e4e4e4; margin: 30px 0;">
            <p style="color: #888888; font-size: 12px; text-align: center;">
                ${APP_NAME} — AI Customer Support | &copy; ${new Date().getFullYear()} All rights reserved
            </p>
        </div>
    </div>`;
}

/**
 * Send the account verification email over HTTPS. The link points at the
 * frontend, which reads the token and calls GET /api/auth/verify-email.
 *
 * Throws (with .status where it is meaningful) so the caller can keep the account
 * and print the link — never returns a silent failure. The Resend SDK reports
 * failures in its resolved value rather than by throwing, so the { error } branch
 * below is the real error path; try/catch would only ever catch the SDK itself
 * breaking.
 */
const sendVerificationEmail = async (name, email, token) => {
  const to = String(email || '').trim();
  if (!to) {
    const err = new Error('No recipient address to send the verification email to');
    err.status = 400;
    throw err;
  }

  const api = resend(); // throws 503 when RESEND_API_KEY is absent
  const verificationLink = verifyUrlFor(token);
  const who = escapeHtml(name || 'there');

  const { data, error } = await api.emails.send(
    {
      from: fromAddress(),
      to: [to],
      subject: `Verify your ${APP_NAME} account`,
      ...(process.env.MAIL_REPLY_TO ? { replyTo: process.env.MAIL_REPLY_TO } : {}),
      text:
        `Dear ${name || 'there'},\n\nThank you for signing up with ${APP_NAME}. ` +
        `Verify your email address by opening this link:\n${verificationLink}\n\n` +
        `The link expires in 24 hours. You cannot sign in until your email is verified.`,
      html: buildHtml(who, verificationLink),
    },
    {
      // fetch() has no default timeout, so a hung connection would otherwise hold
      // the registration request open indefinitely.
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      // Makes a retried send (double-clicked "Resend", a proxy replay) reuse the
      // first result within 24h instead of delivering a second copy. Keyed on the
      // token, so a genuinely NEW link is always a new send.
      idempotencyKey: `verify:${crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 32)}`,
    }
  );

  if (error) {
    const err = new Error(describeMailError(error));
    err.code = error.name;
    // 4xx from Resend is our configuration being wrong, not the caller's request,
    // so it is reported as 503 "mail not available" rather than passed through.
    err.status = error.statusCode >= 500 || !error.statusCode ? 502 : 503;
    throw err;
  }

  return { id: data?.id, to, provider: 'resend' };
};

module.exports = {
  sendVerificationEmail,
  isMailConfigured,
  verifyMailCredentials,
  describeMailError,
  fromAddress,
  usingTestSender,
  verifyUrlFor,
  APP_NAME,
};
