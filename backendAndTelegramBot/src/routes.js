const express = require('express');
const fs = require('fs');
const path = require('path');
const { aiClient } = require('./services/aiClient');
const { logEvent, updateLatestLogImage, updateLatestLogWithAI } = require('./services/logger');
const { sendMotionAlert, notifyCaptureResult } = require('./services/telegram');

/**
 * Call Python AI Server via WebSocket to check if a person is in the image and get annotated image
 */
async function checkPersonAI(imageBuffer) {
  const result = await aiClient.sendRequest(imageBuffer, true, 10000);
  
  const details = {
    status: result.status,
    message: result.pesan,
    person_detected: result.ada_orang,
    person_count: result.jumlah_orang,
    box_coordinates: result.koordinat_kotak
  };

  const annotatedImageBuffer = Buffer.from(result.annotated_image, 'base64');
  return {
    details,
    imageBuffer: annotatedImageBuffer
  };
}

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

        // Log capture event to log.json with "telegram capture" type
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

        // Broadcast updated logs to all Kiosks
        const { getLogs } = require('./services/logger');
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

      // PIR motion: Attempt to call Python AI Object Detection first
      res.send('Uploaded');

      // Start the dynamic PIR video recording after the high-res upload completes
      const { getDevices } = require('./websocket');
      const devices = getDevices();
      const deviceId = `cam_${ip.replace(/\./g, '_')}`;
      const device = devices.get(deviceId);
      if (device) {
        // Clear the 8-second pre-upload safety timeout
        if (device.pirActiveTimeout) {
          clearTimeout(device.pirActiveTimeout);
          device.pirActiveTimeout = null;
        }

        const { getGlobalAiEnabled, getPirAiDetection, getPirAiRecording } = require('./websocket');
        const { aiClient } = require('./services/aiClient');
        const isAiOnline = aiClient.isConnected && getGlobalAiEnabled() && getPirAiDetection();

        const shouldRecord = !getGlobalAiEnabled() || getPirAiRecording();
        if (shouldRecord) {
          device.isRecordingAi = true;
          device.aiSensorName = sensor;
          device.lastTimePersonSeen = Date.now();
          
          // Trim rollingBuffer to keep only the pre-roll frames of the sweep movement
          while (device.rollingBuffer.length > 30) {
            device.rollingBuffer.shift();
          }
          
          console.log(`[PIR Video] Start recording video stream for ${deviceId} after high-res photo upload.`);

          // Tell camera to cancel its local return-to-center timer since the backend is now actively recording/monitoring
          if (device.ws && device.ws.readyState === 1) {
            device.ws.send(JSON.stringify({ type: 'cancel_return' }));
            console.log(`[PIR Video] Sent cancel_return command to camera ${deviceId}`);
          }

          if (!isAiOnline) {
            // AI is offline: record for a flat 10 seconds post-upload, then stop and return to center
            console.log(`[PIR Video] AI is offline/disabled. Scheduling flat 10-second stop & return for ${deviceId}.`);
            const { stopAiRecording } = require('./websocket');
            device.pirActiveTimeout = setTimeout(() => {
              if (device.isRecordingAi) {
                stopAiRecording(deviceId);
              }
              device.pirActiveTimeout = null;
            }, 10000);
          } else {
            // AI is online: use 90-second safety fallback timeout
            console.log(`[PIR Video] AI is online. Scheduling 90-second safety fallback timeout for ${deviceId}.`);
            const { stopAiRecording } = require('./websocket');
            device.pirActiveTimeout = setTimeout(() => {
              if (device.isRecordingAi) {
                stopAiRecording(deviceId);
              }
              device.pirActiveTimeout = null;
            }, 90000);
          }
        } else {
          device.isPirActive = false;
          console.log(`[PIR Video] PIR recording is disabled. Skipping recording for ${deviceId}.`);
        }
      }

      // Process the remaining logic asynchronously in the background
      (async () => {
        let imageToSave = req.body;
        let humanPresence = false;
        let aiDetails = null;

        const { getGlobalAiEnabled, getPirAiDetection } = require('./websocket');

        if (getGlobalAiEnabled() && getPirAiDetection()) {
          try {
            console.log(`[AI Object Detection] Analyzing picture from IP: ${ip}, Sensor: ${sensor}...`);
            const aiResult = await checkPersonAI(req.body);
            
            if (aiResult && aiResult.imageBuffer) {
              imageToSave = aiResult.imageBuffer;
              if (aiResult.details) {
                humanPresence = aiResult.details.person_detected === true;
                aiDetails = aiResult.details;
                console.log(`[AI Object Detection] Result: ${aiResult.details.message} (Human count: ${aiResult.details.person_count})`);
              }
            }
          } catch (aiErr) {
            console.error('[AI Object Detection] Failed to call local AI API (Falling back to raw image):', aiErr.message);
            // Graceful fallback: imageToSave remains req.body, humanPresence is false
          }
        } else {
          console.log(`[AI Object Detection] PIR AI Detection is disabled. Skipping AI analysis for IP: ${ip}.`);
        }

        // Save the finalized image (either AI-outlined or raw fallback)
        fs.writeFileSync(filepath, imageToSave);
        
        // Update the log JSON
        updateLatestLogWithAI(sensor, ip, imageUrl, humanPresence, aiDetails);
        
        // Send motion alert to Telegram
        sendMotionAlert(`IP: ${ip}`, sensor, filename);

        // Notify Web Clients
        const payload = JSON.stringify({
          type: 'motion_image_update',
          sensor: sensor,
          deviceId: `cam_${ip.replace(/\./g, '_')}`,
          imageUrl: imageUrl,
          humanPresence: humanPresence,
          aiDetails: aiDetails
        });

        // Broadcast updated historical logs
        const { getLogs } = require('./services/logger');
        const payloadLogs = JSON.stringify({
          type: 'historical_logs',
          logs: getLogs()
        });

        wss.clients.forEach((client) => {
          if (client.readyState === 1 && !client.path.startsWith('/camera')) {
            client.send(payload);
            client.send(payloadLogs);
          }
        });
      })().catch(err => {
        console.error('Asynchronous background image processing error:', err);
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

