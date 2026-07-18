const { WebSocketServer } = require('ws');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const sqlliteScheduler = require('./services/sqllite_scheduler');

const state = require('./websocket/state');
const {
  CONFIG_FILE,
  CAMERA_CONFIG_FILE,
  loadSystemSettings,
  saveSystemSettings,
  getEffectiveCameraConfig,
  getDefaultAngle,
  getPirAngle
} = require('./websocket/configManager');
const { getDeviceConfig, upsertDeviceConfig } = require('./services/sqllite_config');

const {
  getSignalBars,
  updateDeviceServoAngle,
  broadcastDeviceList,
  switchActiveStream,
  updateFlashIntensity,
  sendCaptureRequest,
  updateDeviceSweepState
} = require('./websocket/deviceManager');

const { getCachedStoragePayload } = require('./websocket/storageMonitor');
const {
  aiQueue,
  sendAiConfigToPython,
  stopAiRecording,
  handleIncomingCameraFrame
} = require('./websocket/aiWorker');

const { wsFrameAssemblies, processChunkedMessage } = require('./websocket/frameReassembler');
const { handlePirTrigger } = require('./websocket/pirHandler');
const {
  updateDeviceAutoSweep,
  resetDeviceSweepTimer,
  clearDeviceSweep
} = require('./websocket/sweepManager');

// Require UDP server to initialize it automatically on load
require('./websocket/udpServer');

const schedulerManager = require('./websocket/schedulerManager');

// Import AI and Logger services
const { aiClient } = require('./services/aiClient');
const { logEvent, getLogs, deleteEventSingle, deleteEventsByDate } = require('./services/sqllite_logger');

// Hardcoded API key for ESP32-CAM security
const CAMERA_API_KEY = 'momo_gemoy_api_key_123';

// Connection generation counter — each new camera connection gets a unique ID
// so that stale close events from old sockets are safely ignored.
let connectionGeneration = 0;

function heartbeat() {
  this.isAlive = true;
}

/**
 * Gracefully mark a camera device as Offline and clean up its state.
 * Only processes if the generation matches (prevents stale close events).
 */
function handleCameraOffline(deviceId, reason, expectedGeneration) {
  const device = state.devices.get(deviceId);
  if (!device) return;

  // Guard: ignore stale close events from old connections
  if (expectedGeneration !== undefined && device._connectionGeneration !== expectedGeneration) {
    console.log(`[Connection] Ignoring stale ${reason} for ${deviceId} (gen ${expectedGeneration}, current gen ${device._connectionGeneration})`);
    return;
  }

  // Already offline — no-op
  if (device.status === 'Offline') return;

  device.status = 'Offline';
  device.lastSeen = new Date().toLocaleTimeString();
  console.log(`Camera ${device.ip} disconnected (${reason}).`);

  if (device.isRecordingAi) {
    stopAiRecording(deviceId);
  }
  if (device.pirActiveTimeout) {
    clearTimeout(device.pirActiveTimeout);
    device.pirActiveTimeout = null;
  }
  device.isPirActive = false;
  if (device.aiStopTimer) {
    clearTimeout(device.aiStopTimer);
    device.aiStopTimer = null;
  }
  device.isRecordingAi = false;

  // Dynamic Auto-Activation Switch if active camera went offline
  if (deviceId === state.globalActiveDeviceId) {
    const onlineDevice = Array.from(state.devices.values()).find(d => d.status === 'Online');
    if (onlineDevice) {
      state.globalActiveDeviceId = onlineDevice.id;
      console.log(`[Auto-Activate Switch] Active camera went offline. Switched to: ${state.globalActiveDeviceId}`);
    } else {
      state.globalActiveDeviceId = null;
      console.log(`[Auto-Activate Switch] Active camera went offline. No online cameras left.`);
    }
    const activeStreamPayload = JSON.stringify({ type: 'active_stream_updated', deviceId: state.globalActiveDeviceId });
    state.broadcastToKiosks(activeStreamPayload);
  }

  clearDeviceSweep(deviceId);

  broadcastDeviceList();
}



function initWebSocket(servers) {
  const wss = new WebSocketServer({ noServer: true });
  state.wssInstance = wss;

  const { authenticateWs } = require('./middleware/auth');

  const handleUpgrade = (request, socket, head) => {
    const isCamera = request.url.startsWith('/camera');
    
    if (isCamera) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      authenticateWs(request, (err, user) => {
        if (err) {
          console.log(`[WS] Blocked unauthorized kiosk connection from ${request.socket.remoteAddress}`);
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        
        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.user = user; // attach user info
          wss.emit('connection', ws, request);
        });
      });
    }
  };

  if (Array.isArray(servers)) {
    servers.forEach(s => s.on('upgrade', handleUpgrade));
  } else if (servers) {
    servers.on('upgrade', handleUpgrade);
  }

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
    ws.failedPingCount = 0;

    if (isCamera) {
      console.log(`Camera connected: ${remoteIp} (MAC: ${macAddress})`);
      const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;

      // Assign a unique generation ID to this connection
      connectionGeneration++;
      const thisGeneration = connectionGeneration;
      ws._connectionGeneration = thisGeneration;
      ws._deviceId = deviceId;

      // Check if this MAC address is already registered under a different deviceId (IP changed)
      let oldDeviceIdToRemove = null;
      if (macAddress && macAddress !== 'Unknown MAC') {
        for (const [existingId, dev] of state.devices.entries()) {
          if (dev.mac === macAddress && existingId !== deviceId) {
            console.log(`[Connection] IP changed for MAC ${macAddress}. Removing old device ID ${existingId}`);
            oldDeviceIdToRemove = existingId;
            if (dev.ws) {
              try { dev.ws.terminate(); } catch (e) { /* ignore */ }
            }
            break;
          }
        }
      }
      
      if (oldDeviceIdToRemove) {
        state.devices.delete(oldDeviceIdToRemove);
      }

      // CRITICAL: Terminate old socket for same deviceId to prevent stale close events
      const existingDevice = state.devices.get(deviceId);
      if (existingDevice && existingDevice.ws && existingDevice.ws !== ws) {
        console.log(`[Connection] Terminating stale socket for ${deviceId} (old gen ${existingDevice._connectionGeneration}, new gen ${thisGeneration})`);
        try {
          existingDevice.ws.terminate();
        } catch (e) { /* socket already dead */ }
      }

      state.devices.set(deviceId, {
        id: deviceId,
        status: 'Online',
        ip: remoteIp,
        mac: macAddress,
        type: 'Camera',
        signalBars: 5,
        signalRssi: null,
        lastSeen: new Date().toLocaleTimeString(),
        ws: ws,  // Store reference for on-demand capture
        _connectionGeneration: thisGeneration, // Track which generation this device belongs to
        rollingBuffer: [], // Buffer for JPEG frames (Pre-roll)
        motionSensor: '',
        isRecordingAi: false,
        lastTimePersonSeen: 0,
        aiSensorName: '',
        aiStopTimer: null,
        aiDurationTimer: null,
        aiRecordCooldownUntil: 0,
        latestSnapshotFilename: null,
        currentResolution: null,
        currentQuality: null,
        currentAngle: getDefaultAngle(macAddress),
        lastServoAdjustTime: 0,
        lastTelegramAlertTime: 0,
        telegramAlertsMuted: false
      });
      broadcastDeviceList();
      // Initialize automatic sweep schedules
      updateDeviceAutoSweep(deviceId);

      // Auto-activate first online camera if none active, or if current active is offline
      const currentActiveDevice = state.globalActiveDeviceId ? state.devices.get(state.globalActiveDeviceId) : null;
      if (!state.globalActiveDeviceId || !currentActiveDevice || currentActiveDevice.status === 'Offline') {
        state.globalActiveDeviceId = deviceId;
        console.log(`[Auto-Activate] Set camera as global active stream: ${state.globalActiveDeviceId}`);
        const activeStreamPayload = JSON.stringify({ type: 'active_stream_updated', deviceId: state.globalActiveDeviceId });
        state.broadcastToKiosks(activeStreamPayload);
      }

      if (fs.existsSync(CONFIG_FILE)) {
        try {
          const allConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE));
          const config = allConfigs[macAddress];
          if (config) {
            ws.send(JSON.stringify({ type: 'servo_config_update', config }));
            console.log(`Sent servo config to camera ${macAddress}`);
          }
        } catch (e) { console.error('Error sending config to camera:', e); }
      }

      // Send system settings (PIR config & UDP stream mode) to the camera on boot
      try {
        ws.send(JSON.stringify({
          type: 'system_settings_update',
          pirEnabled: state.globalSystemConfig.pirEnabled,
          pirCooldown: state.globalSystemConfig.pirCooldown,
          udpStreamEnabled: state.globalSystemConfig.udpStreamEnabled
        }));
        console.log(`Sent system settings to camera ${macAddress} (PIR Enabled: ${state.globalSystemConfig.pirEnabled}, Cooldown: ${state.globalSystemConfig.pirCooldown}s, UDP Stream: ${state.globalSystemConfig.udpStreamEnabled})`);
      } catch (e) { console.error('Error sending system settings to camera:', e); }

      if (fs.existsSync(CAMERA_CONFIG_FILE)) {
        try {
          const allCamConfigs = JSON.parse(fs.readFileSync(CAMERA_CONFIG_FILE));
          const camConfig = allCamConfigs[macAddress];
          if (camConfig) {
            const device = state.devices.get(deviceId);
            const configToSend = getEffectiveCameraConfig(camConfig, device);
            ws.send(JSON.stringify({ type: 'camera_config_update', config: configToSend }));
            device.currentResolution = configToSend.resolution;
            device.currentQuality = configToSend.quality;
            console.log(`Sent camera sensor config on boot to camera ${macAddress} (scaleMode: ${camConfig.scaleMode || 'static'}, Res: ${configToSend.resolution}, Qual: ${configToSend.quality})`);
          }
        } catch (e) { console.error('Error sending camera config on boot to camera:', e); }
      }
    } else {
      console.log('Kiosk connected.');

      // Send current device list to the new Kiosk immediately
      broadcastDeviceList();

      // Send historical logs to the kiosk
      const historicalLogs = getLogs();
      if (historicalLogs && historicalLogs.length > 0) {
        ws.send(JSON.stringify({ type: 'historical_logs', logs: historicalLogs }));
      }

      // Send current AI server connection status immediately
      ws.send(JSON.stringify({ type: 'ai_status', isConnected: aiClient.isConnected }));

      // Send latest cached storage info without recalculating disk space for each new Kiosk
      const cachedStoragePayload = getCachedStoragePayload();
      if (cachedStoragePayload) {
        ws.send(JSON.stringify(cachedStoragePayload));
      }

      // Send current AI enabled status immediately
      ws.send(JSON.stringify({ type: 'ai_enabled_updated', enabled: state.globalAiEnabled }));

      // Send current active stream to the new Kiosk immediately to synchronize
      if (state.globalActiveDeviceId) {
        ws.send(JSON.stringify({ type: 'active_stream_updated', deviceId: state.globalActiveDeviceId }));
      }

      // Send current AI configurations immediately to synchronize
      ws.send(JSON.stringify({
        type: 'ai_config_response',
        config: {
          pirAiDetection: state.globalPirAiDetection,
          pirAiRecording: state.globalPirAiRecording,
          streamAiDetection: state.globalStreamAiDetection,
          streamAiRecording: state.globalStreamAiRecording,
          streamAiTelegram: state.globalStreamAiTelegram,
          telegramInterval: state.globalTelegramInterval,
          objectTracking: state.globalObjectTracking,
          maxDuration: state.globalMaxDuration
        }
      }));

      // Send current system configurations immediately to synchronize
      ws.send(JSON.stringify({
        type: 'system_config_response',
        config: {
          ...state.globalSystemConfig,
          schedules: sqlliteScheduler.getAllSchedules()
        }
      }));
    }

    ws.on('message', (message, isBinary) => {
      if (isCamera) {
        ws.lastDataReceived = Date.now(); // Proof of life via data stream (any message)
        ws.isAlive = true;                // Reset liveness check on incoming data
        ws.failedPingCount = 0;           // Clear failed pings

        // Update device lastSeen on any activity (not just signal messages)
        const actDeviceId = ws._deviceId;
        if (actDeviceId) {
          const actDevice = state.devices.get(actDeviceId);
          if (actDevice && actDevice._connectionGeneration === ws._connectionGeneration) {
            actDevice.lastSeen = new Date().toLocaleTimeString();
          }
        }
      }

      if (isBinary && isCamera) {
        const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
        processChunkedMessage(deviceId, remoteIp, message, wsFrameAssemblies, handleIncomingCameraFrame);
      } else if (!isBinary) {
        try {
          const data = JSON.parse(message.toString());
          if ((data.type === 'heartbeat_pong' || data.type === 'heartbeat') && isCamera) {
            // App-layer keepalive — data-activity already updated above, nothing else to do.
            // This silently absorbs heartbeat messages to prevent 'unknown type' log noise.
          } else if (data.type === 'signal' && isCamera) {
            const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
            const device = state.devices.get(deviceId);
            if (device) {
              const rssi = (data.rssi !== undefined) ? Number(data.rssi) : null;
              device.signalRssi = rssi;
              if (rssi !== null) {
                device.signalBars = getSignalBars(rssi);
              } else if (data.bars !== undefined) {
                device.signalBars = Number(data.bars);
              }
              device.lastSeen = new Date().toLocaleTimeString();
              broadcastDeviceList();

              // Apply dynamic scaling if configured
              if (fs.existsSync(CAMERA_CONFIG_FILE)) {
                try {
                  const allCamConfigs = JSON.parse(fs.readFileSync(CAMERA_CONFIG_FILE));
                  const camConfig = allCamConfigs[device.mac];
                  if (camConfig && camConfig.scaleMode === 'dynamic') {
                    const configToSend = getEffectiveCameraConfig(camConfig, device);
                    if (device.currentResolution !== configToSend.resolution || device.currentQuality !== configToSend.quality) {
                      device.ws.send(JSON.stringify({ type: 'camera_config_update', config: configToSend }));
                      device.currentResolution = configToSend.resolution;
                      device.currentQuality = configToSend.quality;
                      console.log(`Dynamic resolution scaling updated camera ${device.mac} to Res=${configToSend.resolution}, Qual=${configToSend.quality} (RSSI: ${device.signalRssi} dBm, Bars: ${device.signalBars})`);
                    }
                  }
                } catch (e) {
                  console.error('Error handling dynamic resolution scaling on signal update:', e);
                }
              }
            }
          } else if (data.type === 'sweep_status' && isCamera) {
            const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
            const device = state.devices.get(deviceId);
            if (device) {
              updateDeviceSweepState(deviceId, data.value, true);
            }
          } else if (data.type === 'motion' && isCamera) {
            const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
            const device = state.devices.get(deviceId);
            let location = remoteIp;

            if (device && device.mac) {
              const conf = getDeviceConfig(device.mac);
              if (conf && conf.name) {
                location = conf.name;
              }
            }

            if (!state.globalSystemConfig.pirEnabled) {
              console.log(`[PIR Sensor] Ignored motion event from camera ${location} (PIR disabled in system settings)`);
              return;
            }

            console.log(`Motion detected by ${location}: ${data.sensor}`);

            if (device) {
              const now = Date.now();
              const cooldownMs = (state.globalSystemConfig.pirCooldown || 30) * 1000;
              if (device.lastPirTriggerTime && (now - device.lastPirTriggerTime < cooldownMs)) {
                console.log(`[PIR Sensor] Ignored motion event from camera ${location} (Cooldown active)`);
                return;
              }
              device.lastPirTriggerTime = now;

              device.isPirActive = true;
              device.lastTimePersonSeen = Date.now();
              updateDeviceServoAngle(deviceId, getPirAngle(device.mac, data.sensor), true);
              if (device.pirActiveTimeout) {
                clearTimeout(device.pirActiveTimeout);
              }

              // Immediately grab the latest stream frame as the PIR snapshot
              handlePirTrigger(remoteIp, data.sensor, wss).catch(err => {
                console.error('[PIR Trigger] Error during PIR trigger handling:', err);
              });
            }

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

            // Broadcast updated historical logs
            const payloadLogs = JSON.stringify({
              type: 'historical_logs',
              logs: getLogs()
            });

            state.broadcastToKiosks(payload);
            state.broadcastToKiosks(payloadLogs);
          } else if (data.type === 'set_ai_enabled' && !isCamera) {
            state.globalAiEnabled = data.enabled;
            console.log(`[AI Status] Global AI state updated to: ${state.globalAiEnabled ? 'ENABLED' : 'DISABLED'}`);
            saveSystemSettings();

            if (!state.globalAiEnabled) {
              aiQueue.length = 0; // Clear queue
              state.devices.forEach((device, dId) => {
                device.latestBoxes = [];
                if (device.aiStopTimer) {
                  clearTimeout(device.aiStopTimer);
                  device.aiStopTimer = null;
                }
                device.isRecordingAi = false;

                while (device.rollingBuffer.length > 30) {
                  device.rollingBuffer.shift();
                }

                const boxPayload = JSON.stringify({
                  type: 'stream_boxes',
                  deviceId: dId,
                  boxes: []
                });
                state.broadcastToKiosks(boxPayload);
              });
            }

            // Broadcast AI state change to ALL kiosks
            const aiStatusPayload = JSON.stringify({ type: 'ai_enabled_updated', enabled: state.globalAiEnabled });
            state.broadcastToKiosks(aiStatusPayload);
          } else if (data.type === 'save_ai_config' && !isCamera) {
            const config = data.config;
            if (config) {
              state.globalPirAiDetection = config.pirAiDetection !== undefined ? config.pirAiDetection : true;
              state.globalPirAiRecording = config.pirAiRecording !== undefined ? config.pirAiRecording : true;
              state.globalStreamAiDetection = config.streamAiDetection !== undefined ? config.streamAiDetection : true;
              let rawStreamAiRecording = config.streamAiRecording !== undefined ? config.streamAiRecording : 'continuous';
              if (rawStreamAiRecording === true) rawStreamAiRecording = 'continuous';
              if (rawStreamAiRecording === false) rawStreamAiRecording = 'off';
              state.globalStreamAiRecording = rawStreamAiRecording;
              state.globalStreamAiTelegram = config.streamAiTelegram !== undefined ? config.streamAiTelegram : true;
              state.globalTelegramInterval = config.telegramInterval !== undefined ? config.telegramInterval : 10;
              state.globalObjectTracking = config.objectTracking !== undefined ? config.objectTracking : true;
              state.globalMaxDuration = config.maxDuration !== undefined ? config.maxDuration : 30;
              saveSystemSettings();

              console.log(`[Settings] AI Config saved: PIR Det=${state.globalPirAiDetection}, PIR Rec=${state.globalPirAiRecording}, Stream Det=${state.globalStreamAiDetection}, Stream Rec=${state.globalStreamAiRecording}, Stream Telegram=${state.globalStreamAiTelegram}, Telegram Interval=${state.globalTelegramInterval}s, Tracking=${state.globalObjectTracking}, MaxDur=${state.globalMaxDuration}s`);

              // Reply to the sender that save was successful
              ws.send(JSON.stringify({ type: 'save_ai_config_success' }));

              // Broadcast updated config to ALL kiosks
              const aiConfigPayload = JSON.stringify({
                type: 'ai_config_response',
                config: {
                  pirAiDetection: state.globalPirAiDetection,
                  pirAiRecording: state.globalPirAiRecording,
                  streamAiDetection: state.globalStreamAiDetection,
                  streamAiRecording: state.globalStreamAiRecording,
                  streamAiTelegram: state.globalStreamAiTelegram,
                  telegramInterval: state.globalTelegramInterval,
                  objectTracking: state.globalObjectTracking,
                  maxDuration: state.globalMaxDuration
                }
              });
              state.broadcastToKiosks(aiConfigPayload);
            }
          } else if (data.type === 'save_system_config' && !isCamera) {
            const config = data.config;
            if (config) {
              // Extract schedules and save to SQLite
              if (config.schedules !== undefined) {
                sqlliteScheduler.saveAllSchedules(config.schedules);
                delete config.schedules; // Remove from JSON config
              }

              state.globalSystemConfig = { ...state.globalSystemConfig, ...config };
              
              // Sync legacy global AI settings
              state.globalPirAiDetection = config.pirAiDetection !== undefined ? config.pirAiDetection : state.globalPirAiDetection;
              state.globalPirAiRecording = config.pirAiRecording !== undefined ? config.pirAiRecording : state.globalPirAiRecording;
              state.globalStreamAiDetection = config.streamAiDetection !== undefined ? config.streamAiDetection : state.globalStreamAiDetection;
              if (config.streamAiRecording !== undefined) {
                let rawStreamAiRecording = config.streamAiRecording;
                if (rawStreamAiRecording === true) rawStreamAiRecording = 'continuous';
                if (rawStreamAiRecording === false) rawStreamAiRecording = 'off';
                state.globalStreamAiRecording = rawStreamAiRecording;
              }
              state.globalStreamAiTelegram = config.streamAiTelegram !== undefined ? config.streamAiTelegram : state.globalStreamAiTelegram;
              state.globalTelegramInterval = config.telegramInterval !== undefined ? config.telegramInterval : state.globalTelegramInterval;
              state.globalObjectTracking = config.objectTracking !== undefined ? config.objectTracking : state.globalObjectTracking;
              state.globalMaxDuration = config.maxDuration !== undefined ? config.maxDuration : state.globalMaxDuration;

              // Handle cameraDetectionEnabled state change
              if (config.cameraDetectionEnabled !== undefined && config.cameraDetectionEnabled !== state.globalAiEnabled) {
                state.globalAiEnabled = config.cameraDetectionEnabled;
                console.log(`[AI Status] Global AI state updated via System Settings to: ${state.globalAiEnabled ? 'ENABLED' : 'DISABLED'}`);

                if (!state.globalAiEnabled) {
                  aiQueue.length = 0; // Clear queue
                  state.devices.forEach((device, dId) => {
                    device.latestBoxes = [];
                    if (device.aiStopTimer) {
                      clearTimeout(device.aiStopTimer);
                      device.aiStopTimer = null;
                    }
                    device.isRecordingAi = false;

                    while (device.rollingBuffer.length > 30) {
                      device.rollingBuffer.shift();
                    }

                    const boxPayload = JSON.stringify({
                      type: 'stream_boxes',
                      deviceId: dId,
                      boxes: []
                    });
                    state.broadcastToKiosks(boxPayload);
                  });
                }

                // Broadcast AI state change to ALL kiosks
                const aiStatusPayload = JSON.stringify({ type: 'ai_enabled_updated', enabled: state.globalAiEnabled });
                state.broadcastToKiosks(aiStatusPayload);
              }

              saveSystemSettings();
              // Re-run scheduler check in case schedules list changed or setting overrides need application
              schedulerManager.checkAndApplySchedule();
              sendAiConfigToPython();
              console.log('[Settings] System settings saved, pushed to Python client, and broadcasted.');

              // Reply success
              ws.send(JSON.stringify({ type: 'save_system_config_success' }));

              // Broadcast updated config to ALL kiosks
              const systemConfigPayload = JSON.stringify({
                type: 'system_config_response',
                config: {
                  ...state.globalSystemConfig,
                  schedules: sqlliteScheduler.getAllSchedules()
                }
              });
              state.broadcastToKiosks(systemConfigPayload);

              // Broadcast updated system config (PIR settings & UDP stream mode) to ALL camera clients
              const systemSettingsForCamera = JSON.stringify({
                type: 'system_settings_update',
                pirEnabled: state.globalSystemConfig.pirEnabled,
                pirCooldown: state.globalSystemConfig.pirCooldown,
                udpStreamEnabled: state.globalSystemConfig.udpStreamEnabled
              });
              state.broadcastToCameras(systemSettingsForCamera);
            }
          } else if (data.type === 'camera_action' && !isCamera) {
            if (data.direction === 'left' || data.direction === 'right') {
              const newActiveId = switchActiveStream(data.direction);
              console.log(`[WS] Action ${data.direction} executed. New active stream: ${newActiveId}`);
            }
          } else if (data.type === 'set_active_stream' && !isCamera) {
            if (state.globalActiveDeviceId !== data.deviceId) {
              state.globalActiveDeviceId = data.deviceId;
              console.log(`Global active stream changed to: ${state.globalActiveDeviceId}`);

              // Broadcast stream change to ALL other kiosks
              const activeStreamPayload = JSON.stringify({ type: 'active_stream_updated', deviceId: state.globalActiveDeviceId });
              state.broadcastToKiosks(activeStreamPayload);
            }
          } else if (data.type === 'servo_control' && !isCamera) {
            const device = state.devices.get(data.deviceId);
            if (device) {
              updateDeviceServoAngle(data.deviceId, Number(data.value));
              device.lastManualControlTime = Date.now();
              if (device.trackingReturnTimer) {
                clearTimeout(device.trackingReturnTimer);
                device.trackingReturnTimer = null;
                console.log(`[Object Follower] Cancelled return-to-center due to manual control for ${data.deviceId}`);
              }
              // Cancel any active auto sweep
              updateDeviceSweepState(data.deviceId, 'off');
              // Restart the sweep interval timer (cooldown) based on its set interval
              resetDeviceSweepTimer(data.deviceId);
              console.log(`[Manual PTZ] Cancelled auto sweep and applied cooldown interval for ${data.deviceId}`);
            }
          } else if (data.type === 'sweep_control' && !isCamera) {
            const device = state.devices.get(data.deviceId);
            if (device) {
              updateDeviceSweepState(data.deviceId, data.value);
              // Reset the auto-sweep interval timer if they manually triggered a single sweep
              if (data.value === 'once') {
                resetDeviceSweepTimer(data.deviceId);
              }
            }
          } else if (data.type === 'get_servo_config' && !isCamera) {
            const config = getDeviceConfig(data.mac);
            ws.send(JSON.stringify({ type: 'servo_config_response', mac: data.mac, config }));
          } else if (data.type === 'save_servo_config' && !isCamera) {
            upsertDeviceConfig(data.mac, data.config);
            console.log(`Servo config saved via WS for MAC: ${data.mac}`);
            ws.send(JSON.stringify({ type: 'save_servo_config_success', mac: data.mac }));

            // Push updated config directly to the specific camera device via WebSocket
            const deviceArray = Array.from(state.devices.values());
            const cameraDevice = deviceArray.find(d => d.mac === data.mac);
            if (cameraDevice) {
              if (data.config && data.config.defaultAngle !== undefined) {
                cameraDevice.currentAngle = Number(data.config.defaultAngle);
              }
              if (cameraDevice.ws && cameraDevice.ws.readyState === 1) {
                cameraDevice.ws.send(JSON.stringify({ type: 'servo_config_update', config: data.config }));
                console.log(`Pushed updated servo config to camera ${data.mac}`);
              }
              // Update auto sweep schedule for the device
              updateDeviceAutoSweep(cameraDevice.id);
            }
          } else if (data.type === 'get_camera_config' && !isCamera) {
            const config = getDeviceConfig(data.mac);
            ws.send(JSON.stringify({ type: 'camera_config_response', mac: data.mac, config }));
          } else if (data.type === 'save_camera_config' && !isCamera) {
            upsertDeviceConfig(data.mac, data.config);
            console.log(`Camera config saved via WS for MAC: ${data.mac}`);
            ws.send(JSON.stringify({ type: 'save_camera_config_success', mac: data.mac }));

            // Push updated config directly to the specific camera device via WebSocket
            const deviceArray = Array.from(state.devices.values());
            const cameraDevice = deviceArray.find(d => d.mac === data.mac);
            if (cameraDevice && cameraDevice.ws && cameraDevice.ws.readyState === 1) {
              const partialConfigToSend = { ...data.config };
              const hasDynamicTriggers = partialConfigToSend.scaleMode !== undefined || Object.keys(partialConfigToSend).some(k => k.startsWith('dynRes') || k.startsWith('dynQual') || k === 'resolution' || k === 'quality');
              
              if (hasDynamicTriggers) {
                 const fullEffective = getEffectiveCameraConfig(getDeviceConfig(data.mac) || {}, cameraDevice);
                 if (fullEffective.resolution) partialConfigToSend.resolution = fullEffective.resolution;
                 if (fullEffective.quality) partialConfigToSend.quality = fullEffective.quality;
              }

              cameraDevice.ws.send(JSON.stringify({ type: 'camera_config_update', config: partialConfigToSend }));
              if (partialConfigToSend.resolution) cameraDevice.currentResolution = partialConfigToSend.resolution;
              if (partialConfigToSend.quality) cameraDevice.currentQuality = partialConfigToSend.quality;
              console.log(`Pushed partial updated camera config to camera ${data.mac}`);
            }
          } else if (data.type === 'delete_event_single' && !isCamera) {
            console.log(`[Storage] Request delete single event: ${data.timestamp}`);
            if (deleteEventSingle(data.timestamp)) {
              ws.send(JSON.stringify({ type: 'historical_logs', logs: getLogs() }));
            }
          } else if (data.type === 'delete_event_batch' && !isCamera) {
            console.log(`[Storage] Request batch delete for date: ${data.date}`);
            if (deleteEventsByDate(data.date)) {
              ws.send(JSON.stringify({ type: 'historical_logs', logs: getLogs() }));
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
        // Use generation-guarded helper — stale close events are safely ignored
        handleCameraOffline(deviceId, 'ws close event', ws._connectionGeneration);
      } else {
        console.log('Kiosk connection closed.');
      }
    });
  });

  // Heartbeat interval check every 5 seconds
  const interval = setInterval(async function ping() {
    const nowMs = Date.now();
    let deviceListChanged = false;
    for (const [deviceId, device] of state.devices.entries()) {
      if (device.type === 'Other' && device.status === 'Online') {
        const timeSinceLastPing = nowMs - (device.lastPingTimeMs || 0);
        if (timeSinceLastPing > 15000) { // 15 seconds timeout
           console.log(`[Heartbeat] Other device ${deviceId} ping timeout. Marking offline.`);
           device.status = 'Offline';
           deviceListChanged = true;
        }
      }
    }
    if (deviceListChanged) broadcastDeviceList();

    const promises = Array.from(wss.clients).map(async (ws) => {
      if (ws.path && ws.path.startsWith('/camera')) {
        const now = Date.now();
        const timeSinceLastData = now - (ws.lastDataReceived || 0);

        // DATA-ACTIVITY IS AUTHORITATIVE:
        // If we received ANY data (frames, signals, heartbeats) within 20s,
        // the connection is definitively alive — skip ping/pong entirely.
        if (timeSinceLastData < 20000) {
          ws.isAlive = true;
          ws.failedPingCount = 0;
        }

        if (ws.isAlive === false) {
          ws.failedPingCount = (ws.failedPingCount || 0) + 1;
          if (ws.failedPingCount >= 3) {
            console.log(`[Heartbeat] Camera ping timeout exceeded (${ws.failedPingCount} missed, last data ${Math.round(timeSinceLastData / 1000)}s ago): ${ws.path}. Closing.`);
            const deviceId = ws._deviceId || `cam_${ws.remoteIp.replace(/\./g, '_')}`;

            // Use generation-guarded helper for clean offline handling
            handleCameraOffline(deviceId, 'heartbeat timeout', ws._connectionGeneration);

            // Graceful close with terminate fallback (give 3s for close handshake)
            try {
              ws.close(1000, 'heartbeat timeout');
              setTimeout(() => {
                if (ws.readyState !== 3) { // 3 = CLOSED
                  ws.terminate();
                }
              }, 3000);
            } catch (e) {
              ws.terminate();
            }
            return;
          }
        } else {
          ws.failedPingCount = 0;
        }

        // Send WS-protocol ping
        ws.isAlive = false;
        if (ws.readyState === 1) {
          ws.ping();

          // Also send app-layer heartbeat_ping for explicit keepalive
          try {
            ws.send(JSON.stringify({ type: 'heartbeat_ping', ts: now }));
          } catch (e) { /* ignore send errors, heartbeat will catch it */ }
        }
      } else {
        // Standard WS heartbeat for Kiosks
        // We only ping every 30s (6 cycles of 5s) to save bandwidth
        if (!ws.pingCounter) ws.pingCounter = 0;
        ws.pingCounter++;

        if (ws.pingCounter >= 6) {
          ws.pingCounter = 0;
          if (ws.isAlive === false) {
            console.log(`Terminating inactive kiosk connection: ${ws.path}`);
            return ws.terminate();
          }
          ws.isAlive = false;
          ws.ping();
        }
      }
    });

    try {
      await Promise.all(promises);
    } catch (e) {
      console.error('[Heartbeat] Concurrent heartbeat execution error:', e);
    }
  }, 5000);

  aiClient.onStatusChange((isConnected) => {
    console.log(`[AI Client] Connection status changed. Connected: ${isConnected}`);
    if (isConnected) {
      sendAiConfigToPython();
    }
    const payload = JSON.stringify({ type: 'ai_status', isConnected });
    state.broadcastToKiosks(payload);
  });

  wss.on('close', function close() {
    clearInterval(interval);
  });

  return wss;
}

function handleDevicePing(deviceId, mac, rssi, ip) {
  const existingDevice = state.devices.get(deviceId);
  const nowMs = Date.now();
  let changed = false;

  const getBars = (r) => {
    if (r >= -60) return 5;
    if (r >= -70) return 4;
    if (r >= -80) return 3;
    if (r >= -90) return 2;
    return 1;
  };
  
  if (existingDevice) {
    if (existingDevice.status !== 'Online' || existingDevice.signalRssi !== rssi) changed = true;
    existingDevice.status = 'Online';
    existingDevice.lastSeen = new Date().toLocaleTimeString();
    existingDevice.lastPingTimeMs = nowMs;
    existingDevice.signalRssi = rssi;
    existingDevice.signalBars = getBars(rssi);
  } else {
    state.devices.set(deviceId, {
      id: deviceId,
      status: 'Online',
      ip: ip,
      mac: mac,
      type: 'Other',
      signalBars: getBars(rssi),
      signalRssi: rssi,
      lastSeen: new Date().toLocaleTimeString(),
      lastPingTimeMs: nowMs
    });
    changed = true;
  }
  
  if (changed) {
    broadcastDeviceList();
  }
}

// Load settings immediately on server start
loadSystemSettings();
schedulerManager.initScheduler();

module.exports = {
  initWebSocket,
  getDevices: () => state.devices,
  sendCaptureRequest,
  switchActiveStream,
  updateFlashIntensity,
  handlePirTrigger,
  handleDevicePing
};
