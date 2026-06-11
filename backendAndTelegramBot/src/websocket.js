const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const checkDiskSpace = require('check-disk-space').default;

const { aiClient } = require('./services/aiClient');
const { logEvent, getLogs, updateLatestLogVideo, updateLatestLogWithAI, deleteOldestEvent, deleteEventSingle, deleteEventsByDate } = require('./services/logger');
const { sendMotionAlert, sendMotionVideoAlert } = require('./services/telegram');
const { renderVideo } = require('./services/videoRenderer');
const { calculateNextFollowerAngle } = require('./services/objectFollower');
const { shouldEnqueueStreamFrame, shouldWorkerProcessFrame } = require('./services/aiController');

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
let globalPirAiDetection = true;
let globalPirAiRecording = true;
let globalStreamAiDetection = true;
let globalStreamAiRecording = true;
let globalStreamAiTelegram = true;
let globalTelegramInterval = 10;
let globalObjectTracking = true;
let globalMaxDuration = 30;

// --- KODE BARU DITAMBAHKAN DI SINI ---
let isPurging = false;
let cachedStoragePayload = null;

function buildStoragePayload(diskSpace) {
  const total = diskSpace.size;
  const free = diskSpace.free;
  const used = total - free;
  const percentage = Math.round((used / total) * 100);

  return {
    type: 'storage_update',
    totalGb: (total / (1024 ** 3)).toFixed(1),
    usedGb: (used / (1024 ** 3)).toFixed(1),
    percentage
  };
}

function broadcastStoragePayload() {
  if (!wssInstance || !cachedStoragePayload) return;

  const storagePayload = JSON.stringify(cachedStoragePayload);
  wssInstance.clients.forEach(client => {
    if (client.readyState === 1 && !client.path?.startsWith('/camera')) {
      client.send(storagePayload);
    }
  });
}

async function checkStorageAndPurge() {
  try {
    // Pada Linux (Raspberry Pi), root storage biasanya di '/'. (Ubah ke 'C:/' jika pakai Windows)
    const rootPath = process.platform === 'win32' ? 'C:/' : '/';
    const diskSpace = await checkDiskSpace(rootPath);

    cachedStoragePayload = buildStoragePayload(diskSpace);
    const percentage = cachedStoragePayload.percentage;

    // 1. Broadcast Info Storage ke Web Kiosk
    broadcastStoragePayload();

    // 2. Logika Auto-Purge (Bersihkan jika memori sentuh 90%)
    if (percentage >= 90 && !isPurging) {
      console.log(`[Storage] ALARM: Disk usage at ${percentage}%. Starting auto-purge...`);
      isPurging = true;
      let currentPercentage = percentage;

      // Looping hapus data terlama sampai storage turun di bawah 50%
      while (currentPercentage > 50) {
        const deleted = deleteOldestEvent();
        if (!deleted) break; // Berhenti jika array log.json sudah kosong

        // Re-check kapasitas disk setelah menghapus satu event
        const newDiskSpace = await checkDiskSpace(rootPath);
        cachedStoragePayload = buildStoragePayload(newDiskSpace);
        currentPercentage = cachedStoragePayload.percentage;
      }

      console.log(`[Storage] Auto-purge complete. Disk usage dropped to ${currentPercentage}%.`);
      isPurging = false;
      broadcastStoragePayload();

      // Broadcast log terbaru ke Dashboard Kiosk karena datanya banyak yang dihapus
      if (wssInstance) {
        const logsPayload = JSON.stringify({ type: 'historical_logs', logs: getLogs() });
        wssInstance.clients.forEach(client => {
          if (client.readyState === 1 && !client.path?.startsWith('/camera')) {
            client.send(logsPayload);
          }
        });
      }
    }
  } catch (err) {
    console.error('[Storage] Error checking disk space:', err);
  }
}

// Jalankan fungsi check memori setiap 1 Menit
setInterval(checkStorageAndPurge, 60 * 1000);

// Panggil paksa 1 kali saat server baru menyala (agar tidak perlu nunggu 1 menit pertama)
checkStorageAndPurge();

// Centralized sequential AI object detection queue
const aiQueue = [];
let isAiWorkerRunning = false;

function enqueueAiRequest(deviceId, frameBuffer) {
  // Frame-dropping: only keep the most recent frame for each camera in the queue to prevent lag
  const existingIndex = aiQueue.findIndex(item => item.deviceId === deviceId);
  if (existingIndex !== -1) {
    aiQueue[existingIndex].frameBuffer = frameBuffer;
  } else {
    aiQueue.push({ deviceId, frameBuffer });
  }

  triggerAiWorker();
}

function updateDeviceServoAngle(deviceId, angle, skipCameraSend = false) {
  const device = devices.get(deviceId);
  if (!device) return;

  device.currentAngle = angle;
  if (!skipCameraSend && device.ws && device.ws.readyState === 1) {
    device.ws.send(JSON.stringify({ type: 'servo_control', value: angle }));
  }

  const payload = JSON.stringify({
    type: 'servo_angle_update',
    deviceId: deviceId,
    value: angle
  });

  if (wssInstance) {
    wssInstance.clients.forEach((client) => {
      if (client.readyState === 1 && !client.path.startsWith('/camera')) {
        client.send(payload);
      }
    });
  }
}

function stopAiRecording(deviceId) {
  const device = devices.get(deviceId);
  if (!device || !device.isRecordingAi) return;

  console.log(`[AI Record] Selesai mengumpulkan frame (no person seen for 3s) untuk ${deviceId}. Memulai render...`);
  device.isRecordingAi = false;

  if (device.aiStopTimer) {
    clearTimeout(device.aiStopTimer);
    device.aiStopTimer = null;
  }

  // Handle return-to-center and timeout clearance if the PIR sensor triggered this recording
  const wasPirActive = device.isPirActive;
  if (wasPirActive) {
    device.isPirActive = false;
    if (device.pirActiveTimeout) {
      clearTimeout(device.pirActiveTimeout);
      device.pirActiveTimeout = null;
    }
  }

  const remoteIp = device.ip;
  const sensorName = device.aiSensorName || 'AI_Person_Detection';
  const framesToRender = [...device.rollingBuffer];
  const outputFilename = `motion_video_${remoteIp.replace(/\./g, '_')}_${sensorName}_${Date.now()}.mp4`;

  // Clear the rolling buffer back to empty for next pre-roll
  device.rollingBuffer = [];

  if (framesToRender.length > 0) {
    renderVideo(framesToRender, outputFilename, globalMaxDuration)
      .then(videoPath => {
        const isStreamAi = (sensorName === 'AI_Person_Detection');
        const shouldNotifyTelegram = !device.telegramAlertsMuted && (!isStreamAi || globalStreamAiTelegram);

        if (shouldNotifyTelegram) {
          if (device.latestSnapshotFilename) {
            sendMotionAlert(`IP: ${remoteIp}`, sensorName, device.latestSnapshotFilename);
            device.latestSnapshotFilename = null;
          }
          sendMotionVideoAlert(`IP: ${remoteIp}`, sensorName, videoPath);
        } else {
          console.log(`[Telegram] Telegram alert skipped/throttled for device ${deviceId}.`);
          device.latestSnapshotFilename = null;
        }

        // Bind and save video to log.json
        const videoUrl = `/data/videos/${outputFilename}`;
        updateLatestLogVideo(sensorName, remoteIp, videoUrl);

        // Broadcast updated logs to all Kiosks
        if (wssInstance) {
          const payloadLogs = JSON.stringify({
            type: 'historical_logs',
            logs: getLogs()
          });
          wssInstance.clients.forEach((client) => {
            if (client.readyState === 1 && !client.path.startsWith('/camera')) {
              client.send(payloadLogs);
            }
          });
        }

        // Instruct camera to return to default position
        const defaultAngle = getDefaultAngle(device.mac);
        updateDeviceServoAngle(deviceId, defaultAngle);
        console.log(`[AI Record] Sent return-to-center command after video rendering completed.`);
      })
      .catch(err => {
        console.error(`[AI Record] Gagal merender video: ${err.message}`);
        // Fallback return-to-center in case of rendering errors
        const defaultAngle = getDefaultAngle(device.mac);
        updateDeviceServoAngle(deviceId, defaultAngle);
      });
  } else {
    console.log(`[AI Record] Stop AI Event: no frames to render for ${deviceId}. Skipping rendering.`);
    // Instruct camera to return to default position
    const defaultAngle = getDefaultAngle(device.mac);
    updateDeviceServoAngle(deviceId, defaultAngle);
  }
}

function triggerAiWorker() {
  if (isAiWorkerRunning || aiQueue.length === 0) return;

  isAiWorkerRunning = true;
  const { deviceId, frameBuffer } = aiQueue.shift();

  const device = devices.get(deviceId);
  if (!device || device.status !== 'Online' || !shouldWorkerProcessFrame(device, { globalAiEnabled, globalPirAiRecording, globalObjectTracking })) {
    isAiWorkerRunning = false;
    setImmediate(triggerAiWorker);
    return;
  }

  detectStreamAI(frameBuffer).then(result => {
    isAiWorkerRunning = false;

    if (result && result.status === 'success') {
      const boxCoordinates = result.koordinat_kotak;
      const personDetected = result.ada_orang;

      device.latestBoxes = boxCoordinates;

      // Logika Perekaman AI
      if (personDetected) {
        if (device.aiStopTimer) {
          clearTimeout(device.aiStopTimer);
          device.aiStopTimer = null;
          console.log(`[AI Record] Person detected again. Cancelled stop recording timer for ${deviceId}.`);
        }

        // Object Follower: track human if AI is online and tracking is enabled
        if (globalObjectTracking) {
          // Cancel return-to-center timer because person is detected
          if (device.trackingReturnTimer) {
            clearTimeout(device.trackingReturnTimer);
            device.trackingReturnTimer = null;
            console.log(`[Object Follower] Person present. Cancelled return-to-center timer for ${deviceId}.`);
          }
          // Reset manual override cooldown when person is detected in frame
          device.lastManualControlTime = null;

          const now = Date.now();
          if (!device.lastServoAdjustTime) {
            device.lastServoAdjustTime = 0;
          }
          if (now - device.lastServoAdjustTime >= 250) {
            const defaultAngle = getDefaultAngle(device.mac);
            const followResult = calculateNextFollowerAngle(deviceId, device.currentAngle, boxCoordinates, defaultAngle);
            if (followResult) {
              const { newAngle, offset } = followResult;
              updateDeviceServoAngle(deviceId, newAngle);
              device.lastServoAdjustTime = now;
              if (device.ws && device.ws.readyState === 1) {
                // Batalkan return otomatis dari hardware ESP jika ada
                device.ws.send(JSON.stringify({ type: 'cancel_return' }));
              }
              console.log(`[Object Follower] Adjusted servo for ${deviceId} to ${newAngle}° (Offset: ${offset.toFixed(2)})`);
            }
          }
        }

        if (device.isPirActive) {
          // Jika PIR aktif, kita hanya memperbarui hold timer tanpa memulai recording/notifikasi AI baru
          device.lastTimePersonSeen = Date.now();
          console.log(`[AI Hold] Person detected on PIR-active camera ${deviceId}. Extending hold.`);
        } else {
          // Normal AI stream detection event logic
          if (!device.isRecordingAi && (globalStreamAiRecording || globalStreamAiTelegram)) {
            console.log(`[AI Record] Person detected on ${deviceId}. Starting stream event...`);

            // Evaluate Telegram Cooldown
            const now = Date.now();
            const intervalMs = globalTelegramInterval * 1000;
            if (!device.lastTelegramAlertTime || (now - device.lastTelegramAlertTime >= intervalMs)) {
              device.lastTelegramAlertTime = now;
              device.telegramAlertsMuted = false;
            } else {
              console.log(`[Telegram] Live stream alerts throttled (cooldown active) for device ${deviceId}`);
              device.telegramAlertsMuted = true;
            }

            device.isRecordingAi = true;
            device.aiSensorName = 'AI_Person_Detection';
            device.lastTimePersonSeen = Date.now();

            // Start recording with the triggering scanned frame (if recording is enabled)
            device.rollingBuffer = globalStreamAiRecording ? [frameBuffer] : [];

            // Broadcast motion_event IMMEDIATELY to trigger Kiosk alarm sound and UI entry placeholder
            const payload = JSON.stringify({
              type: 'motion_event',
              sensor: device.aiSensorName,
              location: device.ip,
              deviceId: deviceId,
              timestamp: new Date().toISOString()
            });

            if (wssInstance) {
              wssInstance.clients.forEach((client) => {
                if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                  client.send(payload);
                }
              });
            }

            // Asynchronously process the trigger snapshot using the stream frameBuffer (No ESP32-CAM capture requested)
            (async () => {
              const timestamp = Date.now();
              const sensor = device.aiSensorName;
              const remoteIp = device.ip;
              const filename = `motion_${remoteIp.replace(/\./g, '_')}_${sensor}_${timestamp}.jpg`;
              const photosDir = path.join(__dirname, '../../data/photos');
              if (!fs.existsSync(photosDir)) {
                fs.mkdirSync(photosDir, { recursive: true });
              }
              const filepath = path.join(photosDir, filename);
              const imageUrl = `/data/photos/${filename}`;

              let imageToSave = frameBuffer;
              let humanPresence = true;
              let aiDetails = {
                status: 'success',
                message: 'Orang terdeteksi!',
                person_detected: true,
                person_count: result.jumlah_orang || (boxCoordinates ? boxCoordinates.length : 1),
                box_coordinates: boxCoordinates
              };

              // Call Python AI to annotate the triggering stream frame
              try {
                console.log(`[AI Record] Requesting annotated snapshot from stream frame for ${deviceId}...`);
                const aiResult = await aiClient.sendRequest(frameBuffer, true, 10000);
                if (aiResult && aiResult.annotated_image) {
                  imageToSave = Buffer.from(aiResult.annotated_image, 'base64');
                  aiDetails = {
                    status: aiResult.status,
                    message: aiResult.pesan,
                    person_detected: aiResult.ada_orang,
                    person_count: aiResult.jumlah_orang,
                    box_coordinates: aiResult.koordinat_kotak
                  };
                }
              } catch (aiErr) {
                console.error('[AI Record] Failed to get annotated stream frame (using raw frame):', aiErr.message);
              }

              // Save the finalized image (either AI-annotated or raw stream fallback)
              fs.writeFileSync(filepath, imageToSave);

              // Send motion alert to Telegram immediately on detect
              if (!device.telegramAlertsMuted && globalStreamAiTelegram) {
                console.log(`[Telegram] Sending stream AI snapshot alert immediately on detect for ${deviceId}`);
                sendMotionAlert(`IP: ${remoteIp}`, sensor, filename);
              } else {
                console.log(`[Telegram] Stream AI snapshot alert skipped/muted for ${deviceId} (Muted: ${device.telegramAlertsMuted})`);
              }

              // Log event ke data/log.json
              logEvent({
                type: 'motion_event',
                sensor: sensor,
                location: remoteIp,
                deviceId: deviceId,
                imageUrl: imageUrl,
                humanPresence: humanPresence,
                aiDetails: aiDetails,
                timestamp: new Date().toISOString()
              });

              // Notify Web Clients with motion_image_update
              const updatePayload = JSON.stringify({
                type: 'motion_image_update',
                sensor: sensor,
                deviceId: deviceId,
                imageUrl: imageUrl,
                humanPresence: humanPresence,
                aiDetails: aiDetails
              });

              // Broadcast updated historical logs
              const payloadLogs = JSON.stringify({
                type: 'historical_logs',
                logs: getLogs()
              });

              if (wssInstance) {
                wssInstance.clients.forEach((client) => {
                  if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                    client.send(updatePayload);
                    client.send(payloadLogs);
                  }
                });
              }
            })().catch(err => {
              console.error('[AI Record] Error in background stream frame processing:', err);
            });
          } else {
            device.lastTimePersonSeen = Date.now();
          }
        }
      } else {
        if (device.isRecordingAi && !device.aiStopTimer) {
          console.log(`[AI Record] No person detected on ${deviceId}. Scheduling stop in 3 seconds...`);
          device.aiStopTimer = setTimeout(() => {
            console.log(`[AI Record] 3 seconds elapsed with no person detected on ${deviceId}. Stopping recording.`);
            stopAiRecording(deviceId);
          }, 3000);
        }

        // Object Follower: if no person detected, schedule return to center after 3 seconds
        if (globalObjectTracking) {
          const defaultAngle = getDefaultAngle(device.mac);
          const now = Date.now();
          const manualControlAge = device.lastManualControlTime ? (now - device.lastManualControlTime) : Infinity;
          const returnDuration = getReturnDuration(device.mac);

          if (device.currentAngle !== defaultAngle && !device.trackingReturnTimer && manualControlAge > returnDuration) {
            console.log(`[Object Follower] No person detected on ${deviceId}. Scheduling return-to-center in ${returnDuration/1000} seconds...`);
            device.trackingReturnTimer = setTimeout(() => {
               if (!device.isRecordingAi && !device.isPirActive) {
                   const defAngle = getDefaultAngle(device.mac);
                   updateDeviceServoAngle(deviceId, defAngle);
                   console.log(`[Object Follower] Returned servo to default ${defAngle}° for ${deviceId} after ${returnDuration/1000}s of no detection.`);
               }
               device.trackingReturnTimer = null;
            }, returnDuration);
          }
        }
      }

      const boxPayload = JSON.stringify({
        type: 'stream_boxes',
        deviceId: deviceId,
        boxes: boxCoordinates
      });

      if (wssInstance) {
        wssInstance.clients.forEach(client => {
          if (client.readyState === 1 && !client.path.startsWith('/camera')) {
            // Only broadcast bounding boxes in multiple view mode OR if the device is active in single view mode
            if (globalViewMode === 'multiple' || deviceId === globalActiveDeviceId) {
              client.send(boxPayload);
            }
          }
        });
      }
    }

    setImmediate(triggerAiWorker);
  }).catch(err => {
    isAiWorkerRunning = false;

    setImmediate(triggerAiWorker);
  });
}


function serializeFrame(deviceId, frameBuffer) {
  const deviceIdBuffer = Buffer.from(deviceId, 'utf8');
  const header = Buffer.alloc(1 + deviceIdBuffer.length);
  header.writeUInt8(deviceIdBuffer.length, 0);
  deviceIdBuffer.copy(header, 1);
  return Buffer.concat([header, frameBuffer]);
}

function loadSystemSettings() {
  try {
    if (fs.existsSync(SYSTEM_SETTINGS_FILE)) {
      const data = fs.readFileSync(SYSTEM_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      globalAiEnabled = settings.globalAiEnabled !== undefined ? settings.globalAiEnabled : true;
      globalViewMode = settings.globalViewMode || 'single';
      globalPirAiDetection = settings.pirAiDetection !== undefined ? settings.pirAiDetection : true;
      globalPirAiRecording = settings.pirAiRecording !== undefined ? settings.pirAiRecording : true;
      globalStreamAiDetection = settings.streamAiDetection !== undefined ? settings.streamAiDetection : true;
      globalStreamAiRecording = settings.streamAiRecording !== undefined ? settings.streamAiRecording : true;
      globalStreamAiTelegram = settings.streamAiTelegram !== undefined ? settings.streamAiTelegram : true;
      globalTelegramInterval = settings.telegramInterval !== undefined ? settings.telegramInterval : 10;
      globalObjectTracking = settings.objectTracking !== undefined ? settings.objectTracking : true;
      globalMaxDuration = settings.maxDuration !== undefined ? settings.maxDuration : 30;
      console.log(`[Settings] Loaded system settings: ViewMode = ${globalViewMode}, AI = ${globalAiEnabled ? 'ENABLED' : 'DISABLED'}, PIR AI Det = ${globalPirAiDetection}, PIR AI Rec = ${globalPirAiRecording}, Stream AI Det = ${globalStreamAiDetection}, Stream AI Rec = ${globalStreamAiRecording}, Stream Telegram = ${globalStreamAiTelegram}, Telegram Interval = ${globalTelegramInterval}s, Tracking = ${globalObjectTracking}, MaxDur = ${globalMaxDuration}s`);
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
      globalViewMode,
      pirAiDetection: globalPirAiDetection,
      pirAiRecording: globalPirAiRecording,
      streamAiDetection: globalStreamAiDetection,
      streamAiRecording: globalStreamAiRecording,
      streamAiTelegram: globalStreamAiTelegram,
      telegramInterval: globalTelegramInterval,
      objectTracking: globalObjectTracking,
      maxDuration: globalMaxDuration
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

function getEffectiveCameraConfig(config, device) {
  const scaleMode = config.scaleMode || 'static';
  const effectiveConfig = { ...config };

  if (scaleMode === 'dynamic') {
    const bars = device.signalBars || 5;
    const defaultRes = {
      5: 'UXGA',
      4: 'SVGA',
      3: 'VGA',
      2: 'QQVGA',
      1: '96X96'
    };
    const defaultQual = {
      5: 10,
      4: 12,
      3: 15,
      2: 20,
      1: 25
    };

    const dynResKey = `dynRes${bars}`;
    const dynQualKey = `dynQual${bars}`;

    effectiveConfig.resolution = config[dynResKey] || defaultRes[bars] || 'HVGA';
    effectiveConfig.quality = (config[dynQualKey] !== undefined) ? config[dynQualKey] : (defaultQual[bars] || 12);
  }

  return effectiveConfig;
}

function getReturnDuration(mac) {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const allConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE));
      const config = allConfigs[mac];
      if (config && config.returnToDefaultDuration !== undefined) {
        return Number(config.returnToDefaultDuration) * 1000;
      }
    } catch (e) {
      console.error('Error reading return duration config:', e);
    }
  }
  return 15000; // Default fallback
}

function getDefaultAngle(mac) {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const allConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE));
      const config = allConfigs[mac];
      if (config && config.defaultAngle !== undefined) {
        return Number(config.defaultAngle);
      }
    } catch (e) {
      console.error('Error reading default angle config:', e);
    }
  }
  return 90; // Default fallback
}

function getPirAngle(mac, sensor) {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const allConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE));
      const config = allConfigs[mac];
      if (config) {
        if (sensor === 'left' && config.leftPirAngle !== undefined) return Number(config.leftPirAngle);
        if (sensor === 'middle' && config.middlePirAngle !== undefined) return Number(config.middlePirAngle);
        if (sensor === 'right' && config.rightPirAngle !== undefined) return Number(config.rightPirAngle);
        if (config.defaultAngle !== undefined) return Number(config.defaultAngle);
      }
    } catch (e) {
      console.error('Error reading pir angle config:', e);
    }
  }
  if (sensor === 'left') return 155;
  if (sensor === 'middle') return 90;
  if (sensor === 'right') return 0;
  return 90; // Default fallback
}

function getSignalBars(rssi) {
  if (rssi >= -55) return 5;
  if (rssi >= -65) return 4;
  if (rssi >= -75) return 3;
  if (rssi >= -85) return 2;
  if (rssi >= -95) return 1;
  return 0;
}

function heartbeat() {
  this.isAlive = true;
}

function broadcastDeviceList(wss) {
  const deviceList = Array.from(devices.values()).map(device => ({
    id: device.id,
    status: device.status,
    ip: device.ip,
    mac: device.mac,
    signalBars: device.signalBars,
    signalRssi: device.signalRssi || null,
    lastSeen: device.lastSeen,
    currentAngle: device.currentAngle
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
        status: 'Online',
        ip: remoteIp,
        mac: macAddress,
        type: 'Camera',
        signalBars: 5,
        signalRssi: null,
        lastSeen: new Date().toLocaleTimeString(),
        ws: ws,  // simpan referensi untuk on-demand capture
        rollingBuffer: [], // Buffer untuk frame JPEG (Pre-roll)
        motionSensor: '',
        isRecordingAi: false,
        lastTimePersonSeen: 0,
        aiSensorName: '',
        aiStopTimer: null,
        latestSnapshotFilename: null,
        currentResolution: null,
        currentQuality: null,
        currentAngle: getDefaultAngle(macAddress),
        lastServoAdjustTime: 0,
        lastTelegramAlertTime: 0,
        telegramAlertsMuted: false
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
        } catch (e) { console.error('Error sending config to camera:', e); }
      }

      if (fs.existsSync(CAMERA_CONFIG_FILE)) {
        try {
          const allCamConfigs = JSON.parse(fs.readFileSync(CAMERA_CONFIG_FILE));
          const camConfig = allCamConfigs[macAddress];
          if (camConfig) {
            const device = devices.get(deviceId);
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

      // Send latest cached storage info without recalculating disk space for each new Kiosk
      if (cachedStoragePayload) {
        ws.send(JSON.stringify(cachedStoragePayload));
      }

      // Send current AI enabled status immediately
      ws.send(JSON.stringify({ type: 'ai_enabled_updated', enabled: globalAiEnabled }));

      // Send current active stream to the new Kiosk immediately to synchronize
      if (globalActiveDeviceId) {
        ws.send(JSON.stringify({ type: 'active_stream_updated', deviceId: globalActiveDeviceId }));
      }

      // Send current AI configurations immediately to synchronize
      ws.send(JSON.stringify({
        type: 'ai_config_response',
        config: {
          pirAiDetection: globalPirAiDetection,
          pirAiRecording: globalPirAiRecording,
          streamAiDetection: globalStreamAiDetection,
          streamAiRecording: globalStreamAiRecording,
          streamAiTelegram: globalStreamAiTelegram,
          telegramInterval: globalTelegramInterval,
          objectTracking: globalObjectTracking,
          maxDuration: globalMaxDuration
        }
      }));
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

          // Unified rolling buffer for both standard AI and PIR recordings
          // Skip frame accumulation during live stream events if stream recording is disabled
          const isStreamAi = (device.aiSensorName === 'AI_Person_Detection');
          const shouldRecordFrames = !device.isRecordingAi || !isStreamAi || globalStreamAiRecording;

          if (shouldRecordFrames) {
            device.rollingBuffer.push(message);
          }

          if (device.isRecordingAi) {
            // Cap at 900 frames (~90s at 10fps) to prevent RAM exhaust on Raspberry Pi
            if (device.rollingBuffer.length > 900) {
              device.rollingBuffer.shift();
            }
          } else {
            // Normal rolling buffer pre-roll limit (30 frames)
            while (device.rollingBuffer.length > 30) {
              device.rollingBuffer.shift();
            }
          }

          if (shouldEnqueueStreamFrame(device, { globalAiEnabled, globalStreamAiDetection, globalPirAiRecording, globalObjectTracking })) {
            enqueueAiRequest(deviceId, message);
          }
        }

        // Broadcast binary camera frames prefixed with the deviceId
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && !client.path.startsWith('/camera')) {
            if (globalViewMode === 'multiple' || deviceId === globalActiveDeviceId) {
              const prefixedMessage = serializeFrame(deviceId, message);
              client.send(prefixedMessage, { binary: true });
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
              const rssi = (data.rssi !== undefined) ? Number(data.rssi) : null;
              device.signalRssi = rssi;
              if (rssi !== null) {
                device.signalBars = getSignalBars(rssi);
              } else if (data.bars !== undefined) {
                // Backward compatibility if camera firmware is old
                device.signalBars = Number(data.bars);
              }
              device.lastSeen = new Date().toLocaleTimeString();
              broadcastDeviceList(wss);

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
          } else if (data.type === 'motion' && isCamera) {
            const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
            const device = devices.get(deviceId);
            const location = device ? device.ip : remoteIp;

            console.log(`Motion detected by ${location}: ${data.sensor}`);

            if (device) {
              device.isPirActive = true;
              device.lastTimePersonSeen = Date.now(); // Start hold timer from trigger timestamp
              updateDeviceServoAngle(deviceId, getPirAngle(device.mac, data.sensor), true);
              if (device.pirActiveTimeout) {
                clearTimeout(device.pirActiveTimeout);
              }
              // Pre-upload safety timeout of 8 seconds (if upload fails to start)
              device.pirActiveTimeout = setTimeout(() => {
                if (device.isPirActive) {
                  device.isPirActive = false;

                  if (device.isRecordingAi) {
                    stopAiRecording(deviceId);
                  } else {
                    const defaultAngle = getDefaultAngle(device.mac);
                    updateDeviceServoAngle(deviceId, defaultAngle);
                  }
                  console.log(`[AI Hold] Pre-upload safety timeout triggered (8s). Returned servo to center for ${deviceId}.`);
                }
                device.pirActiveTimeout = null;
              }, 8000);
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

            wss.clients.forEach((client) => {
              if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                client.send(payload);
                client.send(payloadLogs);
              }
            });

            // Telegram alert sekarang dikirim dari videoRenderer SETELAH video siap.
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

            if (!globalAiEnabled) {
              aiQueue.length = 0; // Clear queue
              devices.forEach((device, dId) => {
                device.latestBoxes = [];
                if (device.aiStopTimer) {
                  clearTimeout(device.aiStopTimer);
                  device.aiStopTimer = null;
                }
                device.isRecordingAi = false;

                // Pangkas buffer kembali ke 30 frame (pre-roll standard) agar memori RAM segera bersih
                while (device.rollingBuffer.length > 30) {
                  device.rollingBuffer.shift();
                }

                const boxPayload = JSON.stringify({
                  type: 'stream_boxes',
                  deviceId: dId,
                  boxes: []
                });
                wss.clients.forEach((client) => {
                  if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                    client.send(boxPayload);
                  }
                });
              });
            }

            // Broadcast AI state change to ALL kiosks so their toggles sync
            const aiStatusPayload = JSON.stringify({ type: 'ai_enabled_updated', enabled: globalAiEnabled });
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                client.send(aiStatusPayload);
              }
            });
          } else if (data.type === 'save_ai_config' && !isCamera) {
            // Save AI Configuration to file
            const config = data.config;
            if (config) {
              globalPirAiDetection = config.pirAiDetection !== undefined ? config.pirAiDetection : true;
              globalPirAiRecording = config.pirAiRecording !== undefined ? config.pirAiRecording : true;
              globalStreamAiDetection = config.streamAiDetection !== undefined ? config.streamAiDetection : true;
              globalStreamAiRecording = config.streamAiRecording !== undefined ? config.streamAiRecording : true;
              globalStreamAiTelegram = config.streamAiTelegram !== undefined ? config.streamAiTelegram : true;
              globalTelegramInterval = config.telegramInterval !== undefined ? config.telegramInterval : 10;
              globalObjectTracking = config.objectTracking !== undefined ? config.objectTracking : true;
              globalMaxDuration = config.maxDuration !== undefined ? config.maxDuration : 30;
              saveSystemSettings();

              console.log(`[Settings] AI Config saved: PIR Det=${globalPirAiDetection}, PIR Rec=${globalPirAiRecording}, Stream Det=${globalStreamAiDetection}, Stream Rec=${globalStreamAiRecording}, Stream Telegram=${globalStreamAiTelegram}, Telegram Interval=${globalTelegramInterval}s, Tracking=${globalObjectTracking}, MaxDur=${globalMaxDuration}s`);

              // Reply to the sender that save was successful
              ws.send(JSON.stringify({ type: 'save_ai_config_success' }));

              // Broadcast updated config to ALL kiosks
              const aiConfigPayload = JSON.stringify({
                type: 'ai_config_response',
                config: {
                  pirAiDetection: globalPirAiDetection,
                  pirAiRecording: globalPirAiRecording,
                  streamAiDetection: globalStreamAiDetection,
                  streamAiRecording: globalStreamAiRecording,
                  streamAiTelegram: globalStreamAiTelegram,
                  telegramInterval: globalTelegramInterval,
                  objectTracking: globalObjectTracking,
                  maxDuration: globalMaxDuration
                }
              });
              wss.clients.forEach((client) => {
                if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                  client.send(aiConfigPayload);
                }
              });
            }
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
            if (device) {
              updateDeviceServoAngle(data.deviceId, Number(data.value));
              device.lastManualControlTime = Date.now();
              if (device.trackingReturnTimer) {
                clearTimeout(device.trackingReturnTimer);
                device.trackingReturnTimer = null;
                console.log(`[Object Follower] Cancelled return-to-center due to manual control for ${data.deviceId}`);
              }
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
              } catch (e) { }
            }
            allConfigs[data.mac] = { ...data.config, lastUpdated: new Date().toISOString() };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(allConfigs, null, 2));
            console.log(`Servo config saved via WS for MAC: ${data.mac}`);
            ws.send(JSON.stringify({ type: 'save_servo_config_success', mac: data.mac }));

            // Push updated config directly to the specific camera device via WebSocket
            const deviceArray = Array.from(devices.values());
            const cameraDevice = deviceArray.find(d => d.mac === data.mac);
            if (cameraDevice) {
              if (data.config && data.config.defaultAngle !== undefined) {
                cameraDevice.currentAngle = Number(data.config.defaultAngle);
              }
              if (cameraDevice.ws && cameraDevice.ws.readyState === 1) {
                cameraDevice.ws.send(JSON.stringify({ type: 'servo_config_update', config: data.config }));
                console.log(`Pushed updated servo config to camera ${data.mac}`);
              }
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
              } catch (e) { }
            }
            allConfigs[data.mac] = { ...data.config, lastUpdated: new Date().toISOString() };
            fs.writeFileSync(CAMERA_CONFIG_FILE, JSON.stringify(allConfigs, null, 2));
            console.log(`Camera config saved via WS for MAC: ${data.mac}`);
            ws.send(JSON.stringify({ type: 'save_camera_config_success', mac: data.mac }));

            // Push updated config directly to the specific camera device via WebSocket
            const deviceArray = Array.from(devices.values());
            const cameraDevice = deviceArray.find(d => d.mac === data.mac);
            if (cameraDevice && cameraDevice.ws && cameraDevice.ws.readyState === 1) {
              const configToSend = getEffectiveCameraConfig(data.config, cameraDevice);
              cameraDevice.ws.send(JSON.stringify({ type: 'camera_config_update', config: configToSend }));
              cameraDevice.currentResolution = configToSend.resolution;
              cameraDevice.currentQuality = configToSend.quality;
              console.log(`Pushed updated camera config to camera ${data.mac} (Res: ${configToSend.resolution}, Qual: ${configToSend.quality})`);
            }
          }

          // --- KODE BARU DITAMBAHKAN DI SINI ---
          else if (data.type === 'delete_event_single' && !isCamera) {
            console.log(`[Storage] Request delete single event: ${data.timestamp}`);
            if (deleteEventSingle(data.timestamp)) {
              // Kirim balik data log terbaru agar layar web langsung ter-update
              ws.send(JSON.stringify({ type: 'historical_logs', logs: getLogs() }));
            }
          }
          else if (data.type === 'delete_event_batch' && !isCamera) {
            console.log(`[Storage] Request batch delete for date: ${data.date}`);
            if (deleteEventsByDate(data.date)) {
              // Kirim balik data log terbaru agar layar web langsung ter-update
              ws.send(JSON.stringify({ type: 'historical_logs', logs: getLogs() }));
            }
          }
          // --- KODE BARU SELESAI ---

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
function updateFlashIntensity(intensity) {
  let allConfigs = {};
  if (fs.existsSync(CAMERA_CONFIG_FILE)) {
    try {
      const rawData = fs.readFileSync(CAMERA_CONFIG_FILE);
      allConfigs = JSON.parse(rawData);
    } catch (e) { }
  }

  // Ensure currently connected cameras are in allConfigs
  const deviceArray = Array.from(devices.values());
  deviceArray.forEach(cameraDevice => {
    if (cameraDevice.type === 'Camera' && cameraDevice.mac) {
      if (!allConfigs[cameraDevice.mac]) {
        allConfigs[cameraDevice.mac] = {};
      }
    }
  });

  // Update intensity for all known cameras
  Object.keys(allConfigs).forEach(mac => {
    allConfigs[mac] = { ...allConfigs[mac], flashIntensity: intensity, lastUpdated: new Date().toISOString() };
  });

  fs.writeFileSync(CAMERA_CONFIG_FILE, JSON.stringify(allConfigs, null, 2));

  // Push updated config directly to the specific camera device via WebSocket
  deviceArray.forEach(cameraDevice => {
    if (cameraDevice.ws && cameraDevice.ws.readyState === 1 && cameraDevice.type === 'Camera') {
      // Send the updated config for this specific camera
      const deviceConfig = allConfigs[cameraDevice.mac];
      if (deviceConfig) {
        const configToSend = getEffectiveCameraConfig(deviceConfig, cameraDevice);
        cameraDevice.ws.send(JSON.stringify({ type: 'camera_config_update', config: configToSend }));
        cameraDevice.currentResolution = configToSend.resolution;
        cameraDevice.currentQuality = configToSend.quality;
      }
    }
  });
  console.log(`[FlashControl] Pushed updated flash intensity (${intensity}) to all cameras`);
}



/**
 * handlePirUpload
 *
 * Handles all business logic triggered by a PIR high-res image upload from the ESP32-CAM.
 * Called by routes.js after it has already responded 200 to the camera.
 *
 * Responsibilities:
 *  - Start/manage PIR video recording session
 *  - Run AI snapshot analysis (if enabled via aiController)
 *  - Broadcast bounding boxes, motion_image_update, historical_logs to kiosks
 *  - Send Telegram snapshot alert
 *  - Write the finalized image to disk and update log.json
 *
 * @param {string}  ip          - Camera IP address
 * @param {string}  sensor      - PIR sensor name (left/middle/right)
 * @param {Buffer}  imageBuffer - Raw JPEG bytes from the camera
 * @param {object}  wss         - WebSocketServer instance (for broadcasting)
 * @param {string}  filepath    - Absolute path to save the final image
 * @param {string}  filename    - Filename of the image (for Telegram / log)
 * @param {string}  imageUrl    - Relative URL for the image (for log / WS payload)
 */
async function handlePirUpload(ip, sensor, imageBuffer, wss, filepath, filename, imageUrl) {
  const deviceId = `cam_${ip.replace(/\./g, '_')}`;
  const device = devices.get(deviceId);

  if (!device) {
    console.warn(`[PIR Upload] No device found for IP: ${ip}. Skipping.`);
    return;
  }

  // --- 1. Clear the 8-second pre-upload safety timeout ---
  if (device.pirActiveTimeout) {
    clearTimeout(device.pirActiveTimeout);
    device.pirActiveTimeout = null;
  }

  // --- 2. Determine whether AI can drive the recording ---
  const { shouldRunPirSnapshotAI } = require('./services/aiController');
  const isAiOnline = aiClient.isConnected && globalAiEnabled && globalPirAiRecording;
  const aiSettings = {
    globalAiEnabled,
    globalPirAiDetection,
    globalPirAiRecording
  };

  // --- 3. Evaluate Telegram cooldown ---
  const now = Date.now();
  const intervalMs = globalTelegramInterval * 1000;
  if (!device.lastTelegramAlertTime || (now - device.lastTelegramAlertTime >= intervalMs)) {
    device.lastTelegramAlertTime = now;
    device.telegramAlertsMuted = false;
  } else {
    console.log(`[Telegram] PIR alerts throttled (cooldown active) for device ${deviceId}`);
    device.telegramAlertsMuted = true;
  }

  // --- 4. Start recording session (always on PIR event) ---
  device.isRecordingAi = true;
  device.aiSensorName = sensor;
  device.lastTimePersonSeen = Date.now();

  // Trim rollingBuffer to keep only the pre-roll frames of the sweep movement
  while (device.rollingBuffer.length > 30) {
    device.rollingBuffer.shift();
  }

  console.log(`[PIR Video] Start recording video stream for ${deviceId} after high-res photo upload.`);

  // Tell camera to cancel its local return-to-center timer
  if (device.ws && device.ws.readyState === 1) {
    device.ws.send(JSON.stringify({ type: 'cancel_return' }));
    console.log(`[PIR Video] Sent cancel_return command to camera ${deviceId}`);
  }

  // --- 5. Schedule recording stop timeout ---
  if (!isAiOnline) {
    console.log(`[PIR Video] AI is offline/disabled. Scheduling flat 10-second stop & return for ${deviceId}.`);
    device.pirActiveTimeout = setTimeout(() => {
      if (device.isRecordingAi) stopAiRecording(deviceId);
      device.pirActiveTimeout = null;
    }, 10000);
  } else {
    console.log(`[PIR Video] AI is online. Scheduling 90-second safety fallback timeout for ${deviceId}.`);
    device.pirActiveTimeout = setTimeout(() => {
      if (device.isRecordingAi) stopAiRecording(deviceId);
      device.pirActiveTimeout = null;
    }, 90000);
  }

  // --- 6. Run Telegram alert and AI snapshot analysis asynchronously ---
  (async () => {
    // Save raw image immediately for instant Telegram alert and UI display
    fs.writeFileSync(filepath, imageBuffer);

    // Send Telegram alert instantly with the raw photo
    let telegramPromise = Promise.resolve();
    if (!device.telegramAlertsMuted) {
      telegramPromise = sendMotionAlert(`IP: ${ip}`, sensor, filename);
    } else {
      console.log(`[Telegram] PIR snapshot alert throttled for device ${deviceId}`);
    }

    let imageToSave = imageBuffer;
    let humanPresence = false;
    let aiDetails = null;

    if (shouldRunPirSnapshotAI(aiSettings)) {
      try {
        console.log(`[AI Object Detection] Analyzing picture from IP: ${ip}, Sensor: ${sensor}...`);
        const result = await aiClient.sendRequest(imageBuffer, true, 10000);

        if (result) {
          aiDetails = {
            status: result.status,
            message: result.pesan,
            person_detected: result.ada_orang,
            person_count: result.jumlah_orang,
            box_coordinates: result.koordinat_kotak
          };
          humanPresence = result.ada_orang === true;

          if (result.annotated_image) {
            imageToSave = Buffer.from(result.annotated_image, 'base64');
            // Overwrite the raw image with the annotated version
            fs.writeFileSync(filepath, imageToSave);
          }

          console.log(`[AI Object Detection] Result: ${result.pesan} (Human count: ${result.jumlah_orang})`);

          // Broadcast bounding boxes to frontend immediately
          if (result.koordinat_kotak && Array.isArray(result.koordinat_kotak)) {
            const boxPayload = JSON.stringify({
              type: 'stream_boxes',
              deviceId: deviceId,
              boxes: result.koordinat_kotak
            });
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                client.send(boxPayload);
              }
            });
          }
        }
      } catch (aiErr) {
        console.error('[AI Object Detection] Failed to call AI (falling back to raw image):', aiErr.message);
      }
    } else {
      console.log(`[AI Object Detection] PIR AI is disabled. Skipping AI analysis for IP: ${ip}.`);
    }

    // Update log.json
    await updateLatestLogWithAI(sensor, ip, imageUrl, humanPresence, aiDetails);

    // Notify kiosk clients
    const motionPayload = JSON.stringify({
      type: 'motion_image_update',
      sensor: sensor,
      deviceId: deviceId,
      imageUrl: imageUrl,
      humanPresence: humanPresence,
      aiDetails: aiDetails
    });

    const payloadLogs = JSON.stringify({
      type: 'historical_logs',
      logs: getLogs()
    });

    wss.clients.forEach((client) => {
      if (client.readyState === 1 && !client.path.startsWith('/camera')) {
        client.send(motionPayload);
        client.send(payloadLogs);
      }
    });

    // Await Telegram notification completion
    await telegramPromise;
  })().catch(err => {
    console.error('[PIR Upload] Asynchronous processing error:', err);
  });
}

module.exports = {
  initWebSocket,
  getDevices,
  sendCaptureRequest,
  switchActiveStream,
  updateFlashIntensity,
  handlePirUpload
};
