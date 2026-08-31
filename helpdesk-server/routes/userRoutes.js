// routes/userRoutes.js — staff-only directory of customers and agents
const router = require('express').Router();
const { listCustomers, listAgents, getCustomer } = require('../controllers/userController');
const { auth, requireRole } = require('../middleware/auth');

// Guard the whole router: a customer must never be able to list other customers.
router.use(auth, requireRole('agent', 'admin'));

router.get('/customers', listCustomers); // keep before "/:id" so it isn't read as an id
router.get('/agents', listAgents);
router.get('/:id', getCustomer);

module.exports = router;
