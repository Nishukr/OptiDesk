// services/verifyToken.js — the JWT that goes in the verification link.
//
// Signed with a secret DERIVED from JWT_SECRET rather than JWT_SECRET itself.
// That matters: middleware/auth.js accepts anything JWT_SECRET signs, so a
// verification link signed with it would work as a Bearer session token for as
// long as it lives. Domain separation makes that impossible with no extra config,
// and the `purpose` claim is a second lock (auth rejects tokens that carry one).
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const PURPOSE = 'verify-email';
const TTL = process.env.EMAIL_VERIFY_TTL || '24h';

function secret() {
  const base = process.env.EMAIL_VERIFY_SECRET || process.env.JWT_SECRET;
  if (!base) throw new Error('JWT_SECRET (or EMAIL_VERIFY_SECRET) is missing from .env');
  // Explicit EMAIL_VERIFY_SECRET is used as-is; otherwise derive a distinct key.
  return process.env.EMAIL_VERIFY_SECRET || `${base}::${PURPOSE}`;
}

/**
 * Signed token for this user, valid for EMAIL_VERIFY_TTL (default 24h).
 *
 * `jti` is a random nonce, and it is not decoration: signing is deterministic and
 * `iat` only has second resolution, so without it a resend inside the same second
 * as the original produces a byte-identical token — and the stored fingerprint
 * that is supposed to retire the previous link would not change.
 */
function signVerifyToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, purpose: PURPOSE, jti: crypto.randomUUID() },
    secret(),
    { expiresIn: TTL }
  );
}

/**
 * Check a token from the link.
 * → { ok: true, payload }            valid
 * → { ok: false, reason: 'expired' } older than the TTL
 * → { ok: false, reason: 'invalid' } tampered, wrong secret, or not a verify token
 */
function readVerifyToken(token) {
  try {
    const payload = jwt.verify(String(token), secret());
    if (payload.purpose !== PURPOSE) return { ok: false, reason: 'invalid' };
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, reason: err.name === 'TokenExpiredError' ? 'expired' : 'invalid' };
  }
}

module.exports = { signVerifyToken, readVerifyToken, PURPOSE, TTL };
