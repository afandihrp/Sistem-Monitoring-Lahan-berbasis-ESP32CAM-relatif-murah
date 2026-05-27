const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.concurrency(2); // Prevents thread starvation on RPi 3
sharp.cache(false);       // Conserves RAM on low-memory systems
const { aiClient } = require('./services/aiClient');
const { logEvent, getLogs } = require('./services/logger');
const { sendMotionAlert } = require('./services/telegram');

const CONFIG_FILE = path.join(__dirname, '../../data/servoConfig.json');
const SYSTEM_SETTINGS_FILE = path.join(__dirname, '../../data/systemSettings.json');
const CAMERA_CONFIG_FILE = path.join(__dirname, '../../data/cameraConfig.json');

// Hardcoded API key for ESP32-CAM security
const CAMERA_API_KEY = 'momo_gemoy_api_key_123';

// Track connected camera devices and globally active stream
const devices = new Map();
let globalActiveDeviceId = null;
let wssInstance = null;
let globalAiEnabled = true;
let globalViewMode = 'single';

function loadSystemSettings() {
  try {
    if (fs.existsSync(SYSTEM_SETTINGS_FILE)) {
      const data = fs.readFileSync(SYSTEM_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      globalAiEnabled = settings.globalAiEnabled !== undefined ? settings.globalAiEnabled : true;
      globalViewMode = settings.globalViewMode || 'single';
      console.log(`[Settings] Loaded system settings: ViewMode = ${globalViewMode}, AI = ${globalAiEnabled ? 'ENABLED' : 'DISABLED'}`);
    } else {
      console.log('[Settings] No system settings file found, using defaults.');
    }
  } catch (err) {
    console.error('[Settings] Failed to load system settings:', err.message);
  }
}

function saveSystemSettings() {
  try {
    const parentDir = path.dirname(SYSTEM_SETTINGS_FILE);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const settings = {
      globalAiEnabled,
      globalViewMode
    };
    fs.writeFileSync(SYSTEM_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    console.log('[Settings] Saved system settings successfully.');
  } catch (err) {
    console.error('[Settings] Failed to save system settings:', err.message);
  }
}

// Load settings immediately on server start
loadSystemSettings();

/**
 * Helper to call local Python AI for real-time stream detection (JSON only)
 */
function detectStreamAI(imageBuffer) {
  if (!aiClient.isConnected) {
    return Promise.resolve(null);
  }
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

/**
 * Stitch JPEG frames based on the number of online devices using sharp
 */
async function stitchFrames(onlineDevices) {
  const count = onlineDevices.length;
  if (count === 0) return null;
  if (count === 1) return onlineDevices[0].latestFrame;

  try {
    // Resize all active frames to 480x320 with Letterbox/Contain in parallel to handle asymmetric resolutions
    const resizedFrames = await Promise.all(
      onlineDevices.slice(0, 4).map(async (dev) => {
        if (!dev.latestFrame) return null;
        try {
          return await sharp(dev.latestFrame)
            .resize(480, 320, {
              fit: 'contain',
              background: { r: 0, g: 0, b: 0 }
            })
            .toBuffer();
        } catch (resizeErr) {
          console.error(`[Stitching] Failed to resize frame for device ${dev.id}:`, resizeErr.message);
          return null;
        }
      })
    );

    if (count === 2) {
      const frame0 = resizedFrames[0];
      const frame1 = resizedFrames[1];
      if (!frame0 || !frame1) return null;

      // Stack 2 JPEGs horizontally (Left / Right, output: 960x320)
      return await sharp({
        create: {
          width: 960,
          height: 320,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
      .composite([
        { input: frame0, top: 0, left: 0 },
        { input: frame1, top: 0, left: 480 }
      ])
      .jpeg({ quality: 75 })
      .toBuffer();
    } else {
      // 3 or 4 JPEGs in a 2x2 grid (output: 960x640)
      const compositeList = [];
      for (let i = 0; i < Math.min(resizedFrames.length, 4); i++) {
        const frameBuffer = resizedFrames[i];
        if (frameBuffer) {
          const top = i < 2 ? 0 : 320;
          const left = i % 2 === 0 ? 0 : 480;
          compositeList.push({ input: frameBuffer, top, left });
        }
      }

      return await sharp({
        create: {
          width: 960,
          height: 640,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
      .composite(compositeList)
      .jpeg({ quality: 75 })
      .toBuffer();
    }
  } catch (err) {
    console.error('[Stitching] Failed to stitch JPEG frames:', err.message);
    return null;
  }
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

      if (fs.existsSync(CAMERA_CONFIG_FILE)) {
        try {
          const allCamConfigs = JSON.parse(fs.readFileSync(CAMERA_CONFIG_FILE));
          const camConfig = allCamConfigs[macAddress];
          if (camConfig) {
            ws.send(JSON.stringify({ type: 'camera_config_update', config: camConfig }));
            console.log(`Sent camera sensor config on boot to camera ${macAddress}`);
          }
        } catch(e) { console.error('Error sending camera config on boot to camera:', e); }
      }
    } else {
      console.log('Kiosk connected.');
      // Send current view mode immediately to synchronize
      ws.send(JSON.stringify({ type: 'view_mode_updated', mode: globalViewMode }));

      // Send current device list to the new Kiosk immediately
      broadcastDeviceList(wss);
      
      // Send historical logs to the kiosk
      const historicalLogs = getLogs();
      if (historicalLogs && historicalLogs.length > 0) {
        ws.send(JSON.stringify({ type: 'historical_logs', logs: historicalLogs }));
      }

      // Send current AI server connection status immediately
      ws.send(JSON.stringify({ type: 'ai_status', isConnected: aiClient.isConnected }));

      // Send current AI enabled status immediately
      ws.send(JSON.stringify({ type: 'ai_enabled_updated', enabled: globalAiEnabled }));

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

        // Broadcast binary camera frames ONLY for the active camera to kiosks in single view mode
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && !client.path.startsWith('/camera')) {
            if (globalViewMode !== 'multiple' && deviceId === globalActiveDeviceId) {
              client.send(message, { binary: true });
            }
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

          } else if (data.type === 'set_view_mode' && !isCamera) {
            globalViewMode = data.mode;
            console.log(`[ViewMode] Global view mode updated to: ${globalViewMode}`);
            saveSystemSettings();
            const viewModePayload = JSON.stringify({ type: 'view_mode_updated', mode: globalViewMode });
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                client.send(viewModePayload);
              }
            });
            if (globalViewMode === 'single') {
              const activeDevice = devices.get(globalActiveDeviceId);
              const boxPayload = JSON.stringify({
                type: 'stream_boxes',
                deviceId: globalActiveDeviceId,
                boxes: (activeDevice && activeDevice.latestBoxes) ? activeDevice.latestBoxes : []
              });
              wss.clients.forEach((client) => {
                if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                  client.send(boxPayload);
                }
              });
            }
          } else if (data.type === 'set_ai_enabled' && !isCamera) {
            globalAiEnabled = data.enabled;
            console.log(`[AI Status] Global AI state updated to: ${globalAiEnabled ? 'ENABLED' : 'DISABLED'}`);
            saveSystemSettings();
            // Broadcast AI state change to ALL kiosks so their toggles sync
            const aiStatusPayload = JSON.stringify({ type: 'ai_enabled_updated', enabled: globalAiEnabled });
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                client.send(aiStatusPayload);
              }
            });
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
          } else if (data.type === 'get_camera_config' && !isCamera) {
            if (fs.existsSync(CAMERA_CONFIG_FILE)) {
              try {
                const allConfigs = JSON.parse(fs.readFileSync(CAMERA_CONFIG_FILE));
                const config = allConfigs[data.mac] || null;
                ws.send(JSON.stringify({ type: 'camera_config_response', mac: data.mac, config }));
              } catch (e) { console.error('Error reading camera config:', e); }
            } else {
              ws.send(JSON.stringify({ type: 'camera_config_response', mac: data.mac, config: null }));
            }
          } else if (data.type === 'save_camera_config' && !isCamera) {
            let allConfigs = {};
            if (fs.existsSync(CAMERA_CONFIG_FILE)) {
              try { 
                const rawData = fs.readFileSync(CAMERA_CONFIG_FILE);
                allConfigs = JSON.parse(rawData); 
              } catch (e) {}
            }
            allConfigs[data.mac] = { ...data.config, lastUpdated: new Date().toISOString() };
            fs.writeFileSync(CAMERA_CONFIG_FILE, JSON.stringify(allConfigs, null, 2));
            console.log(`Camera config saved via WS for MAC: ${data.mac}`);
            ws.send(JSON.stringify({ type: 'save_camera_config_success', mac: data.mac }));
            
            // Push updated config directly to the specific camera device via WebSocket
            const deviceArray = Array.from(devices.values());
            const cameraDevice = deviceArray.find(d => d.mac === data.mac);
            if (cameraDevice && cameraDevice.ws && cameraDevice.ws.readyState === 1) {
               cameraDevice.ws.send(JSON.stringify({ type: 'camera_config_update', config: data.config }));
               console.log(`Pushed updated camera config to camera ${data.mac}`);
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

  let isStitchedAiProcessing = false;

  // Central Polling Task: Run AI on active single stream only when needed
  const aiPollInterval = setInterval(() => {
    if (globalViewMode === 'multiple') return; // Exit if in multiple view mode

    const hasSingleViewKiosk = wssInstance && Array.from(wssInstance.clients).some(client => 
      client.readyState === 1 && !client.path.startsWith('/camera')
    );
    if (!hasSingleViewKiosk) return;

    devices.forEach((device, deviceId) => {
      if (deviceId === globalActiveDeviceId && device.status === 'Online' && device.latestFrame) {
        const frameToProcess = device.latestFrame;
        device.latestFrame = null; // Clear so we don't repeat the same frame
        
        if (!globalAiEnabled) {
          device.latestBoxes = [];
          const boxPayload = JSON.stringify({
            type: 'stream_boxes',
            deviceId: deviceId,
            boxes: []
          });
          wss.clients.forEach(client => {
            if (client.readyState === 1 && !client.path.startsWith('/camera')) {
              client.send(boxPayload);
            }
          });
          return;
        }

        if (!device.isAiProcessing) {
          device.isAiProcessing = true;
          detectStreamAI(frameToProcess).then(result => {
            device.isAiProcessing = false;
            if (result && result.status === 'success') {
              device.latestBoxes = result.koordinat_kotak;
              
              const boxPayload = JSON.stringify({
                type: 'stream_boxes',
                deviceId: deviceId,
                boxes: result.koordinat_kotak
              });
              
              wss.clients.forEach(client => {
                if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                  client.send(boxPayload);
                }
              });
            }
          }).catch(err => {
            device.isAiProcessing = false;
          });
        }
      }
    });
  }, 200);

  // Central Stitching Task: Stitch JPEGs at 10 FPS (100ms) and run AI on combined view
  let isStitchedProcessing = false;
  const stitchInterval = setInterval(async () => {
    if (isStitchedProcessing) return;
    isStitchedProcessing = true;

    try {
      if (!wssInstance) return;

      const activeKiosks = Array.from(wssInstance.clients).filter(client => 
        client.readyState === 1 && !client.path.startsWith('/camera')
      );

      if (globalViewMode !== 'multiple') return;

      // Get all online cameras with a valid frame
      const onlineDevices = Array.from(devices.values()).filter(d => d.status === 'Online' && d.latestFrame);
      if (onlineDevices.length === 0) return;

      const stitchedBuffer = await stitchFrames(onlineDevices);
      if (!stitchedBuffer) return;

      // Send the merged binary stream to all multi-view kiosks
      activeKiosks.forEach(client => {
        client.send(stitchedBuffer, { binary: true });
      });

      // Run AI on the merged stitched binary view
      if (!globalAiEnabled) {
        const boxPayload = JSON.stringify({
          type: 'stream_boxes',
          deviceId: 'multiple',
          boxes: []
        });
        activeKiosks.forEach(client => {
          client.send(boxPayload);
        });
      } else if (!isStitchedAiProcessing) {
        isStitchedAiProcessing = true;
        detectStreamAI(stitchedBuffer).then(result => {
          isStitchedAiProcessing = false;
          if (result && result.status === 'success') {
            const boxPayload = JSON.stringify({
              type: 'stream_boxes',
              deviceId: 'multiple',
              boxes: result.koordinat_kotak
            });
            
            activeKiosks.forEach(client => {
              client.send(boxPayload);
            });
          }
        }).catch(err => {
          isStitchedAiProcessing = false;
        });
      }
    } catch (err) {
      console.error('[Stitch Interval] Error:', err.message);
    } finally {
      isStitchedProcessing = false;
    }
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
    clearInterval(stitchInterval);
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
