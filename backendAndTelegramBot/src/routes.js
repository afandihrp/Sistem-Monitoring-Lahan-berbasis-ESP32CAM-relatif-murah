const express = require('express');
const fs = require('fs');
const path = require('path');
const { logEvent, getLogs } = require('./services/logger');
const { notifyCaptureResult } = require('./services/telegram');

function createRouter(wss) {
  const router = express.Router();

  // Hello World route
  router.get('/', (req, res) => {
    res.send('hello world');
  });

  // Action route to control frontend stream
  router.get('/action', (req, res) => {
    const action = req.query.do;
    if (action === 'left' || action === 'right') {
      const { switchActiveStream } = require('./websocket');
      const newActiveId = switchActiveStream(action);
      console.log(`Action ${action} executed. New active stream: ${newActiveId}`);
      res.send(`Action ${action} executed. New active stream: ${newActiveId}`);
    } else {
      res.status(400).send('Invalid action. Use ?do=left or ?do=right');
    }
  });

  // API Endpoint for Tripwire Trigger (GET method for easy testing by node or browser)
  router.get('/api/tripwire', (req, res) => {
    const location = req.query.location || 'Unknown Location';
    const sensor = req.query.sensor || 'Tripwire_01';

    try {
      // 1. Trigger Telegram Spam Alert
      const { triggerTripwireAlert } = require('./services/telegram');
      triggerTripwireAlert(location, sensor);

      // 2. Log event so it appears in the frontend dashboard
      logEvent({
        type: 'tripwire alert',
        sensor: sensor,
        location: location,
        message: 'Voltage Drop Detected (<= 1.0V)!',
        timestamp: new Date().toISOString()
      });

      // 3. Notify connected websocket clients to update their UI with new logs
      const payloadLogs = JSON.stringify({
        type: 'historical_logs',
        logs: getLogs()
      });
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && (!client.path || !client.path.startsWith('/camera'))) {
          client.send(payloadLogs);
        }
      });

      console.log(`[API] Tripwire triggered via API: ${sensor} at ${location}`);
      res.status(200).send(`Tripwire alert triggered for sensor: ${sensor} at location: ${location}`);
    } catch (err) {
      console.error('[API] Error triggering tripwire:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  // Upload route for high-res snapshot from ESP32-CAM
  router.post('/upload', express.raw({ limit: '10mb', type: 'image/jpeg' }), async (req, res) => {
    const sensor = req.query.sensor;
    const ip = req.query.ip;

    if (!req.body || !sensor || !ip) {
      return res.status(400).send('Missing body, sensor or ip');
    }

    const timestamp = Date.now();
    const filename = `motion_${ip.replace(/\./g, '_')}_${sensor}_${timestamp}.jpg`;
    const photosDir = path.join(__dirname, '../../data/photos');
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
    }
    const filepath = path.join(photosDir, filename);
    const imageUrl = `/data/photos/${filename}`;

    try {
      if (sensor === 'capture') {
        // On-demand capture: save raw image immediately
        fs.writeFileSync(filepath, req.body);

        const { getDevices } = require('./websocket');
        const devices = getDevices();
        const deviceId = `cam_${ip.replace(/\./g, '_')}`;
        const device = devices.get(deviceId);
        const location = device ? device.ip : ip;

        logEvent({
          type: 'telegram capture',
          sensor: sensor,
          location: location,
          deviceId: deviceId,
          imageUrl: imageUrl,
          timestamp: new Date().toISOString()
        });

        const payloadLogs = JSON.stringify({
          type: 'historical_logs',
          logs: getLogs()
        });
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && !client.path.startsWith('/camera')) {
            client.send(payloadLogs);
          }
        });

        notifyCaptureResult(filename);
        return res.send('Uploaded (Capture)');
      }

      // PIR motion: respond immediately, then hand off all logic to websocket.js
      res.send('Uploaded');

      const { handlePirUpload } = require('./websocket');
      handlePirUpload(ip, sensor, req.body, wss, filepath, filename, imageUrl).catch(err => {
        console.error('[Routes] handlePirUpload error:', err);
      });

    } catch (err) {
      console.error('Error processing upload:', err);
      if (!res.headersSent) {
        res.status(500).send('Error processing upload');
      }
    }
  });

  return router;
}

module.exports = createRouter;
