// routes/ticketRoutes.js
const router = require('express').Router();
const { createTicket, listTickets, getTicket, updateTicket } = require('../controllers/ticketController');
const { auth, requireRole } = require('../middleware/auth');

router.post('/', auth, createTicket);
router.get('/', auth, listTickets);
router.get('/:id', auth, getTicket); // ownership is checked inside the controller
router.patch('/:id', auth, requireRole('agent', 'admin'), updateTicket);

module.exports = router;
