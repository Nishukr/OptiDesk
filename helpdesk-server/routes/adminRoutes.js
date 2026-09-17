// routes/adminRoutes.js — every staff-only endpoint, behind the ORIGINAL custom JWT.
//
// Clerk is deliberately absent from this file. Staff sign in with the password
// form at /admin/login, get a JWT signed with JWT_SECRET, and this router is the
// only thing that accepts it. Customers cannot reach any of it: their Clerk
// session is not a JWT_SECRET-signed token, so middleware/auth.js rejects it at
// the door, and requireRole rejects anything that is not agent/admin after that.
//
// These paths used to live at /api/tickets and /api/users. They moved under
// /api/admin so the two auth systems own disjoint URL space — which is what lets
// the client's axios interceptor decide, from the path alone, which token to send.
const router = require('express').Router();
const {
  listTickets,
  getTicket,
  updateTicket,
  proposeResolution,
  deleteTicket,
} = require('../controllers/ticketController');
const { listCustomers, listAgents, getCustomer } = require('../controllers/userController');
const { chat, history } = require('../controllers/chatController');
const { auth, requireRole } = require('../middleware/auth');

// Guard the whole router in one place. Nothing below is reachable without a valid
// staff JWT, so an added route cannot accidentally ship unauthenticated.
router.use(auth, requireRole('agent', 'admin'));

// ---- tickets: the staff board ----
router.get('/tickets', listTickets); // every customer's tickets, filterable
router.get('/tickets/:id', getTicket);
router.patch('/tickets/:id', updateTicket); // triage: status / priority / assignee
router.post('/tickets/:id/resolve', proposeResolution); // step 1 of the handshake
// Step 3. Still refuses with 409 until the customer has confirmed — the
// admin-only gate is on top of that, not instead of it.
router.delete('/tickets/:id', requireRole('admin'), deleteTicket);

// ---- the people behind the tickets ----
router.get('/customers', listCustomers);
router.get('/agents', listAgents); // the "assign to" dropdown
router.get('/customers/:id', getCustomer);

// ---- knowledge-base assistant, staff side ----
router.post('/chat', chat);
router.get('/chat/:ticketId/history', history);

module.exports = router;
