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
    returnToDefaultDuration INTEGER,
    sweepMode TEXT
  )
`);

function getDeviceConfig(mac) {
  const stmt = db.prepare('SELECT * FROM device_configs WHERE mac = ?');
  const row = stmt.get(mac);
  
  if (!row) return null;
  
  // Cast integers back to booleans
  const booleanKeys = ['awb', 'aec', 'agc', 'hmirror', 'vflip', 'flashOnCapture'];
  for (const key of booleanKeys) {
    if (row[key] !== null && row[key] !== undefined) {
      row[key] = row[key] === 1;
    }
  }
  return row;
}

function getAllDeviceConfigs() {
  const stmt = db.prepare('SELECT * FROM device_configs');
  const rows = stmt.all();
  const result = {};
  
  const booleanKeys = ['awb', 'aec', 'agc', 'hmirror', 'vflip', 'flashOnCapture'];
  for (const row of rows) {
    for (const key of booleanKeys) {
      if (row[key] !== null && row[key] !== undefined) {
        row[key] = row[key] === 1;
      }
    }
    result[row.mac] = row;
  }
  return result;
}

function upsertDeviceConfig(mac, config) {
  const existing = getDeviceConfig(mac) || {};
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
      defaultAngle, leftPirAngle, middlePirAngle, rightPirAngle, returnToDefaultDuration, sweepMode
    ) VALUES (
      @mac, @name, @resolution, @quality, @scaleMode,
      @dynRes5, @dynQual5, @dynRes4, @dynQual4, @dynRes3, @dynQual3,
      @dynRes2, @dynQual2, @dynRes1, @dynQual1, @brightness, @contrast,
      @saturation, @awb, @aec, @agc, @hmirror, @vflip, @specialEffect, @xclk, @flashOnCapture, @flashIntensity,
      @defaultAngle, @leftPirAngle, @middlePirAngle, @rightPirAngle, @returnToDefaultDuration, @sweepMode
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
      returnToDefaultDuration = @returnToDefaultDuration,
      sweepMode = @sweepMode
  `);
  
  // Fill undefined with null for param binding
  const params = { mac };
  const keys = [
    'name', 'resolution', 'quality', 'scaleMode',
    'dynRes5', 'dynQual5', 'dynRes4', 'dynQual4', 'dynRes3', 'dynQual3',
    'dynRes2', 'dynQual2', 'dynRes1', 'dynQual1', 'brightness', 'contrast',
    'saturation', 'awb', 'aec', 'agc', 'hmirror', 'vflip', 'specialEffect', 'xclk', 'flashOnCapture', 'flashIntensity',
    'defaultAngle', 'leftPirAngle', 'middlePirAngle', 'rightPirAngle', 'returnToDefaultDuration', 'sweepMode'
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
