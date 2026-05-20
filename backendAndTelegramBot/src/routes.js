const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { updateLatestLogImage, updateLatestLogWithAI } = require('./services/logger');
const { sendMotionAlert, notifyCaptureResult } = require('./services/telegram');

/**
 * Parse custom multipart response from Python AI server
 */
function parsePythonMultipartResponse(buffer) {
  const boundary = '--Response-Boundary-123456789';
  const indices = [];
  let index = buffer.indexOf(boundary);
  
  while (index !== -1) {
    indices.push(index);
    index = buffer.indexOf(boundary, index + boundary.length);
  }
  
  if (indices.length < 3) {
    throw new Error(`Invalid multipart response structure: expected 3 boundaries, found ${indices.length}`);
  }
  
  // Part 1: JSON details
  const part1HeaderEnd = buffer.indexOf('\r\n\r\n', indices[0]);
  if (part1HeaderEnd === -1 || part1HeaderEnd >= indices[1]) {
    throw new Error('Invalid Part 1 headers');
  }
  const jsonStart = part1HeaderEnd + 4;
  const jsonEnd = indices[1] - 2; // subtract \r\n
  const jsonBuffer = buffer.subarray ? buffer.subarray(jsonStart, jsonEnd) : buffer.slice(jsonStart, jsonEnd);
  const details = JSON.parse(jsonBuffer.toString('utf8'));
  
  // Part 2: Outlined Image
  const part2HeaderEnd = buffer.indexOf('\r\n\r\n', indices[1]);
  if (part2HeaderEnd === -1 || part2HeaderEnd >= indices[2]) {
    throw new Error('Invalid Part 2 headers');
  }
  const imageStart = part2HeaderEnd + 4;
  const imageEnd = indices[2] - 2; // subtract \r\n
  const imageBuffer = buffer.subarray ? buffer.subarray(imageStart, imageEnd) : buffer.slice(imageStart, imageEnd);
  
  return { details, imageBuffer };
}

/**
 * Call Python Flask server to check if a person is in the image
 */
function checkPersonAI(imageBuffer) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    
    const bodyBuffer = Buffer.concat([
      Buffer.from(header, 'utf8'),
      imageBuffer,
      Buffer.from(footer, 'utf8')
    ]);
    
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/checkPerson',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length
      },
      timeout: 10000 // 10s timeout
    };
    
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const resBuffer = Buffer.concat(chunks);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = parsePythonMultipartResponse(resBuffer);
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Failed to parse AI response: ${err.message}`));
          }
        } else {
          reject(new Error(`AI Server returned HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AI request timeout'));
    });
    
    req.write(bodyBuffer);
    req.end();
  });
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
    
    fs.writeFile(filepath, req.body, async (err) => {
      if (err) {
        console.error('Error saving image:', err);
        return res.status(500).send('Error saving image');
      }

      if (sensor === 'capture') {
        // On-demand capture: kembalikan foto ke Telegram yang menunggu
        notifyCaptureResult(filepath);
      } else {
        // PIR motion: call Python AI Object Detection to analyze image
        let humanPresence = false;
        let aiDetails = null;
        let imageUrl = `/data/${filename}`;
        let alertFilepath = filepath;

        try {
          console.log(`[AI Object Detection] Analyzing picture from IP: ${ip}, Sensor: ${sensor}...`);
          const aiResult = await checkPersonAI(req.body);
          
          if (aiResult && aiResult.details) {
            humanPresence = aiResult.details.ada_orang === true;
            aiDetails = aiResult.details;
            console.log(`[AI Object Detection] Result: ${aiResult.details.pesan} (Human count: ${aiResult.details.jumlah_orang})`);
            
            // If human is detected, save the returned outlined output image and update logs
            if (humanPresence) {
              const outlinedFilename = `motion_${ip.replace(/\./g, '_')}_${sensor}_${timestamp}_outlined.jpg`;
              const outlinedFilepath = path.join(__dirname, '../../data', outlinedFilename);
              
              // Save the returned outlined output image (imageBuffer) from the python code
              fs.writeFileSync(outlinedFilepath, aiResult.imageBuffer);
              console.log(`[AI Object Detection] Outlined image saved to: ${outlinedFilename}`);
              
              // Use the outlined image for the kiosk and Telegram alert
              imageUrl = `/data/${outlinedFilename}`;
              alertFilepath = outlinedFilepath;
            }
          }
        } catch (aiErr) {
          console.error('[AI Object Detection] Failed to call local AI API:', aiErr.message);
          // Graceful fallback: humanPresence remains false, original raw image remains the target
        }

        // Update the log JSON with humanPresence boolean and YOLO details
        updateLatestLogWithAI(sensor, ip, imageUrl, humanPresence, aiDetails);
        
        // Send motion alert to Telegram (outlined if human present, otherwise raw)
        sendMotionAlert(`IP: ${ip}`, sensor, alertFilepath);

        const payload = JSON.stringify({
          type: 'motion_image_update',
          sensor: sensor,
          deviceId: `cam_${ip.replace(/\./g, '_')}`,
          imageUrl: imageUrl,
          humanPresence: humanPresence,
          aiDetails: aiDetails
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

