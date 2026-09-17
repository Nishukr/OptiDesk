// routes/ticketRoutes.js — the customer's own tickets, authenticated by Clerk.
//
// Staff equivalents of these endpoints live in routes/adminRoutes.js under the
// custom JWT. Splitting them by URL is what keeps the two auth systems from having
// to coexist inside a single request: nothing here reads JWT_SECRET, and nothing
// there touches Clerk.
//
// requireCustomer resolves the Clerk user id (req.auth.userId) to the local User
// document and presents it as req.user = { id, role: 'customer' }, so the
// controllers below are unchanged from the single-auth version.
const router = require('express').Router();
const {
  createTicket,
  listTickets,
  getTicket,
  confirmResolution,
} = require('../controllers/ticketController');
const { requireCustomer } = require('../middleware/clerkAuth');

router.use(requireCustomer);

router.post('/', createTicket);
router.get('/', listTickets); // scoped to req.user.id inside the controller
router.get('/:id', getTicket); // ownership is re-checked inside the controller

// Step 2 of the resolution handshake, and the only step a customer owns: "is your
// problem solved?". The controller additionally checks that the caller raised this
// exact ticket, so one customer can never answer for another.
router.post('/:id/confirm', confirmResolution);

module.exports = router;
