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

// Track connected camera devices
const devices = new Map();

function heartbeat() {
  this.isAlive = true;
}

function broadcastDeviceList() {
  const deviceList = Array.from(devices.values()).map(device => ({
    id: device.id,
    name: device.name,
    status: device.status,
    ip: device.ip,
    type: device.type,
    lastSeen: device.lastSeen
  }));

  const payload = JSON.stringify({ type: 'device_list', devices: deviceList });
  
  wss.clients.forEach((client) => {
    // Only send to Kiosks (not the camera itself)
    if (client.readyState === 1 && client.path !== '/camera') {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws, req) => {
  const isCamera = req.url === '/camera';
  const remoteIp = req.socket.remoteAddress.replace('::ffff:', '');
  
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  ws.path = req.url; // Store path to identify client type later

  if (isCamera) {
    console.log(`New Camera connection from ${remoteIp}`);
    const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
    devices.set(deviceId, {
      id: deviceId,
      name: `ESP32-CAM (${remoteIp})`,
      status: 'Online',
      ip: remoteIp,
      type: 'Camera',
      lastSeen: new Date().toLocaleTimeString()
    });
    broadcastDeviceList();
  } else {
    console.log('New Kiosk connection established.');
    // Send current device list to the new Kiosk immediately
    broadcastDeviceList();
  }
  
  ws.on('message', (message) => {
    console.log(`Received message from ${isCamera ? 'Camera' : 'Kiosk'}: ${message}`);
  });

  ws.on('close', () => {
    if (isCamera) {
      const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
      const device = devices.get(deviceId);
      if (device) {
        device.status = 'Offline';
        device.lastSeen = new Date().toLocaleTimeString();
        console.log(`Camera ${remoteIp} disconnected.`);
        broadcastDeviceList();
      }
    } else {
      console.log('Kiosk connection closed.');
    }
  });
});

// Heartbeat interval check every 30 seconds
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) {
      console.log(`Terminating inactive connection: ${ws.path}`);
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 5000);

wss.on('close', function close() {
  clearInterval(interval);
});

server.listen(port, () => {
  console.log(`HTTPS Server running at https://localhost:${port}/`);
  
  // Publish mDNS service for gateway.local
  bonjour.publish({ name: 'gateway', type: 'https', port: port, host: 'gateway.local' });
  console.log('mDNS service "gateway.local" published.');
});
