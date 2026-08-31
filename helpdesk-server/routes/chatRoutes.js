// routes/chatRoutes.js — AI support assistant
const router = require('express').Router();
const { chat, history } = require('../controllers/chatController');
const { auth } = require('../middleware/auth');

router.post('/', auth, chat);
router.get('/:ticketId/history', auth, history);

module.exports = router;
