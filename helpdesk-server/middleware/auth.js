// middleware/auth.js — verify JWT and guard by role
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET); // { id, role }
    // Only login tokens open a session. Single-purpose tokens (email
    // verification, and anything added later) carry a `purpose` claim and are
    // refused here even if they were signed with JWT_SECRET — belt and braces
    // alongside the separate secret in services/verifyToken.js.
    if (payload.purpose) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden' });

module.exports = { auth, requireRole };
