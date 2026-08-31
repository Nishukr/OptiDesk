// middleware/error.js — 404 + centralized error handler
function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  // A malformed id in the URL is a bad request, not a server fault.
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
}

module.exports = { notFound, errorHandler };
