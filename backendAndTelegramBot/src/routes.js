const express = require('express');
const fs = require('fs');
const path = require('path');
const { updateLatestLogImage } = require('./services/logger');
const { sendMotionAlert, notifyCaptureResult } = require('./services/telegram');

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

  // Upload route for high-res snapshot from ESP32-CAM
  router.post('/upload', express.raw({ limit: '10mb', type: 'image/jpeg' }), (req, res) => {
    const sensor = req.query.sensor;
    const ip = req.query.ip;
    
    if (!req.body || !sensor || !ip) {
      return res.status(400).send('Missing body, sensor or ip');
    }
    
    const timestamp = Date.now();
    const filename = `motion_${ip.replace(/\./g, '_')}_${sensor}_${timestamp}.jpg`;
    const filepath = path.join(__dirname, '../../data', filename);
    
    fs.writeFile(filepath, req.body, (err) => {
      if (err) {
        console.error('Error saving image:', err);
        return res.status(500).send('Error saving image');
      }

      if (sensor === 'capture') {
        // On-demand capture: kembalikan foto ke Telegram yang menunggu
        notifyCaptureResult(filepath);
      } else {
        // PIR motion: update log, kirim alert Telegram, broadcast ke kiosk
        const imageUrl = `/data/${filename}`;
        updateLatestLogImage(sensor, ip, imageUrl);
        sendMotionAlert(`IP: ${ip}`, sensor, filepath);


        const payload = JSON.stringify({
          type: 'motion_image_update',
          sensor: sensor,
          deviceId: `cam_${ip.replace(/\./g, '_')}`,
          imageUrl: imageUrl
        });
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && !client.path.startsWith('/camera')) {
            client.send(payload);
          }
        });
      }

      res.send('Uploaded');
    });
  });

  return router;
}

module.exports = createRouter;
