require('dotenv/config');
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const { initWebSocket } = require('./src/websocket');
const createRouter = require('./src/routes/index');
const { publishService } = require('./src/services/mdns');
const { initTelegramBot } = require('./src/telegram/index');

const app = express();
const port = 3000;
const httpPort = 3005;

// Path to SSL certificates
const options = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.cert'))
};

// Create HTTPS server
const server = https.createServer(options, app);

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
  console.log(`HTTPS Server running at https://0.0.0.0:${port}/`);
  
  // Initialize Telegram Bot
  initTelegramBot();

  // Publish mDNS service for gateway.local
  publishService('gateway', 'https', port, 'gateway.local');
});

httpServer.listen(httpPort, '0.0.0.0', () => {
  console.log(`HTTP Server running at http://0.0.0.0:${httpPort}/`);
});
