// server.js — entry point: connect DB, start HTTP server + Socket.io
require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  const server = http.createServer(app);
  const io = initSocket(server);
  app.set('io', io); // so controllers can emit via req.app.get('io')
  server.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
}

start();
