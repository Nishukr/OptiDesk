// app.js — Express app, middleware, and route mounting
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// health check
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'helpdesk-api' }));

// feature routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes); // staff-only customer directory
app.use('/api/chat', chatRoutes); // AI support assistant (RAG)

app.use(notFound);
app.use(errorHandler);

module.exports = app;
