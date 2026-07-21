const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '../../../data');
const DB_FILE_PATH = path.join(DATA_DIR, 'camera_data.db');
const OLD_JSON_PATH = path.join(DATA_DIR, 'log.json');
const BACKUP_JSON_PATH = path.join(DATA_DIR, 'log.json.backup');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database
const db = new Database(DB_FILE_PATH);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    sensor TEXT,
    location TEXT,
    deviceId TEXT,
    timestamp TEXT,
    imageUrl TEXT,
    videoUrl TEXT,
    humanPresence INTEGER,
    aiDetails TEXT
  )
`);

// Idempotent migration: add mac column as FK reference to device_configs.mac
// SQLite does not support IF NOT EXISTS on ALTER TABLE, so we use try/catch.
try {
  db.exec(`ALTER TABLE logs ADD COLUMN mac TEXT`);
  console.log('[Logger] Migration: added mac column to logs table.');
} catch (e) {
  // Column already exists — silently ignore
}

// Prepared statements for better performance
const insertLogStmt = db.prepare(`
  INSERT INTO logs (type, sensor, location, mac, deviceId, timestamp, imageUrl, videoUrl, humanPresence, aiDetails)
  VALUES (@type, @sensor, @location, @mac, @deviceId, @timestamp, @imageUrl, @videoUrl, @humanPresence, @aiDetails)
`);

const getAllLogsStmt = db.prepare('SELECT * FROM logs ORDER BY timestamp ASC');

// Match by mac when available (stable FK), fallback to deviceId for legacy rows
const updateLogWithAiStmt = db.prepare(`
  UPDATE logs 
  SET imageUrl = ?, humanPresence = ?, aiDetails = ?, mac = COALESCE(mac, ?)
  WHERE id = (
    SELECT id FROM logs 
    WHERE sensor = ? AND (mac = ? OR (mac IS NULL AND deviceId = ?)) AND imageUrl IS NULL AND timestamp >= ? 
    ORDER BY timestamp DESC LIMIT 1
  )
`);

const updateLogWithVideoStmt = db.prepare(`
  UPDATE logs 
  SET videoUrl = ?, mac = COALESCE(mac, ?)
  WHERE id = (
    SELECT id FROM logs 
    WHERE sensor = ? AND (mac = ? OR (mac IS NULL AND deviceId = ?)) AND videoUrl IS NULL 
    ORDER BY timestamp DESC LIMIT 1
  )
`);

/**
 * Map a DB row to a log object, dynamically resolving the current camera name
 * from the device_configs table via mac (stable FK).
 * Falls back to the baked row.location for legacy rows without a mac.
 * @param {object} row - SQLite row
 * @param {object} configsMap - Map of mac -> device config from getAllDeviceConfigs()
 */
function mapRowToLog(row, configsMap) {
  // Resolve current name from config if we have a mac FK; otherwise use baked snapshot
  let resolvedLocation = row.location;
  if (row.mac && configsMap && configsMap[row.mac] && configsMap[row.mac].name) {
    resolvedLocation = configsMap[row.mac].name;
  }

  return {
    id: row.id,
    type: row.type,
    sensor: row.sensor,
    location: resolvedLocation,
    mac: row.mac || null,
    deviceId: row.deviceId,
    timestamp: row.timestamp,
    imageUrl: row.imageUrl,
    videoUrl: row.videoUrl,
    humanPresence: row.humanPresence === 1,
    aiDetails: row.aiDetails ? JSON.parse(row.aiDetails) : null
  };
}

/**
 * Log a new event. Provide eventData.mac for stable FK association.
 * @param {object} eventData
 * @param {string|null} eventData.mac - MAC address of the originating camera device
 */
function logEvent(eventData) {
  try {
    insertLogStmt.run({
      type: eventData.type || null,
      sensor: eventData.sensor || null,
      location: eventData.location || null,
      mac: eventData.mac || null,
      deviceId: eventData.deviceId || null,
      timestamp: eventData.timestamp || new Date().toISOString(),
      imageUrl: eventData.imageUrl || null,
      videoUrl: eventData.videoUrl || null,
      humanPresence: eventData.humanPresence ? 1 : 0,
      aiDetails: eventData.aiDetails ? JSON.stringify(eventData.aiDetails) : null
    });
  } catch (error) {
    console.error('Error inserting log into SQLite:', error);
  }
}

/**
 * Fetch all logs, resolving camera names dynamically from device_configs via mac FK.
 * Legacy rows (mac IS NULL) will use their baked location string as fallback.
 */
function getLogs() {
  try {
    const { getAllDeviceConfigs } = require('./sqllite_config');
    const configsMap = getAllDeviceConfigs();
    const rows = getAllLogsStmt.all();
    return rows.map(row => mapRowToLog(row, configsMap));
  } catch (error) {
    console.error('Error reading logs from SQLite:', error);
    return [];
  }
}

/**
 * Update the most recent log entry matching this sensor/device with AI analysis results.
 * Uses mac as the stable match key when provided; falls back to IP-derived deviceId.
 * @param {string} sensor
 * @param {string} deviceIp
 * @param {string|null} mac - MAC address of the device (stable FK)
 * @param {string} imageUrl
 * @param {boolean} humanPresence
 * @param {object|null} aiDetails
 * @param {string} locationName
 */
async function updateLatestLogWithAI(sensor, deviceIp, mac, imageUrl, humanPresence, aiDetails, locationName) {
  const deviceId = `cam_${deviceIp.replace(/\./g, '_')}`;
  
  try {
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    const info = updateLogWithAiStmt.run(
      imageUrl, 
      humanPresence ? 1 : 0, 
      aiDetails ? JSON.stringify(aiDetails) : null,
      mac || null,      // set mac if currently NULL on the row
      sensor, 
      mac || null,      // match by mac
      deviceId,         // fallback match by deviceId
      tenSecondsAgo
    );
    
    if (info.changes > 0) {
      console.log(`[Logger] Successfully updated PIR log with photo.`);
    } else {
      // Fallback: create a new log entry
      logEvent({
        type: 'motion_event',
        sensor: sensor,
        location: locationName || deviceIp,
        mac: mac || null,
        deviceId: deviceId,
        imageUrl: imageUrl,
        humanPresence: humanPresence,
        aiDetails: aiDetails,
        timestamp: new Date().toISOString()
      });
      console.log(`[Logger] Fallback triggered: Created new PIR log entry with photo.`);
    }
  } catch (error) {
    console.error('Error updating log with AI:', error);
  }
}

/**
 * Update the most recent log entry matching this sensor/device with a video URL.
 * Uses mac as the stable match key when provided; falls back to IP-derived deviceId.
 * @param {string} sensor
 * @param {string} deviceIp
 * @param {string|null} mac - MAC address of the device (stable FK)
 * @param {string} videoUrl
 */
function updateLatestLogVideo(sensor, deviceIp, mac, videoUrl) {
  try {
    const deviceId = `cam_${deviceIp.replace(/\./g, '_')}`;
    updateLogWithVideoStmt.run(
      videoUrl,
      mac || null,   // set mac if currently NULL on the row
      sensor,
      mac || null,   // match by mac
      deviceId       // fallback match by deviceId
    );
  } catch (error) {
    console.error('Error updating log with video:', error);
  }
}

// --- STORAGE MANAGEMENT ---

function deleteFileSafely(fileUrl, folderName) {
  if (!fileUrl) return;
  const fileName = fileUrl.split('/').pop();
  const filePath = path.join(DATA_DIR, folderName, fileName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`[Storage] Deleted file: ${fileName}`);
    } catch (err) {
      console.error(`[Storage] Failed to delete file ${fileName}:`, err.message);
    }
  }
}

function deleteEventSingle(timestamp) {
  try {
    const row = db.prepare('SELECT * FROM logs WHERE timestamp = ?').get(timestamp);
    if (row) {
      if (row.imageUrl) deleteFileSafely(row.imageUrl, 'photos');
      if (row.videoUrl) deleteFileSafely(row.videoUrl, 'videos');
      
      db.prepare('DELETE FROM logs WHERE id = ?').run(row.id);
      return true;
    }
  } catch (error) {
    console.error('Error in deleteEventSingle:', error);
  }
  return false;
}

function deleteEventsByDate(dateString) { // format dateString: "YYYY-MM-DD"
  try {
    const rows = db.prepare("SELECT * FROM logs").all();
    const idsToDelete = [];
    
    for (const row of rows) {
      const logDate = new Date(row.timestamp);
      // Ubah timestamp menjadi format YYYY-MM-DD sesuai waktu lokal
      const localDateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
      
      if (localDateStr === dateString) {
        if (row.imageUrl) deleteFileSafely(row.imageUrl, 'photos');
        if (row.videoUrl) deleteFileSafely(row.videoUrl, 'videos');
        idsToDelete.push(row.id);
      }
    }
    
    if (idsToDelete.length > 0) {
      // Chunking if there are too many IDs (sqlite limit is 999 vars)
      const chunkSize = 500;
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        const deleteStmt = db.prepare(`DELETE FROM logs WHERE id IN (${chunk.map(() => '?').join(',')})`);
        deleteStmt.run(...chunk);
      }
      return true;
    }
  } catch (error) {
    console.error('Error in deleteEventsByDate:', error);
  }
  return false;
}

function deleteOldestEvent() {
  try {
    const row = db.prepare('SELECT * FROM logs ORDER BY timestamp ASC LIMIT 1').get();
    if (row) {
      if (row.imageUrl) deleteFileSafely(row.imageUrl, 'photos');
      if (row.videoUrl) deleteFileSafely(row.videoUrl, 'videos');
      
      db.prepare('DELETE FROM logs WHERE id = ?').run(row.id);
      return true;
    }
  } catch (error) {
    console.error('Error in deleteOldestEvent:', error);
  }
  return false;
}

module.exports = {
  logEvent,
  getLogs,
  updateLatestLogWithAI,
  updateLatestLogVideo,
  deleteEventSingle,
  deleteEventsByDate,
  deleteOldestEvent
};
