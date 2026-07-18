const fs = require('fs');
const state = require('./state');
const { getDeviceConfig } = require('../services/sqllite_config');
const { updateDeviceSweepState, broadcastDeviceList } = require('./deviceManager');

const deviceSweepIntervals = new Map();

function updateDeviceAutoSweep(deviceId) {
  // Clear any existing sweep interval/timer for this device
  if (deviceSweepIntervals.has(deviceId)) {
    clearTimeout(deviceSweepIntervals.get(deviceId).timer);
    deviceSweepIntervals.delete(deviceId);
  }

  const device = state.devices.get(deviceId);
  if (!device || !device.mac || device.status === 'Offline') return;

  // Read sweepMode from config file
  let sweepMode = 'disabled';
  const config = getDeviceConfig(device.mac);
  if (config && config.sweepMode) {
    sweepMode = config.sweepMode;
  }

  console.log(`[Auto Sweep] Updating sweep state for ${deviceId} (MAC: ${device.mac}). Mode: ${sweepMode}`);

  if (sweepMode === 'continuous') {
    // Continuous sweep is handled directly on ESP32CAM firmware
    updateDeviceSweepState(deviceId, 'continuous');
    if (device) {
      device.nextSweepTime = null;
      broadcastDeviceList();
    }
  } else if (['15s', '30s', '1m', '2m', '3m', '4m', '5m'].includes(sweepMode)) {
    // If continuous sweep was previously running, stop it first
    updateDeviceSweepState(deviceId, 'off');

    let intervalMs = 15000;
    if (sweepMode === '30s') intervalMs = 30000;
    else if (sweepMode === '1m') intervalMs = 60000;
    else if (sweepMode === '2m') intervalMs = 120000;
    else if (sweepMode === '3m') intervalMs = 180000;
    else if (sweepMode === '4m') intervalMs = 240000;
    else if (sweepMode === '5m') intervalMs = 300000;

    scheduleNextSweep(deviceId, intervalMs, sweepMode);
  } else {
    // Disabled / off
    updateDeviceSweepState(deviceId, 'off');
    if (device) {
      device.nextSweepTime = null;
      broadcastDeviceList();
    }
  }
}

function scheduleNextSweep(deviceId, intervalMs, sweepMode) {
  if (deviceSweepIntervals.has(deviceId)) {
    clearTimeout(deviceSweepIntervals.get(deviceId).timer);
  }

  const nextSweepTime = Date.now() + intervalMs;
  const dev = state.devices.get(deviceId);
  if (dev) {
    dev.nextSweepTime = nextSweepTime;
    broadcastDeviceList();
  }

  const timer = setTimeout(() => {
    const dev = state.devices.get(deviceId);
    if (dev && dev.status === 'Online' && dev.ws && dev.ws.readyState === 1) {
      if (dev.sweepActive !== 'off') {
         console.log(`[Auto Sweep] Skipped - device ${deviceId} is currently already sweeping`);
         scheduleNextSweep(deviceId, intervalMs, sweepMode);
         return;
      }
      // For Smart Sweep, ensure the device is truly idle before triggering
      if (['2m', '3m', '4m', '5m'].includes(sweepMode)) {
        if (dev.isRecordingAi || dev.isPirActive || dev.trackingReturnTimer) {
           console.log(`[Auto Sweep] Skipped ${sweepMode} smart sweep for ${deviceId} (Device is currently busy/tracking)`);
           scheduleNextSweep(deviceId, intervalMs, sweepMode);
           return;
        }
      }
      console.log(`[Auto Sweep] Triggering automatic periodic single sweep for ${deviceId}`);
      
      // Suspend/Deactivate the auto-sweep timer while the sweep cycle runs.
      if (deviceSweepIntervals.has(deviceId)) {
        deviceSweepIntervals.get(deviceId).timer = null;
      }
      if (dev) {
        dev.nextSweepTime = null;
        broadcastDeviceList();
      }

      updateDeviceSweepState(deviceId, 'once');
    }
  }, intervalMs);

  deviceSweepIntervals.set(deviceId, {
    timer,
    intervalMs,
    sweepMode
  });
}

function resetIdleTimer(deviceId) {
  const activeTimer = deviceSweepIntervals.get(deviceId);
  if (!activeTimer) return;

  // Re-establish timer starting from now
  scheduleNextSweep(deviceId, activeTimer.intervalMs, activeTimer.sweepMode);
  
  if (activeTimer.sweepMode === '5m') {
     // console.log(`[Auto Sweep] Reset 5-minute idle watchdog timer for device: ${deviceId}`);
  }
}

function resetDeviceSweepTimer(deviceId) {
  resetIdleTimer(deviceId);
}

function suspendDeviceSweepTimer(deviceId) {
  const activeTimer = deviceSweepIntervals.get(deviceId);
  if (activeTimer && activeTimer.timer) {
    clearTimeout(activeTimer.timer);
    activeTimer.timer = null;
    console.log(`[Auto Sweep] Suspended auto sweep timer countdown for ${deviceId} (sweep active)`);
  }
  const dev = state.devices.get(deviceId);
  if (dev) {
    dev.nextSweepTime = null;
    broadcastDeviceList();
  }
}

function clearDeviceSweep(deviceId) {
  if (deviceSweepIntervals.has(deviceId)) {
    clearTimeout(deviceSweepIntervals.get(deviceId).timer);
    deviceSweepIntervals.delete(deviceId);
    console.log(`[Auto Sweep] Cleared sweep timeouts for ${deviceId}`);
  }
  const dev = state.devices.get(deviceId);
  if (dev) {
    dev.nextSweepTime = null;
    broadcastDeviceList();
  }
}

module.exports = {
  updateDeviceAutoSweep,
  resetDeviceSweepTimer,
  resetIdleTimer,
  suspendDeviceSweepTimer,
  clearDeviceSweep
};
