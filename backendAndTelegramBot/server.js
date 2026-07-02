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

const cors = require('cors');

// Dynamic CORS Hardening: Only allow localhost and local LAN IPs on port 5173
const allowedOriginsPattern = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):5173$/;

app.use(cors({
  origin: (origin, callback) => {
    // Allow tools like curl, mobile apps, or same-origin requests (no origin header)
    if (!origin) return callback(null, true);
    
    if (allowedOriginsPattern.test(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
      callback(null, false); // Block origin by returning false (doesn't send CORS headers)
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-MAC-Address']
}));

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
