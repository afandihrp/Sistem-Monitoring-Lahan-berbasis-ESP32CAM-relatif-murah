const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const { aiClient } = require('./services/aiClient');
const { logEvent, getLogs } = require('./services/logger');
const { sendMotionAlert } = require('./services/telegram');

const CONFIG_FILE = path.join(__dirname, '../../data/servoConfig.json');

// Hardcoded API key for ESP32-CAM security
const CAMERA_API_KEY = 'momo_gemoy_api_key_123';

// Track connected camera devices and globally active stream
const devices = new Map();
let globalActiveDeviceId = null;
let wssInstance = null;

/**
 * Helper to call local Python AI for real-time stream detection (JSON only)
 */
function detectStreamAI(imageBuffer) {
  return aiClient.sendRequest(imageBuffer, false, 5000)
    .catch((err) => {
      console.warn('[AI Client] Stream detection failed:', err.message);
      return null;
    });
}

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
  wssInstance = wss;

  wss.on('connection', (ws, req) => {
    const isCamera = req.url.startsWith('/camera');
    const remoteIp = req.socket.remoteAddress.replace('::ffff:', '');
    
    // Parse query parameters from request URL
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const macAddress = url.searchParams.get('mac') || 'Unknown MAC';
    const apiKey = url.searchParams.get('apiKey');
    
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

      // Auto-activate first online camera if none active, or if current active is offline
      const currentActiveDevice = globalActiveDeviceId ? devices.get(globalActiveDeviceId) : null;
      if (!globalActiveDeviceId || !currentActiveDevice || currentActiveDevice.status === 'Offline') {
        globalActiveDeviceId = deviceId;
        console.log(`[Auto-Activate] Set camera as global active stream: ${globalActiveDeviceId}`);
        const activeStreamPayload = JSON.stringify({ type: 'active_stream_updated', deviceId: globalActiveDeviceId });
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && !client.path.startsWith('/camera')) {
            client.send(activeStreamPayload);
          }
        });
      }

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

      // Send current AI server connection status immediately
      ws.send(JSON.stringify({ type: 'ai_status', isConnected: aiClient.isConnected }));

      // Send current active stream to the new Kiosk immediately to synchronize
      if (globalActiveDeviceId) {
        ws.send(JSON.stringify({ type: 'active_stream_updated', deviceId: globalActiveDeviceId }));
      }
    }
    
    ws.on('message', (message, isBinary) => {
      if (isCamera) {
        ws.lastDataReceived = Date.now(); // Proof of life via data stream (any message)
      }

      if (isBinary && isCamera) {
        const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
        const device = devices.get(deviceId);

        if (device) {
          device.latestFrame = message; // Keep updating to the absolute newest frame
          
          // Only run AI stream processing for the globally active camera stream
          if (deviceId === globalActiveDeviceId) {
            // --- EXPERIMENTAL MAXED-OUT MODE ---
            // if (!device.isAiProcessing) {
            //   device.isAiProcessing = true;
            //   device.latestFrame = null; // Clear frame to prevent repeat
              
            //   detectStreamAI(message).then(result => {
            //     device.isAiProcessing = false;
            //     if (result && result.status === 'success') {
            //       const boxPayload = JSON.stringify({
            //         type: 'stream_boxes',
            //         deviceId: deviceId,
            //         boxes: result.koordinat_kotak
            //       });
                  
            //       // Broadcast to ALL kiosks
            //       wss.clients.forEach((client) => {
            //         if (client.readyState === 1 && !client.path.startsWith('/camera')) {
            //           client.send(boxPayload);
            //         }
            //       });
            //     }
            //   }).catch(err => {
            //     device.isAiProcessing = false;
            //   });
            // }
            // ------------------------------------
          }
        }

        // Broadcast binary camera frames ONLY for the active camera to ALL kiosks
        if (deviceId === globalActiveDeviceId) {
          wss.clients.forEach((client) => {
            if (client.readyState === 1 && !client.path.startsWith('/camera')) {
              client.send(message, { binary: true });
            }
          });
        }
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
            // Centralized Active Stream Update
            if (globalActiveDeviceId !== data.deviceId) {
              globalActiveDeviceId = data.deviceId;
              console.log(`Global active stream changed to: ${globalActiveDeviceId}`);
              
              // Broadcast stream change to ALL other kiosks
              const activeStreamPayload = JSON.stringify({ type: 'active_stream_updated', deviceId: globalActiveDeviceId });
              wss.clients.forEach((client) => {
                if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                  client.send(activeStreamPayload);
                }
              });
            }
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
          
          // Dynamic Auto-Activation Switch if active camera went offline
          if (deviceId === globalActiveDeviceId) {
            const onlineDevice = Array.from(devices.values()).find(d => d.status === 'Online');
            if (onlineDevice) {
              globalActiveDeviceId = onlineDevice.id;
              console.log(`[Auto-Activate Switch] Active camera went offline. Switched to: ${globalActiveDeviceId}`);
            } else {
              globalActiveDeviceId = null;
              console.log(`[Auto-Activate Switch] Active camera went offline. No online cameras left.`);
            }
            const activeStreamPayload = JSON.stringify({ type: 'active_stream_updated', deviceId: globalActiveDeviceId });
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                client.send(activeStreamPayload);
              }
            });
          }
          
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
            
            // Dynamic Auto-Activation Switch if active camera went offline
            if (deviceId === globalActiveDeviceId) {
              const onlineDevice = Array.from(devices.values()).find(d => d.status === 'Online');
              if (onlineDevice) {
                globalActiveDeviceId = onlineDevice.id;
                console.log(`[Auto-Activate Switch] Active camera timed out. Switched to: ${globalActiveDeviceId}`);
              } else {
                globalActiveDeviceId = null;
                console.log(`[Auto-Activate Switch] Active camera timed out. No online cameras left.`);
              }
              const activeStreamPayload = JSON.stringify({ type: 'active_stream_updated', deviceId: globalActiveDeviceId });
              wss.clients.forEach((client) => {
                if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                  client.send(activeStreamPayload);
                }
              });
            }
            
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

  // Central Polling Task: Decoupled Consumer pulling the newest frame at 1 FPS (1000ms)
  // (Temporarily disabled for Maxed-Out PC experiment)
  
  const aiPollInterval = setInterval(() => {
    devices.forEach((device, deviceId) => {
      // Only run AI stream detection for the globally active camera stream to save CPU
      if (deviceId === globalActiveDeviceId && device.status === 'Online' && device.latestFrame && !device.isAiProcessing) {
        const frameToProcess = device.latestFrame;
        device.latestFrame = null; // Clear so we don't repeat the same frame
        device.isAiProcessing = true;
        
        detectStreamAI(frameToProcess).then(result => {
          device.isAiProcessing = false;
          if (result && result.status === 'success') {
            const boxPayload = JSON.stringify({
              type: 'stream_boxes',
              deviceId: deviceId,
              boxes: result.koordinat_kotak
            });
            
            // Broadcast boxes to ALL connected kiosks
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                client.send(boxPayload);
              }
            });
          }
        }).catch(err => {
          device.isAiProcessing = false;
        });
      }
    });
  }, 100);
  //-----------------------------------------------------

  aiClient.onStatusChange((isConnected) => {
    console.log(`[AI Client] Connection status changed. Connected: ${isConnected}`);
    const payload = JSON.stringify({ type: 'ai_status', isConnected });
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && !client.path.startsWith('/camera')) {
        client.send(payload);
      }
    });
  });

  wss.on('close', function close() {
    clearInterval(interval);
    clearInterval(aiPollInterval);
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

function switchActiveStream(direction) {
  const deviceList = Array.from(devices.values());
  if (deviceList.length <= 1) return globalActiveDeviceId;

  let currentIndex = deviceList.findIndex(d => d.id === globalActiveDeviceId);
  if (currentIndex === -1) currentIndex = 0;

  let nextIndex;
  if (direction === 'right') {
    nextIndex = (currentIndex + 1) % deviceList.length;
  } else {
    nextIndex = (currentIndex - 1 + deviceList.length) % deviceList.length;
  }

  globalActiveDeviceId = deviceList[nextIndex].id;
  console.log(`[SwitchActiveStream] Changed active stream to: ${globalActiveDeviceId} (direction: ${direction})`);

  if (wssInstance) {
    const activeStreamPayload = JSON.stringify({ type: 'active_stream_updated', deviceId: globalActiveDeviceId });
    wssInstance.clients.forEach((client) => {
      if (client.readyState === 1 && !client.path.startsWith('/camera')) {
        client.send(activeStreamPayload);
      }
    });
  }
  return globalActiveDeviceId;
}

module.exports = { initWebSocket, getDevices, sendCaptureRequest, switchActiveStream };
