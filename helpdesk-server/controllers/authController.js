// controllers/authController.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationEmail, isMailConfigured, verifyUrlFor } = require('../services/mailer');
const { signVerifyToken, readVerifyToken } = require('../services/verifyToken');

// This controller is now STAFF ONLY. Customers are owned by Clerk end to end:
// they sign up in Clerk's widget, Clerk stores the credential, and the local User
// row is a mirror created by middleware/clerkAuth.js (or the webhook). Nothing
// below runs for a customer, which is why bcrypt/jsonwebtoken/Resend all stay —
// they are the staff credential store, not dead weight.
//
// The only self-serve role left is "admin", and it still requires the
// ADMIN_SIGNUP_CODE from the server .env: without that gate anyone could sign
// themselves up and read every customer's tickets. Agents are created by staff
// (scripts/seedAdmin.js).
const SELF_SERVE_ROLES = ['admin'];

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // mirrors EMAIL_VERIFY_TTL, for the stored expiry column
const CLIENT_URL = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

// Decide the role for a new signup, or return an error message to send back.
function resolveRole(requested, adminCode) {
  const role = requested || 'admin';

  // A customer POSTing here is not an error in their behaviour, it is the wrong
  // door — say which one is right instead of a bare 400. Creating the row anyway
  // would produce a password-backed customer that Clerk knows nothing about, so
  // their session token would never resolve to it.
  if (role === 'customer')
    return {
      status: 400,
      error: `Customer accounts are created at ${CLIENT_URL()}/signup, not here. This endpoint issues staff logins only.`,
      code: 'use_customer_signup',
    };

  if (!SELF_SERVE_ROLES.includes(role))
    return { status: 400, error: 'role must be "admin"' };

  const expected = process.env.ADMIN_SIGNUP_CODE;
  if (!expected)
    return {
      status: 403,
      error: 'Admin sign-up is turned off. Set ADMIN_SIGNUP_CODE in the server .env (or run "npm run seed:admin").',
    };
  if (adminCode !== expected) return { status: 403, error: 'That admin sign-up code is not correct' };
  return { role: 'admin' };
}

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// The schema stores emails lowercased/trimmed, but Mongoose does NOT apply those
// setters to query filters — so findOne({ email: 'Me@Gmail.com' }) would miss the
// stored 'me@gmail.com'. Without this, signing up or logging in with different
// capitalisation than you registered with fails (duplicate-key 500 / bogus 401).
const normEmail = (e) => String(e || '').toLowerCase().trim();

/**
 * Mint a verification JWT, remember its fingerprint, and email the link.
 *
 * The JWT carries the identity and the expiry (signed, so neither can be edited
 * in the URL). The sha256 of the token is stored on the user for one reason the
 * JWT cannot cover on its own: statelessness means a token stays replayable
 * until it expires. Keeping the fingerprint of the *current* token makes each
 * link single-use and makes a resend invalidate the previous one.
 *
 * The send is awaited, so a caller that reaches the next line knows the mail
 * provider accepted the message. Nothing here ever puts the token in the HTTP
 * response — the link must arrive by email, or the address is not being proven.
 */
async function issueVerification(user) {
  const token = signVerifyToken(user);
  user.verifyTokenHash = hashToken(token);
  user.verifyTokenExpires = new Date(Date.now() + TOKEN_TTL_MS);
  await user.save();

  // The mailer owns the link shape (it builds and escapes the same URL for the
  // email body), so it is asked for it here rather than rebuilt.
  const url = verifyUrlFor(token);
  try {
    const info = await sendVerificationEmail(user.name, user.email, token);
    return { url, id: info?.id };
  } catch (err) {
    err.verifyUrl = url; // so the caller can print a usable link to the console
    throw err;
  }
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role: requestedRole, adminCode } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (String(password).length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const decided = resolveRole(requestedRole, adminCode);
    if (decided.error)
      return res.status(decided.status).json({ error: decided.error, code: decided.code });

    const addr = normEmail(email);
    if (await User.findOne({ email: addr })) return res.status(409).json({ error: 'Email already used' });

    const passwordHash = await bcrypt.hash(password, 10);
    // isVerified stays false — the account exists but cannot log in yet.
    const user = await User.create({ name, email: addr, passwordHash, role: decided.role });

    // The send is AWAITED before the 201 goes out, so `emailSent` in the response
    // reports what actually happened rather than what was merely attempted. A
    // failure must not lose the account: keep the user and let them hit "Resend".
    // The link is logged so local development still works with no mail provider.
    let emailSent = true;
    try {
      const { id } = await issueVerification(user);
      // Printed so you can watch, in the API console, that the link goes to the
      // address typed into the signup form (never to the sending account).
      console.log(`✉️  Verification email sent to ${user.email}${id ? ` (resend id ${id})` : ''}`);
    } catch (mailErr) {
      emailSent = false;
      console.warn(`✉️  Could not send verification email to ${user.email}: ${mailErr.message}`);
      if (mailErr.verifyUrl) console.warn(`   Verify manually by opening: ${mailErr.verifyUrl}`);
    }

    res.status(201).json({
      id: user._id,
      email: user.email,
      role: user.role,
      needsVerification: true,
      emailSent,
      // Distinguishes "no API key in the environment" from "key present but the
      // send itself failed" (revoked key, unverified sending domain, quota). The
      // client used to blame the .env for every failure, sending you to fix
      // something that was not broken.
      mailConfigured: isMailConfigured(),
      message: emailSent
        ? 'Account created. Check your inbox for the verification link.'
        : 'Account created, but the verification email could not be sent. Configure RESEND_API_KEY on the server, then use "Resend email".',
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/verify-email?token=<jwt> — called by the client page that the
// emailed link opens. Answers JSON so the page can render its own state.
//   200 { status: 'success' | 'already' }
//   400 { status: 'invalid' }   410 { status: 'expired' }
exports.verifyEmail = async (req, res, next) => {
  try {
    const reply = (code, status, message) => res.status(code).json({ ok: code === 200, status, message });
    const { token } = req.query;
    if (!token) return reply(400, 'invalid', 'No verification token was supplied.');

    // Signature and expiry are settled before touching the database.
    const check = readVerifyToken(token);
    if (!check.ok)
      return check.reason === 'expired'
        ? reply(410, 'expired', 'This link has expired. Request a new one from the sign-in page.')
        : reply(400, 'invalid', 'This verification link is not valid.');

    // Indexed _id lookup — the token says who it belongs to.
    const user = await User.findById(check.payload.sub).select('+verifyTokenHash');
    if (!user) return reply(400, 'invalid', 'That account no longer exists.');
    if (user.isVerified) return reply(200, 'already', 'This address was already verified. You can sign in.');

    // Rejects a token that was already spent, or superseded by a newer resend.
    if (user.verifyTokenHash !== hashToken(String(token)))
      return reply(400, 'invalid', 'This link has already been used or replaced by a newer one.');

    user.isVerified = true;
    user.verifiedAt = new Date();
    user.verifyTokenHash = undefined;
    user.verifyTokenExpires = undefined;
    await user.save();

    return reply(200, 'success', 'Your email is verified. You can sign in now.');
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/verify?token=... — the shape earlier emails used, where the link
// hit the API directly. Kept so those links still work: hand the token to the
// client page and let the flow above run.
exports.verifyEmailLegacy = (req, res) => {
  const token = req.query.token ? `?token=${encodeURIComponent(String(req.query.token))}` : '?token=';
  res.redirect(`${CLIENT_URL()}/verify-email${token}`);
};

// POST /api/auth/resend { email } — new link for an unverified account.
// Always answers the same way so this cannot be used to discover which
// email addresses are registered.
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // ONE reply for every outcome: unknown address, already verified, sent, and
    // provider failure. Returning the mail error to the caller (as this used to)
    // turned the endpoint into an account oracle — only a registered, unverified
    // address could produce a 503, so the status code answered "is this email
    // registered here?" for anyone who asked. The reason still reaches the API
    // console, which is where the operator is looking.
    //
    // `mailConfigured` is a property of the server, not of the address, so it
    // gives the UI something actionable without identifying anybody.
    const generic = {
      message: 'If that address needs verifying, a new link is on its way.',
      mailConfigured: isMailConfigured(),
    };

    // Clerk owns customer email verification, so a customer row is treated
    // exactly like an unknown address here — same generic reply, no mail sent.
    const user = await User.findOne({ email: normEmail(email) });
    if (!user || user.isVerified || user.role === 'customer') return res.json(generic);

    try {
      const { id } = await issueVerification(user);
      console.log(`✉️  Verification email re-sent to ${user.email}${id ? ` (resend id ${id})` : ''}`);
    } catch (mailErr) {
      console.warn(`✉️  Resend failed for ${user.email}: ${mailErr.message}`);
      if (mailErr.verifyUrl) console.warn(`   Verify manually by opening: ${mailErr.verifyUrl}`);
    }
    res.json(generic);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: normEmail(email) });

    // The hint is attached to EVERY rejection below, never only to the customer
    // case. Returning it conditionally would turn this endpoint into an account
    // oracle: "which form should I use?" would answer "does this address exist,
    // and is it a customer?" for anyone who asked. Constant text carries none of
    // that, and the confused customer still gets pointed at the right door.
    const invalid = () =>
      res.status(401).json({
        error: 'Invalid credentials',
        hint: `This is the staff sign-in. Customer accounts sign in at ${CLIENT_URL()}/login.`,
      });

    // No passwordHash means the row is a Clerk mirror (a customer). There is no
    // password to compare, and bcrypt.compare(pw, undefined) throws — which used
    // to surface as a 500 on a perfectly ordinary typo-the-wrong-form mistake.
    if (!user || !user.passwordHash || user.role === 'customer') return invalid();
    if (!(await bcrypt.compare(password, user.passwordHash))) return invalid();

    // Password is right, but the address is unproven — no token is issued.
    if (!user.isVerified)
      return res.status(403).json({
        error: 'Please verify your email address before logging in. Check your inbox for the link.',
        needsVerification: true,
        email: user.email,
      });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    res.json(user);
  } catch (err) {
    next(err);
  }
};
