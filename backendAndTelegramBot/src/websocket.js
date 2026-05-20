const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const { logEvent, getLogs } = require('./services/logger');
const { sendMotionAlert } = require('./services/telegram');

const CONFIG_FILE = path.join(__dirname, '../../data/servoConfig.json');

// Hardcoded API key for ESP32-CAM security
const CAMERA_API_KEY = 'momo_gemoy_api_key_123';

// Track connected camera devices
const devices = new Map();

function heartbeat() {
  this.isAlive = true;
}

function broadcastDeviceList(wss) {
  const deviceList = Array.from(devices.values()).map(device => ({
    id: device.id,
    name: device.name,
    status: device.status,
    ip: device.ip,
    mac: device.mac,
    type: device.type,
    signalBars: device.signalBars,
    lastSeen: device.lastSeen
  }));

  const payload = JSON.stringify({ type: 'device_list', devices: deviceList });
  
  wss.clients.forEach((client) => {
    // Only send to Kiosks (not the camera itself)
    if (client.readyState === 1 && !client.path.startsWith('/camera')) {
      client.send(payload);
    }
  });
}

function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const isCamera = req.url.startsWith('/camera');
    const remoteIp = req.socket.remoteAddress.replace('::ffff:', '');
    const macAddress = req.headers['x-mac-address'] || 'Unknown MAC';
    const apiKey = req.headers['x-api-key'];
    
    console.log(`Connection attempt: URL=${req.url}, isCamera=${isCamera}, IP=${remoteIp}`);
    
    // Security check for camera connections
    if (isCamera) {
      if (apiKey !== CAMERA_API_KEY) {
        console.warn(`SECURITY: Unauthorized camera connection attempt from ${remoteIp}. Incorrect API Key.`);
        ws.terminate();
        return;
      }
    }
    
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    ws.path = req.url; // Store path to identify client type later
    ws.remoteIp = remoteIp; // Store IP for status updates
    ws.lastDataReceived = Date.now(); // Initialize for stream-activity heartbeat

    if (isCamera) {
      console.log(`Camera connected: ${remoteIp} (MAC: ${macAddress})`);
      const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
      devices.set(deviceId, {
        id: deviceId,
        name: macAddress !== 'Unknown MAC' ? `ESP32-CAM [${macAddress}]` : `ESP32-CAM (${remoteIp})`,
        status: 'Online',
        ip: remoteIp,
        mac: macAddress,
        type: 'Camera',
        signalBars: 0,
        lastSeen: new Date().toLocaleTimeString(),
        ws: ws  // simpan referensi untuk on-demand capture
      });
      broadcastDeviceList(wss);

      if (fs.existsSync(CONFIG_FILE)) {
        try {
          const allConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE));
          const config = allConfigs[macAddress];
          if (config) {
            ws.send(JSON.stringify({ type: 'servo_config_update', config }));
            console.log(`Sent servo config to camera ${macAddress}`);
          }
        } catch(e) { console.error('Error sending config to camera:', e); }
      }
    } else {
      console.log('Kiosk connected.');
      // Send current device list to the new Kiosk immediately
      broadcastDeviceList(wss);
      
      // Send historical logs to the kiosk
      const historicalLogs = getLogs();
      if (historicalLogs && historicalLogs.length > 0) {
        ws.send(JSON.stringify({ type: 'historical_logs', logs: historicalLogs }));
      }
    }
    
    ws.on('message', (message, isBinary) => {
      if (isCamera) {
        ws.lastDataReceived = Date.now(); // Proof of life via data stream (any message)
      }

      if (isBinary && isCamera) {
        // Broadcast binary camera frames ONLY to Kiosks that subscribed to THIS camera
        const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && !client.path.startsWith('/camera') && client.activeDeviceId === deviceId) {
            client.send(message, { binary: true });
          }
        });
      } else if (!isBinary) {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'signal' && isCamera) {
            const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
            const device = devices.get(deviceId);
            if (device) {
              device.signalBars = data.bars;
              device.lastSeen = new Date().toLocaleTimeString();
              broadcastDeviceList(wss);
            }
          } else if (data.type === 'motion' && isCamera) {
            const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
            const device = devices.get(deviceId);
            const location = device ? device.name : remoteIp;
            
            console.log(`Motion detected by ${location}: ${data.sensor}`);

            // Log event to data/log.json
            logEvent({
              type: 'motion_event',
              sensor: data.sensor,
              location: location,
              deviceId: deviceId,
              timestamp: new Date().toISOString()
            });

            // Broadcast motion event to all Kiosks
            const payload = JSON.stringify({ 
              type: 'motion_event', 
              sensor: data.sensor, 
              location: location,
              deviceId: deviceId,
              timestamp: new Date().toISOString()
            });
            
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                client.send(payload);
              }
            });

            // Telegram alert sekarang dikirim dari routes.js SETELAH foto tersimpan
            // agar gambar yang dilampirkan selalu foto dari event ini, bukan foto lama

          } else if (data.type === 'set_active_stream' && !isCamera) {
            // Kiosk subscribing to a specific camera stream
            ws.activeDeviceId = data.deviceId;
            console.log(`Kiosk subscribed to stream: ${data.deviceId}`);
          } else if (data.type === 'servo_control' && !isCamera) {
            // Forward servo control from Kiosk to specific Camera
            const device = devices.get(data.deviceId);
            if (device && device.ws && device.ws.readyState === 1) {
              device.ws.send(JSON.stringify({ type: 'servo_control', value: data.value }));
            }
          } else if (data.type === 'get_servo_config' && !isCamera) {
            // Retrieve config from file and send back to Kiosk
            if (fs.existsSync(CONFIG_FILE)) {
              try {
                const allConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE));
                const config = allConfigs[data.mac] || null;
                ws.send(JSON.stringify({ type: 'servo_config_response', mac: data.mac, config }));
              } catch (e) { console.error('Error reading config:', e); }
            } else {
              ws.send(JSON.stringify({ type: 'servo_config_response', mac: data.mac, config: null }));
            }
          } else if (data.type === 'save_servo_config' && !isCamera) {
            // Save config to file
            let allConfigs = {};
            if (fs.existsSync(CONFIG_FILE)) {
              try { 
                const rawData = fs.readFileSync(CONFIG_FILE);
                allConfigs = JSON.parse(rawData); 
              } catch (e) {}
            }
            allConfigs[data.mac] = { ...data.config, lastUpdated: new Date().toISOString() };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(allConfigs, null, 2));
            console.log(`Servo config saved via WS for MAC: ${data.mac}`);
            ws.send(JSON.stringify({ type: 'save_servo_config_success', mac: data.mac }));
            
            // Push updated config directly to the specific camera device via WebSocket
            const deviceArray = Array.from(devices.values());
            const cameraDevice = deviceArray.find(d => d.mac === data.mac);
            if (cameraDevice && cameraDevice.ws && cameraDevice.ws.readyState === 1) {
               cameraDevice.ws.send(JSON.stringify({ type: 'servo_config_update', config: data.config }));
               console.log(`Pushed updated servo config to camera ${data.mac}`);
            }
          }
        } catch (e) {
          console.log(`Received text message from ${isCamera ? 'Camera' : 'Kiosk'}: ${message}`);
        }
      }
    });

    ws.on('close', () => {
      if (isCamera) {
        const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
        const device = devices.get(deviceId);
        if (device) {
          device.status = 'Offline';
          device.lastSeen = new Date().toLocaleTimeString();
          console.log(`Camera ${remoteIp} disconnected.`);
          broadcastDeviceList(wss);
        }
      } else {
        console.log('Kiosk connection closed.');
      }
    });
  });

  // Heartbeat interval check setiap 5 detik
  const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.path && ws.path.startsWith('/camera')) {
        // Stream-activity heartbeat for ESP32-CAM (5-second threshold)
        if (Date.now() - ws.lastDataReceived > 5000) {
          console.log(`[Heartbeat] Camera stream timeout: ${ws.path}. Terminating.`);
          const deviceId = `cam_${ws.remoteIp.replace(/\./g, '_')}`;
          const device = devices.get(deviceId);
          if (device) {
            device.status = 'Offline';
            device.lastSeen = new Date().toLocaleTimeString();
            broadcastDeviceList(wss);
          }
          return ws.terminate();
        }
      } else {
        // Standard WS heartbeat for Kiosks
        // We only ping every 30s (6 cycles of 5s) to save bandwidth
        if (!ws.pingCounter) ws.pingCounter = 0;
        ws.pingCounter++;
        
        if (ws.pingCounter >= 6) {
          ws.pingCounter = 0;
          if (ws.isAlive === false) {
            console.log(`Terminating inactive connection: ${ws.path}`);
            return ws.terminate();
          }
          ws.isAlive = false;
          ws.ping();
        }
      }
    });
  }, 5000);


  wss.on('close', function close() {
    clearInterval(interval);
  });

  return wss;
}

// Kirim perintah capture ke kamera tertentu via WebSocket
function sendCaptureRequest(deviceId) {
  const device = devices.get(deviceId);
  if (!device || !device.ws || device.ws.readyState !== 1) {
    console.log(`sendCaptureRequest: device ${deviceId} not available`);
    return false;
  }
  device.ws.send(JSON.stringify({ type: 'capture_request' }));
  console.log(`Capture request sent to ${deviceId}`);
  return true;
}

// Getter untuk mengakses daftar perangkat yang terhubung dari modul lain
function getDevices() {
  return devices;
}

module.exports = { initWebSocket, getDevices, sendCaptureRequest };
