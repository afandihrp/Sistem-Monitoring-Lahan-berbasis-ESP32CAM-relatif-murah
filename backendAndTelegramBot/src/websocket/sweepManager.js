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

  // Read servoMode and servoTimer from config file
  let servoMode = 'sweep';
  let servoTimer = 'disabled';
  const config = getDeviceConfig(device.mac);
  if (config) {
    if (config.servoMode) servoMode = config.servoMode;
    if (config.servoTimer) servoTimer = config.servoTimer;
  }

  console.log(`[Auto Sweep] Updating sweep state for ${deviceId} (MAC: ${device.mac}). Mode: ${servoMode}, Timer: ${servoTimer}`);

  if (servoMode === 'sweep' && ['15s', '30s', '1m', '2m', '3m', '4m', '5m'].includes(servoTimer)) {
    updateDeviceSweepState(deviceId, 'off');

    let intervalMs = 15000;
    if (servoTimer === '30s') intervalMs = 30000;
    else if (servoTimer === '1m') intervalMs = 60000;
    else if (servoTimer === '2m') intervalMs = 120000;
    else if (servoTimer === '3m') intervalMs = 180000;
    else if (servoTimer === '4m') intervalMs = 240000;
    else if (servoTimer === '5m') intervalMs = 300000;

    scheduleNextSweep(deviceId, intervalMs, servoTimer);
  } else {
    // Disabled / off
    updateDeviceSweepState(deviceId, 'off');
    if (device) {
      device.nextTimerTime = null;
      broadcastDeviceList();
    }
  }
}

function scheduleNextSweep(deviceId, intervalMs, servoTimer) {
  if (deviceSweepIntervals.has(deviceId)) {
    clearTimeout(deviceSweepIntervals.get(deviceId).timer);
  }

  const nextTimerTime = Date.now() + intervalMs;
  const dev = state.devices.get(deviceId);
  if (dev) {
    dev.nextTimerTime = nextTimerTime;
    broadcastDeviceList();
  }

  const timer = setTimeout(() => {
    const dev = state.devices.get(deviceId);
    if (dev && dev.status === 'Online' && dev.ws && dev.ws.readyState === 1) {
      if (dev.sweepActive !== 'off') {
         console.log(`[Auto Sweep] Skipped - device ${deviceId} is currently already sweeping`);
         scheduleNextSweep(deviceId, intervalMs, servoTimer);
         return;
      }
      // For Smart Sweep, ensure the device is truly idle before triggering
      if (['2m', '3m', '4m', '5m'].includes(servoTimer)) {
        if (dev.isRecordingAi || dev.isPirActive || dev.trackingReturnTimer) {
           console.log(`[Auto Sweep] Skipped ${servoTimer} smart sweep for ${deviceId} (Device is currently busy/tracking)`);
           scheduleNextSweep(deviceId, intervalMs, servoTimer);
           return;
        }
      }
      console.log(`[Auto Sweep] Triggering automatic periodic single sweep for ${deviceId}`);
      
      // Suspend/Deactivate the auto-sweep timer while the sweep cycle runs.
      if (deviceSweepIntervals.has(deviceId)) {
        deviceSweepIntervals.get(deviceId).timer = null;
      }
      if (dev) {
        dev.nextTimerTime = null;
        broadcastDeviceList();
      }

      updateDeviceSweepState(deviceId, 'once');
    }
  }, intervalMs);

  deviceSweepIntervals.set(deviceId, {
    timer,
    intervalMs,
    servoTimer
  });
}

function resetIdleTimer(deviceId) {
  const activeTimer = deviceSweepIntervals.get(deviceId);
  if (!activeTimer) return;

  // Re-establish timer starting from now
  scheduleNextSweep(deviceId, activeTimer.intervalMs, activeTimer.servoTimer);
  
  if (activeTimer.servoTimer === '5m') {
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
    dev.nextTimerTime = null;
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
    dev.nextTimerTime = null;
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
