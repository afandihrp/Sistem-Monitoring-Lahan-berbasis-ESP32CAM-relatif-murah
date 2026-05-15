require('dotenv/config');
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const initWebSocket = require('./src/websocket');
const createRouter = require('./src/routes');
const { publishService } = require('./src/services/mdns');
const { initTelegramBot } = require('./src/services/telegram');

const app = express();
const port = 3000;

// Path to SSL certificates
const options = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.cert'))
};

// Create HTTPS server
const server = https.createServer(options, app);

// Initialize WebSocket server
const wss = initWebSocket(server);

// Serve data directory
app.use('/data', express.static(path.join(__dirname, '../data')));

// Initialize Routes
app.use('/', createRouter(wss));

server.listen(port, '0.0.0.0', () => {
  console.log(`HTTPS Server running at https://0.0.0.0:${port}/`);
  
  // Initialize Telegram Bot
  initTelegramBot();

  // Publish mDNS service for gateway.local
  publishService('gateway', 'https', port, 'gateway.local');
});
