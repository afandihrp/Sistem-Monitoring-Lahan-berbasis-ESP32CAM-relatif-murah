const fs = require('fs');
const path = require('path');
const state = require('./state');
const { getDeviceConfig } = require('../services/sqllite_config');

const SYSTEM_SETTINGS_FILE = path.join(__dirname, '../../../data/systemSettings.json');

function loadSystemSettings() {
  try {
    if (fs.existsSync(SYSTEM_SETTINGS_FILE)) {
      const data = fs.readFileSync(SYSTEM_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      
      state.globalSystemConfig = { ...state.globalSystemConfig, ...settings };

      state.globalAiEnabled = state.globalSystemConfig.cameraDetectionEnabled !== undefined ? state.globalSystemConfig.cameraDetectionEnabled : true;
      state.globalPirAiDetection = state.globalSystemConfig.pirAiDetection !== undefined ? state.globalSystemConfig.pirAiDetection : true;
      state.globalPirAiRecording = state.globalSystemConfig.pirAiRecording !== undefined ? state.globalSystemConfig.pirAiRecording : true;
      state.globalStreamAiDetection = state.globalSystemConfig.streamAiDetection !== undefined ? state.globalSystemConfig.streamAiDetection : true;
      let rawStreamAiRecording = state.globalSystemConfig.streamAiRecording !== undefined ? state.globalSystemConfig.streamAiRecording : 'continuous';
      if (rawStreamAiRecording === true) rawStreamAiRecording = 'continuous';
      if (rawStreamAiRecording === false) rawStreamAiRecording = 'off';
      state.globalStreamAiRecording = rawStreamAiRecording;
      state.globalStreamAiTelegram = state.globalSystemConfig.streamAiTelegram !== undefined ? state.globalSystemConfig.streamAiTelegram : true;
      state.globalTelegramInterval = state.globalSystemConfig.telegramInterval !== undefined ? state.globalSystemConfig.telegramInterval : 10;
      state.globalObjectTracking = state.globalSystemConfig.objectTracking !== undefined ? state.globalSystemConfig.objectTracking : true;
      state.globalMaxDuration = state.globalSystemConfig.maxDuration !== undefined ? state.globalSystemConfig.maxDuration : 30;

      console.log(`[Settings] Loaded flat system settings successfully.`);
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

    // Sync active in-memory state variables to flat globalSystemConfig object before saving
    state.globalSystemConfig.cameraDetectionEnabled = state.globalAiEnabled;
    state.globalSystemConfig.pirAiDetection = state.globalPirAiDetection;
    state.globalSystemConfig.pirAiRecording = state.globalPirAiRecording;
    state.globalSystemConfig.streamAiDetection = state.globalStreamAiDetection;
    state.globalSystemConfig.streamAiRecording = state.globalStreamAiRecording;
    state.globalSystemConfig.streamAiTelegram = state.globalStreamAiTelegram;
    state.globalSystemConfig.telegramInterval = state.globalTelegramInterval;
    state.globalSystemConfig.objectTracking = state.globalObjectTracking;
    state.globalSystemConfig.maxDuration = state.globalMaxDuration;

    // Save as clean flat JSON file (starts fresh, no duplicates or nesting)
    fs.writeFileSync(SYSTEM_SETTINGS_FILE, JSON.stringify(state.globalSystemConfig, null, 2), 'utf8');
    console.log('[Settings] Saved flat system settings successfully.');
  } catch (err) {
    console.error('[Settings] Failed to save system settings:', err.message);
  }
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
  const config = getDeviceConfig(mac);
  if (config && config.servoMode === 'return' && config.servoTimer && config.servoTimer !== 'disabled') {
    let intervalMs = 15000;
    if (config.servoTimer === '15s') intervalMs = 15000;
    else if (config.servoTimer === '30s') intervalMs = 30000;
    else if (config.servoTimer === '1m') intervalMs = 60000;
    else if (config.servoTimer === '2m') intervalMs = 120000;
    else if (config.servoTimer === '3m') intervalMs = 180000;
    else if (config.servoTimer === '4m') intervalMs = 240000;
    else if (config.servoTimer === '5m') intervalMs = 300000;
    return intervalMs;
  }
  return 0; // Disabled or not in return mode
}

function getDefaultAngle(mac) {
  const config = getDeviceConfig(mac);
  if (config && config.defaultAngle !== undefined && config.defaultAngle !== null) {
    return Number(config.defaultAngle);
  }
  return 90; // Default fallback
}

function getPirAngle(mac, sensor) {
  const config = getDeviceConfig(mac);
  if (config) {
    if (sensor === 'left' && config.leftPirAngle !== undefined && config.leftPirAngle !== null) return Number(config.leftPirAngle);
    if (sensor === 'middle' && config.middlePirAngle !== undefined && config.middlePirAngle !== null) return Number(config.middlePirAngle);
    if (sensor === 'right' && config.rightPirAngle !== undefined && config.rightPirAngle !== null) return Number(config.rightPirAngle);
    if (config.defaultAngle !== undefined && config.defaultAngle !== null) return Number(config.defaultAngle);
  }
  if (sensor === 'left') return 45;
  if (sensor === 'middle') return 90;
  if (sensor === 'right') return 155;
  return 90; // Default fallback
}

module.exports = {
  SYSTEM_SETTINGS_FILE,
  loadSystemSettings,
  saveSystemSettings,
  getEffectiveCameraConfig,
  getReturnDuration,
  getDefaultAngle,
  getPirAngle
};
