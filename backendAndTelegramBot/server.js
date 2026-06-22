require('dotenv/config');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

const { initWebSocket } = require('./src/websocket');
const createRouter = require('./src/routes/index');
const { initTelegramBot } = require('./src/telegram/index');
const { initUdpDiscovery } = require('./src/services/udp_discovery');
const { publishService } = require('./src/services/mdns');

const app = express();
const port = 3000;
const httpPort = 3005;

// Remove HTTPS server, use HTTP instead
const server = http.createServer(app);

// Create HTTP server
const httpServer = http.createServer(app);

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-MAC-Address');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize WebSocket server
const wss = initWebSocket([server, httpServer]);

// Serve data directory
app.use('/data', express.static(path.join(__dirname, '../data')));

// Initialize Routes
app.use('/', createRouter(wss));

server.listen(port, '0.0.0.0', () => {
  console.log(`HTTP Server running at http://0.0.0.0:${port}/`);
  
  // Initialize Telegram Bot
  initTelegramBot();
  
  // Publish mDNS so frontends can discover via gateway.local
  publishService('gateway', 'http', port, 'gateway.local');
});

httpServer.listen(httpPort, '0.0.0.0', () => {
  console.log(`HTTP Server running at http://0.0.0.0:${httpPort}/`);
  
  // Initialize UDP Discovery
  initUdpDiscovery(httpPort);
});
