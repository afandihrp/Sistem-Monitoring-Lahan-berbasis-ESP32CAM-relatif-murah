const state = require('./state');
const configManager = require('./configManager');
const { sendAiConfigToPython } = require('./aiWorker');
const sqlliteScheduler = require('../services/sqllite_scheduler');

let checkInterval = null;
let lastExecutedMinute = -1;

/**
 * Initializes the settings scheduler.
 */
function initScheduler() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  // Run the scheduler check immediately, then every 10 seconds
  checkAndApplySchedule();
  checkInterval = setInterval(() => {
    checkAndApplySchedule();
  }, 10000);

  console.log('[Scheduler] System settings scheduler (Event-based) initialized.');
}

/**
 * Checks the defined schedules and applies the configuration overrides if the exact execution time matches.
 */
function checkAndApplySchedule() {
  const config = state.globalSystemConfig;
  if (!config) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Prevent multiple executions in the same minute
  if (currentMinutes === lastExecutedMinute) {
    return;
  }

  // Fetch schedules from SQLite database
  const schedules = sqlliteScheduler.getAllSchedules();
  if (!schedules || schedules.length === 0) {
    return;
  }

  let scheduleExecuted = false;

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    if (!schedule.executeTime) continue;

    const [execH, execM] = schedule.executeTime.split(':').map(Number);
    if (isNaN(execH) || isNaN(execM)) continue;

    const execMin = execH * 60 + execM;

    if (currentMinutes === execMin) {
      console.log(`[Scheduler] TRIGGER EVENT: Executing schedule "${schedule.name || 'Unnamed'}" (${schedule.id}) at ${schedule.executeTime}`);
      applyScheduleConfig(schedule);
      scheduleExecuted = true;
    }
  }

  if (scheduleExecuted) {
    lastExecutedMinute = currentMinutes;
  }
}

/**
 * Applies the settings overrides defined in the active schedule.
 * Modifies the live system config permanently.
 * @param {Object} schedule
 */
function applyScheduleConfig(schedule) {
  const overrides = schedule.settings;
  const config = state.globalSystemConfig;

  // Apply overrides directly to live config
  if (overrides.pirEnabled !== undefined) config.pirEnabled = overrides.pirEnabled;
  if (overrides.pirCooldown !== undefined) config.pirCooldown = overrides.pirCooldown;
  if (overrides.pirRecordVideo !== undefined) config.pirRecordVideo = overrides.pirRecordVideo;
  if (overrides.pirRecordDuration !== undefined) config.pirRecordDuration = overrides.pirRecordDuration;
  if (overrides.telegramAlertPir !== undefined) config.telegramAlertPir = overrides.telegramAlertPir;
  if (overrides.telegramAlertAi !== undefined) config.telegramAlertAi = overrides.telegramAlertAi;
  if (overrides.telegramAlertMotion !== undefined) config.telegramAlertMotion = overrides.telegramAlertMotion;
  if (overrides.cameraDetectionMode !== undefined) config.cameraDetectionMode = overrides.cameraDetectionMode;
  if (overrides.streamAiDetection !== undefined) config.streamAiDetection = overrides.streamAiDetection;
  if (overrides.objectTracking !== undefined) config.objectTracking = overrides.objectTracking;
  if (overrides.streamAiRecording !== undefined) {
    let raw = overrides.streamAiRecording;
    if (raw === true) raw = 'continuous';
    if (raw === false) raw = 'off';
    config.streamAiRecording = raw;
  }
  if (overrides.streamAiCaptureEnabled !== undefined) config.streamAiCaptureEnabled = overrides.streamAiCaptureEnabled;
  if (overrides.streamAiTelegram !== undefined) config.streamAiTelegram = overrides.streamAiTelegram;
  if (overrides.udpStreamEnabled !== undefined) config.udpStreamEnabled = overrides.udpStreamEnabled;

  if (overrides.cameraDetectionEnabled !== undefined && overrides.cameraDetectionEnabled !== state.globalAiEnabled) {
    state.globalAiEnabled = overrides.cameraDetectionEnabled;
    // Broadcast AI state change to all kiosks
    state.broadcastToKiosks(JSON.stringify({ type: 'ai_enabled_updated', enabled: state.globalAiEnabled }));
  }

  // Sync legacy state properties
  state.globalPirAiDetection = config.pirAiDetection;
  state.globalPirAiRecording = config.pirAiRecording;
  state.globalStreamAiDetection = config.streamAiDetection;
  state.globalStreamAiRecording = config.streamAiRecording;
  state.globalStreamAiTelegram = config.streamAiTelegram;
  state.globalObjectTracking = config.objectTracking;

  // Persist current settings 
  configManager.saveSystemSettings();

  // Send AI config updates to Python YOLO worker
  sendAiConfigToPython();

  // Broadcast updated configuration to all Kiosks
  state.broadcastToKiosks(JSON.stringify({
    type: 'system_config_response',
    config: state.globalSystemConfig
  }));

  // Broadcast updated PIR & UDP settings to camera clients
  state.broadcastToCameras(JSON.stringify({
    type: 'system_settings_update',
    pirEnabled: config.pirEnabled,
    pirCooldown: config.pirCooldown,
    udpStreamEnabled: config.udpStreamEnabled
  }));

  console.log(`[Scheduler] Schedule overrides successfully executed and saved.`);
}

module.exports = {
  initScheduler,
  checkAndApplySchedule
};
