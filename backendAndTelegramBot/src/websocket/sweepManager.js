const fs = require('fs');
const state = require('./state');
const { CONFIG_FILE } = require('./configManager');
const { updateDeviceSweepState } = require('./deviceManager');

const deviceSweepIntervals = new Map();

function updateDeviceAutoSweep(deviceId) {
  // Clear any existing sweep interval/timer for this device
  if (deviceSweepIntervals.has(deviceId)) {
    clearInterval(deviceSweepIntervals.get(deviceId).timer);
    deviceSweepIntervals.delete(deviceId);
  }

  const device = state.devices.get(deviceId);
  if (!device || !device.mac || device.status === 'Offline') return;

  // Read sweepMode from config file
  let sweepMode = 'disabled';
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const allConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE));
      const config = allConfigs[device.mac];
      if (config && config.sweepMode) {
        sweepMode = config.sweepMode;
      }
    } catch (e) {
      console.error('Error reading auto sweep config:', e);
    }
  }

  console.log(`[Auto Sweep] Updating sweep state for ${deviceId} (MAC: ${device.mac}). Mode: ${sweepMode}`);

  if (sweepMode === 'continuous') {
    // Continuous sweep is handled directly on ESP32CAM firmware
    updateDeviceSweepState(deviceId, 'continuous');
  } else if (sweepMode === '15s' || sweepMode === '30s' || sweepMode === '1m') {
    // If continuous sweep was previously running, stop it first
    updateDeviceSweepState(deviceId, 'off');

    let intervalMs = 15000;
    if (sweepMode === '30s') intervalMs = 30000;
    else if (sweepMode === '1m') intervalMs = 60000;

    const timer = setInterval(() => {
      const dev = state.devices.get(deviceId);
      if (dev && dev.status === 'Online' && dev.ws && dev.ws.readyState === 1) {
        console.log(`[Auto Sweep] Triggering automatic periodic single sweep for ${deviceId}`);
        updateDeviceSweepState(deviceId, 'once');
      }
    }, intervalMs);

    deviceSweepIntervals.set(deviceId, {
      timer,
      intervalMs,
      sweepMode
    });
  } else {
    // Disabled / off
    updateDeviceSweepState(deviceId, 'off');
  }
}

function resetDeviceSweepTimer(deviceId) {
  const activeTimer = deviceSweepIntervals.get(deviceId);
  if (!activeTimer) return;

  // Clear old timer
  clearInterval(activeTimer.timer);

  // Re-establish timer starting from now
  const timer = setInterval(() => {
    const dev = state.devices.get(deviceId);
    if (dev && dev.status === 'Online' && dev.ws && dev.ws.readyState === 1) {
      console.log(`[Auto Sweep] Triggering automatic periodic single sweep for ${deviceId} (after manual reset)`);
      updateDeviceSweepState(deviceId, 'once');
    }
  }, activeTimer.intervalMs);

  deviceSweepIntervals.set(deviceId, {
    timer,
    intervalMs: activeTimer.intervalMs,
    sweepMode: activeTimer.sweepMode
  });
  console.log(`[Auto Sweep] Reset interval timer for device: ${deviceId} due to manual trigger`);
}

function clearDeviceSweep(deviceId) {
  if (deviceSweepIntervals.has(deviceId)) {
    clearInterval(deviceSweepIntervals.get(deviceId).timer);
    deviceSweepIntervals.delete(deviceId);
    console.log(`[Auto Sweep] Cleared sweep intervals for ${deviceId}`);
  }
}

module.exports = {
  updateDeviceAutoSweep,
  resetDeviceSweepTimer,
  clearDeviceSweep
};
