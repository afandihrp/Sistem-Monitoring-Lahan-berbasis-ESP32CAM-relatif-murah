const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Bonjour } = require('bonjour-service');
const { WebSocketServer } = require('ws');

const app = express();
const port = 3000;
const bonjour = new Bonjour();

// Path to SSL certificates
const options = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.cert'))
};

// Hello World route
app.get('/', (req, res) => {
  res.send('hello world');
});

// Action route to control frontend stream
app.get('/action', (req, res) => {
  const action = req.query.do;
  if (action === 'left' || action === 'right') {
    const payload = JSON.stringify({ type: 'stream_action', direction: action });
    wss.clients.forEach((client) => {
      // WebSocket.OPEN is 1
      if (client.readyState === 1) {
        client.send(payload);
      }
    });
    console.log(`Broadcasted action: ${action}`);
    res.send(`Action ${action} executed`);
  } else {
    res.status(400).send('Invalid action. Use ?do=left or ?do=right');
  }
});

// Create HTTPS server
const server = https.createServer(options, app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established.');
  
  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed.');
  });
});

server.listen(port, () => {
  console.log(`HTTPS Server running at https://localhost:${port}/`);
  
  // Publish mDNS service for gateway.local
  bonjour.publish({ name: 'gateway', type: 'https', port: port, host: 'gateway.local' });
  console.log('mDNS service "gateway.local" published.');
});
