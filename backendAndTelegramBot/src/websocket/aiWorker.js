const fs = require('fs');
const path = require('path');
const state = require('./state');
const { getDefaultAngle, getReturnDuration } = require('./configManager');
const { updateDeviceServoAngle, serializeFrame } = require('./deviceManager');

const { yoloClient, pixelClient, aiClient } = require('../services/aiClient');
const { logEvent, getLogs, updateLatestLogVideo } = require('../services/logger');
const { sendMotionAlert, sendMotionVideoAlert } = require('../telegram');
const { renderVideo } = require('../services/videoRenderer');
const { calculateNextFollowerAngle } = require('../services/objectFollower');
const { shouldWorkerProcessFrame, shouldEnqueueStreamFrame } = require('../services/aiController');

const aiQueue = [];
let isAiWorkerRunning = false;

function getDeviceHeader(deviceId) {
  const devIdBuf = Buffer.from(deviceId, 'utf8');
  const header = Buffer.alloc(1 + devIdBuf.length);
  header.writeUInt8(devIdBuf.length, 0);
  devIdBuf.copy(header, 1);
  return header;
}

function getActiveAiClient() {
  return yoloClient;
}

function sendAiConfigToPython() {
  if (!yoloClient.isConnected) return;
  const configToSend = {
    cameraDetectionMode: state.globalSystemConfig.cameraDetectionMode,
    pixelMotionSensitivity: state.globalSystemConfig.pixelMotionSensitivity,
    pixelMotionMode: state.globalSystemConfig.pixelMotionMode,
    pixelMotionMerge: state.globalSystemConfig.pixelMotionMerge,
    pixelMotionResetInterval: state.globalSystemConfig.pixelMotionResetInterval,
    pixelMotionClusterDist: state.globalSystemConfig.pixelMotionClusterDist,
    pixelMotionMinSize: state.globalSystemConfig.pixelMotionMinSize
  };
  yoloClient.sendConfig(configToSend);
}

function detectStreamAI(deviceId, imageBuffer) {
  const activeClient = getActiveAiClient();
  if (!activeClient.isConnected) {
    return Promise.resolve(null);
  }
  const extraHeader = getDeviceHeader(deviceId);
  return activeClient.sendRequest(imageBuffer, false, 5000, extraHeader)
    .catch((err) => {
      console.warn('[AI Client] Stream detection failed:', err.message);
      return null;
    });
}

function stopAiRecording(deviceId, reason) {
  const device = state.devices.get(deviceId);
  if (!device || !device.isRecordingAi) return;

  const stopReason = reason || ((state.globalStreamAiRecording === 'continuous' || state.globalStreamAiRecording === true) 
    ? 'no person seen for 3s' 
    : `${state.globalStreamAiRecording}s duration elapsed`);
  console.log(`[AI Record] Selesai mengumpulkan frame (${stopReason}) untuk ${deviceId}. Memulai render...`);
  device.isRecordingAi = false;

  // If stopped due to fixed-duration timer, apply a cooldown so the recording
  // doesn't immediately re-trigger if the person is still in frame.
  const isPixelMode = (state.globalSystemConfig.cameraDetectionMode === 'Pixel');
  const isFixedDuration = (state.globalStreamAiRecording !== 'continuous' && state.globalStreamAiRecording !== true && state.globalStreamAiRecording !== 'off');
  const isRecordingActive = isPixelMode 
    ? (isFixedDuration && state.globalSystemConfig.pixelMotionRecordingEnabled) 
    : isFixedDuration;
  if (isRecordingActive) {
    device.aiRecordCooldownUntil = Date.now() + 3000; // 3-second cooldown before next event
    console.log(`[AI Record] Fixed-duration stop for ${deviceId}. Cooldown active for 3s to prevent immediate re-trigger.`);
  }

  // Clear bounding boxes when recording/hold stops to avoid leftovers
  if (state.wssInstance) {
    const clearPayload = JSON.stringify({
      type: 'stream_boxes',
      deviceId: deviceId,
      boxes: []
    });
    state.broadcastToKiosks(clearPayload);
  }

  if (device.aiStopTimer) {
    clearTimeout(device.aiStopTimer);
    device.aiStopTimer = null;
  }

  if (device.aiDurationTimer) {
    clearTimeout(device.aiDurationTimer);
    device.aiDurationTimer = null;
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
    renderVideo(framesToRender, outputFilename, state.globalMaxDuration)
      .then(videoPath => {
        const isStreamAi = (sensorName === 'AI_Person_Detection');
        const isStreamPixel = (sensorName === 'Pixel_Motion_Detection');
        const shouldNotifyTelegram = !device.telegramAlertsMuted && 
          (isStreamPixel ? state.globalSystemConfig.telegramAlertMotion : (!isStreamAi || state.globalStreamAiTelegram));

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
        if (state.wssInstance) {
          const payloadLogs = JSON.stringify({
            type: 'historical_logs',
            logs: getLogs()
          });
          state.broadcastToKiosks(payloadLogs);
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

  const device = state.devices.get(deviceId);
  if (!device || device.status !== 'Online' || !shouldWorkerProcessFrame(device, { 
    globalAiEnabled: state.globalAiEnabled, 
    globalPirAiRecording: state.globalPirAiRecording, 
    globalObjectTracking: state.globalObjectTracking 
  })) {
    isAiWorkerRunning = false;
    setImmediate(triggerAiWorker);
    return;
  }

  detectStreamAI(deviceId, frameBuffer).then(result => {
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
        if (state.globalObjectTracking) {
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
          if (now - device.lastServoAdjustTime >= 800) {
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
          const isPixelMode = (state.globalSystemConfig.cameraDetectionMode === 'Pixel');
          const isRecordingEnabled = (state.globalStreamAiRecording !== 'off' && state.globalStreamAiRecording !== false);
          const isEnabled = isPixelMode 
            ? (state.globalSystemConfig.telegramAlertMotion || state.globalSystemConfig.pixelMotionCaptureEnabled) 
            : (isRecordingEnabled || state.globalStreamAiTelegram || state.globalSystemConfig.streamAiCaptureEnabled);
          
          const isCoolingDown = device.aiRecordCooldownUntil && Date.now() < device.aiRecordCooldownUntil;
          if (!device.isRecordingAi && isEnabled && !isCoolingDown) {
            console.log(`[AI Record] ${isPixelMode ? 'Motion' : 'Person'} detected on ${deviceId}. Starting stream event...`);
 
            // Evaluate Telegram Cooldown
            const now = Date.now();
            const intervalMs = state.globalTelegramInterval * 1000;
            if (!device.lastTelegramAlertTime || (now - device.lastTelegramAlertTime >= intervalMs)) {
              device.lastTelegramAlertTime = now;
              device.telegramAlertsMuted = false;
            } else {
              console.log(`[Telegram] Live stream alerts throttled (cooldown active) for device ${deviceId}`);
              device.telegramAlertsMuted = true;
            }
 
            device.isRecordingAi = true;
            device.aiSensorName = isPixelMode ? 'Pixel_Motion_Detection' : 'AI_Person_Detection';
            device.lastTimePersonSeen = Date.now();
 
            // Start recording with the triggering scanned frame (if recording is enabled)
            const shouldRecord = isPixelMode 
              ? (isRecordingEnabled && state.globalSystemConfig.pixelMotionRecordingEnabled) 
              : isRecordingEnabled;
            device.rollingBuffer = shouldRecord ? [frameBuffer] : [];

            // Schedule the duration timer if a fixed duration is chosen (not continuous/off)
            if (shouldRecord && state.globalStreamAiRecording !== 'continuous' && state.globalStreamAiRecording !== true) {
              const durationSec = parseInt(state.globalStreamAiRecording, 10);
              if (!isNaN(durationSec) && durationSec > 0) {
                console.log(`[AI Record] Scheduling stop in ${durationSec} seconds for ${deviceId} (fixed duration).`);
                if (device.aiDurationTimer) clearTimeout(device.aiDurationTimer);
                device.aiDurationTimer = setTimeout(() => {
                  console.log(`[AI Record] ${durationSec} seconds elapsed for ${deviceId} (fixed duration). Stopping recording.`);
                  stopAiRecording(deviceId);
                }, durationSec * 1000);
              }
            }
 
             // Asynchronously process the trigger snapshot using the stream frameBuffer (No ESP32-CAM capture requested)
             const shouldCapture = isPixelMode 
               ? state.globalSystemConfig.pixelMotionCaptureEnabled 
               : state.globalSystemConfig.streamAiCaptureEnabled;
             if (shouldCapture) {
               // Broadcast motion_event IMMEDIATELY to trigger Kiosk alarm sound and UI entry placeholder
               const payload = JSON.stringify({
                 type: 'motion_event',
                 sensor: device.aiSensorName,
                 location: device.ip,
                 deviceId: deviceId,
                 timestamp: new Date().toISOString()
               });
 
               state.broadcastToKiosks(payload);
 
               (async () => {
                  // Wait dynamic delay to allow the moving object/person to enter the image frame fully
                  const captureDelay = (state.globalSystemConfig.pixelMotionCaptureDelay !== undefined) 
                    ? state.globalSystemConfig.pixelMotionCaptureDelay 
                    : 100;
                  if (captureDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, captureDelay));
                  }

                  const targetFrame = device.latestFrame || frameBuffer;
                  const timestamp = Date.now();
                  const sensor = device.aiSensorName;
                  const remoteIp = device.ip;
                  const filename = `motion_${remoteIp.replace(/\./g, '_')}_${sensor}_${timestamp}.jpg`;
                  const photosDir = path.join(__dirname, '../../../data/photos');
                  if (!fs.existsSync(photosDir)) {
                    fs.mkdirSync(photosDir, { recursive: true });
                  }
                  const filepath = path.join(photosDir, filename);
                  const imageUrl = `/data/photos/${filename}`;
     
                  let imageToSave = targetFrame;
                  let humanPresence = true;
                  let aiDetails = {
                    status: 'success',
                    message: isPixelMode ? 'Gerakan terdeteksi!' : 'Orang terdeteksi!',
                    person_detected: !isPixelMode,
                    motion_detected: isPixelMode,
                    person_count: !isPixelMode ? (result.jumlah_orang || (boxCoordinates ? boxCoordinates.length : 1)) : 0,
                    motion_count: isPixelMode ? (boxCoordinates ? boxCoordinates.length : 1) : 0,
                    box_coordinates: boxCoordinates
                  };
     
                  // Call Python AI to annotate the target stream frame
                  try {
                    console.log(`[AI Record] Requesting annotated snapshot from stream frame for ${deviceId}...`);
                    let aiResult;
                    const activeClient = getActiveAiClient();
                    const extraHeader = getDeviceHeader(deviceId);
                    aiResult = await activeClient.sendRequest(targetFrame, true, 10000, extraHeader);
                    if (aiResult && aiResult.annotated_image) {
                      imageToSave = Buffer.from(aiResult.annotated_image, 'base64');
                      aiDetails = {
                        status: aiResult.status,
                        message: aiResult.pesan,
                        person_detected: !isPixelMode ? aiResult.ada_orang : false,
                        motion_detected: isPixelMode ? aiResult.ada_orang : false,
                        person_count: !isPixelMode ? aiResult.jumlah_orang : 0,
                        motion_count: isPixelMode ? (aiResult.koordinat_kotak ? aiResult.koordinat_kotak.length : 0) : 0,
                        box_coordinates: aiResult.koordinat_kotak
                      };
                    }
                  } catch (aiErr) {
                    console.error('[AI Record] Failed to get annotated stream frame (using raw frame):', aiErr.message);
                  }
     
                  // Save the finalized image
                  fs.writeFileSync(filepath, imageToSave);
     
                  // Send motion alert to Telegram immediately on detect
                  const shouldTelegramAlert = isPixelMode ? state.globalSystemConfig.telegramAlertMotion : state.globalStreamAiTelegram;
                  if (!device.telegramAlertsMuted && shouldTelegramAlert) {
                    console.log(`[Telegram] Sending stream snapshot alert immediately on detect for ${deviceId}`);
                    sendMotionAlert(`IP: ${remoteIp}`, sensor, filename);
                  } else {
                    console.log(`[Telegram] Stream snapshot alert skipped/muted for ${deviceId} (Muted: ${device.telegramAlertsMuted})`);
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
     
                  state.broadcastToKiosks(updatePayload);
                  state.broadcastToKiosks(payloadLogs);
                })().catch(err => {
                  console.error('[AI Record] Error in background stream frame processing:', err);
                });
             } else {
               console.log(`[AI Record] Image capture disabled for Pixel mode on ${deviceId}. Skipping image save & Telegram alerts.`);
             }
          } else {
            device.lastTimePersonSeen = Date.now();
          }
        }
      } else {
        if (device.isRecordingAi && !device.aiStopTimer) {
          const isPixelMode = (state.globalSystemConfig.cameraDetectionMode === 'Pixel');
          const isRecordingEnabled = (state.globalStreamAiRecording !== 'off' && state.globalStreamAiRecording !== false);
          const isRecordingActive = isPixelMode 
            ? (isRecordingEnabled && state.globalSystemConfig.pixelMotionRecordingEnabled) 
            : isRecordingEnabled;
          if (device.isPirActive || !isRecordingActive || state.globalStreamAiRecording === 'continuous' || state.globalStreamAiRecording === true) {
            console.log(`[AI Record] No ${isPixelMode ? 'motion' : 'person'} detected on ${deviceId}. Scheduling stop in 3 seconds...`);
            device.aiStopTimer = setTimeout(() => {
              console.log(`[AI Record] 3 seconds elapsed with no ${isPixelMode ? 'motion' : 'person'} detected on ${deviceId}. Stopping recording.`);
              stopAiRecording(deviceId);
            }, 3000);
          }
        }

        // Object Follower: if no person detected, schedule return to center after 3 seconds
        if (state.globalObjectTracking) {
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

      state.wssInstance.clients.forEach(client => {
        if (client.readyState === 1 && (!client.path || !client.path.startsWith('/camera'))) {
          if (state.globalViewMode === 'multiple' || deviceId === state.globalActiveDeviceId) {
            client.send(boxPayload);
          }
        }
      });
    }

    setImmediate(triggerAiWorker);
  }).catch(err => {
    isAiWorkerRunning = false;
    setImmediate(triggerAiWorker);
  });
}

function enqueueAiRequest(deviceId, frameBuffer) {
  const existingIndex = aiQueue.findIndex(item => item.deviceId === deviceId);
  if (existingIndex !== -1) {
    aiQueue[existingIndex].frameBuffer = frameBuffer;
  } else {
    aiQueue.push({ deviceId, frameBuffer });
  }

  triggerAiWorker();
}

function handleIncomingCameraFrame(deviceId, remoteIp, message) {
  const device = state.devices.get(deviceId);

  if (device) {
    device.latestFrame = message; // Keep updating to the absolute newest frame

    // Unified rolling buffer for both standard AI and PIR recordings
    // Skip frame accumulation during live stream events if stream recording is disabled
    const isAiSensor = (device.aiSensorName === 'AI_Person_Detection');
    const isPixelSensor = (device.aiSensorName === 'Pixel_Motion_Detection');
    const isRecordingEnabled = (state.globalStreamAiRecording !== 'off' && state.globalStreamAiRecording !== false);
    const shouldRecordFrames = !device.isRecordingAi || 
      (isAiSensor && isRecordingEnabled) || 
      (isPixelSensor && state.globalSystemConfig.pixelMotionRecordingEnabled && isRecordingEnabled);

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

    if (shouldEnqueueStreamFrame(device, { 
      globalAiEnabled: state.globalAiEnabled, 
      globalStreamAiDetection: state.globalStreamAiDetection, 
      globalPirAiRecording: state.globalPirAiRecording, 
      globalObjectTracking: state.globalObjectTracking,
      cameraDetectionMode: state.globalSystemConfig.cameraDetectionMode
    })) {
      enqueueAiRequest(deviceId, message);
    }
  }

  // Broadcast binary camera frames prefixed with the deviceId
  if (state.wssInstance) {
    state.wssInstance.clients.forEach((client) => {
      if (client.readyState === 1 && client.path && !client.path.startsWith('/camera')) {
        if (state.globalViewMode === 'multiple' || deviceId === state.globalActiveDeviceId) {
          const prefixedMessage = serializeFrame(deviceId, message);
          client.send(prefixedMessage, { binary: true });
        }
      }
    });
  }
}

module.exports = {
  aiQueue,
  getDeviceHeader,
  getActiveAiClient,
  sendAiConfigToPython,
  detectStreamAI,
  stopAiRecording,
  triggerAiWorker,
  enqueueAiRequest,
  handleIncomingCameraFrame
};
