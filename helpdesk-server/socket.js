// socket.js — Socket.io setup for real-time chat + live ticket board
const { Server } = require('socket.io');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || '*' },
  });

  io.on('connection', (socket) => {
    socket.on('join:admins', () => socket.join('admins'));        // admin dashboard room
    socket.on('join:ticket', (id) => socket.join(`ticket:${id}`)); // per-ticket chat room
  });

  return io;
}

module.exports = { initSocket };
