const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../../data/camera_data.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS device_configs (
    mac TEXT PRIMARY KEY,
    name TEXT,
    
    -- Camera Config
    resolution TEXT,
    quality INTEGER,
    scaleMode TEXT,
    dynRes5 TEXT, dynQual5 INTEGER,
    dynRes4 TEXT, dynQual4 INTEGER,
    dynRes3 TEXT, dynQual3 INTEGER,
    dynRes2 TEXT, dynQual2 INTEGER,
    dynRes1 TEXT, dynQual1 INTEGER,
    brightness INTEGER,
    contrast INTEGER,
    saturation INTEGER,
    awb INTEGER,
    aec INTEGER,
    agc INTEGER,
    hmirror INTEGER,
    vflip INTEGER,
    specialEffect TEXT,
    xclk INTEGER,
    flashOnCapture INTEGER,
    flashIntensity INTEGER,
    
    -- Servo Config
    defaultAngle INTEGER,
    leftPirAngle INTEGER,
    middlePirAngle INTEGER,
    rightPirAngle INTEGER,
    servoMode TEXT,
    servoTimer TEXT
  )
`);

const defaultDeviceConfig = {
  name: 'New Camera',
  resolution: 'HVGA',
  quality: 12,
  scaleMode: 'static',
  dynRes5: 'UXGA', dynQual5: 10,
  dynRes4: 'SVGA', dynQual4: 12,
  dynRes3: 'VGA', dynQual3: 15,
  dynRes2: 'QQVGA', dynQual2: 20,
  dynRes1: '96X96', dynQual1: 25,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  awb: true,
  aec: true,
  agc: true,
  hmirror: false,
  vflip: false,
  specialEffect: 'None',
  xclk: 20000000,
  flashOnCapture: false,
  flashIntensity: 0,
  defaultAngle: 90,
  leftPirAngle: 155,
  middlePirAngle: 90,
  rightPirAngle: 0,
  servoMode: 'sweep',
  servoTimer: '15s'
};

function fillDefaults(row) {
  if (!row) return null;
  const merged = { ...row };
  for (const key in defaultDeviceConfig) {
    if (merged[key] === null || merged[key] === undefined) {
      merged[key] = defaultDeviceConfig[key];
    }
  }
  const booleanKeys = ['awb', 'aec', 'agc', 'hmirror', 'vflip', 'flashOnCapture'];
  for (const key of booleanKeys) {
    if (merged[key] !== null && merged[key] !== undefined) {
      merged[key] = merged[key] === 1 || merged[key] === true;
    }
  }
  return merged;
}

function getDeviceConfig(mac) {
  const stmt = db.prepare('SELECT * FROM device_configs WHERE mac = ?');
  const row = stmt.get(mac);
  return fillDefaults(row);
}

function getAllDeviceConfigs() {
  const stmt = db.prepare('SELECT * FROM device_configs');
  const rows = stmt.all();
  const result = {};
  for (const row of rows) {
    result[row.mac] = fillDefaults(row);
  }
  return result;
}

function upsertDeviceConfig(mac, config) {
  const existing = getDeviceConfig(mac) || defaultDeviceConfig;
  const merged = { ...existing, ...config };
  
  // Cast booleans to integers
  const booleanKeys = ['awb', 'aec', 'agc', 'hmirror', 'vflip', 'flashOnCapture'];
  for (const key of booleanKeys) {
    if (merged[key] === true) merged[key] = 1;
    else if (merged[key] === false) merged[key] = 0;
  }
  
  const stmt = db.prepare(`
    INSERT INTO device_configs (
      mac, name, resolution, quality, scaleMode,
      dynRes5, dynQual5, dynRes4, dynQual4, dynRes3, dynQual3,
      dynRes2, dynQual2, dynRes1, dynQual1, brightness, contrast,
      saturation, awb, aec, agc, hmirror, vflip, specialEffect, xclk, flashOnCapture, flashIntensity,
      defaultAngle, leftPirAngle, middlePirAngle, rightPirAngle, servoMode, servoTimer
    ) VALUES (
      @mac, @name, @resolution, @quality, @scaleMode,
      @dynRes5, @dynQual5, @dynRes4, @dynQual4, @dynRes3, @dynQual3,
      @dynRes2, @dynQual2, @dynRes1, @dynQual1, @brightness, @contrast,
      @saturation, @awb, @aec, @agc, @hmirror, @vflip, @specialEffect, @xclk, @flashOnCapture, @flashIntensity,
      @defaultAngle, @leftPirAngle, @middlePirAngle, @rightPirAngle, @servoMode, @servoTimer
    )
    ON CONFLICT(mac) DO UPDATE SET
      name = @name,
      resolution = @resolution,
      quality = @quality,
      scaleMode = @scaleMode,
      dynRes5 = @dynRes5, dynQual5 = @dynQual5,
      dynRes4 = @dynRes4, dynQual4 = @dynQual4,
      dynRes3 = @dynRes3, dynQual3 = @dynQual3,
      dynRes2 = @dynRes2, dynQual2 = @dynQual2,
      dynRes1 = @dynRes1, dynQual1 = @dynQual1,
      brightness = @brightness,
      contrast = @contrast,
      saturation = @saturation,
      awb = @awb,
      aec = @aec,
      agc = @agc,
      hmirror = @hmirror,
      vflip = @vflip,
      specialEffect = @specialEffect,
      xclk = @xclk,
      flashOnCapture = @flashOnCapture,
      flashIntensity = @flashIntensity,
      defaultAngle = @defaultAngle,
      leftPirAngle = @leftPirAngle,
      middlePirAngle = @middlePirAngle,
      rightPirAngle = @rightPirAngle,
      servoMode = @servoMode,
      servoTimer = @servoTimer
  `);
  
  // Fill undefined with null for param binding
  const params = { mac };
  const keys = [
    'name', 'resolution', 'quality', 'scaleMode',
    'dynRes5', 'dynQual5', 'dynRes4', 'dynQual4', 'dynRes3', 'dynQual3',
    'dynRes2', 'dynQual2', 'dynRes1', 'dynQual1', 'brightness', 'contrast',
    'saturation', 'awb', 'aec', 'agc', 'hmirror', 'vflip', 'specialEffect', 'xclk', 'flashOnCapture', 'flashIntensity',
    'defaultAngle', 'leftPirAngle', 'middlePirAngle', 'rightPirAngle', 'servoMode', 'servoTimer'
  ];
  
  for (const k of keys) {
    params[k] = merged[k] !== undefined ? merged[k] : null;
  }
  
  stmt.run(params);
}

module.exports = {
  db,
  getDeviceConfig,
  getAllDeviceConfigs,
  upsertDeviceConfig
};
