// routes/webhookRoutes.js — Clerk's server-to-server callbacks.
//
// The raw body parser is mounted HERE rather than in app.js so it applies to this
// path and nothing else: Svix verifies a signature over the exact bytes Clerk
// sent, and express.json() would have already replaced them with a parsed object
// by the time the handler ran. Every other route still gets normal JSON parsing.
const router = require('express').Router();
const express = require('express');
const { clerkWebhook } = require('../controllers/webhookController');

// No auth middleware on purpose — the caller is Clerk, not a signed-in user. The
// Svix signature check inside the handler is what authenticates the request.
router.post('/clerk', express.raw({ type: 'application/json' }), clerkWebhook);

module.exports = router;
