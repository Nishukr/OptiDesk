// routes/chatRoutes.js — the customer's AI support assistant (RAG).
// Staff use the same controllers via /api/admin/chat under the custom JWT.
const router = require('express').Router();
const { chat, history } = require('../controllers/chatController');
const { requireCustomer } = require('../middleware/clerkAuth');

router.use(requireCustomer);

router.post('/', chat);
router.get('/:ticketId/history', history); // 403s unless the ticket is the caller's

module.exports = router;
