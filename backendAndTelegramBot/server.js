const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const initWebSocket = require('./src/websocket');
const createRouter = require('./src/routes');
const { publishService } = require('./src/services/mdns');

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

// Initialize Routes
app.use('/', createRouter(wss));

server.listen(port, () => {
  console.log(`HTTPS Server running at https://localhost:${port}/`);
  
  // Publish mDNS service for gateway.local
  publishService('gateway', 'https', port, 'gateway.local');
});
