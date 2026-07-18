const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '../../../data');
const DB_FILE_PATH = path.join(DATA_DIR, 'camera_data.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database
const db = new Database(DB_FILE_PATH);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    name TEXT,
    executeTime TEXT,
    enabled INTEGER,
    settings TEXT
  )
`);

const insertScheduleStmt = db.prepare(`
  INSERT INTO schedules (id, name, executeTime, enabled, settings)
  VALUES (@id, @name, @executeTime, @enabled, @settings)
`);

const deleteScheduleStmt = db.prepare('DELETE FROM schedules WHERE id = ?');
const getAllSchedulesStmt = db.prepare('SELECT * FROM schedules');
const clearSchedulesStmt = db.prepare('DELETE FROM schedules');

function mapRowToSchedule(row) {
  return {
    id: row.id,
    name: row.name,
    executeTime: row.executeTime,
    enabled: row.enabled === 1,
    settings: row.settings ? JSON.parse(row.settings) : {}
  };
}

/**
 * Replace all schedules with a new list. Used when saving from UI.
 */
function saveAllSchedules(schedulesArray) {
  try {
    const transaction = db.transaction((schedules) => {
      clearSchedulesStmt.run();
      for (const s of schedules) {
        insertScheduleStmt.run({
          id: s.id,
          name: s.name,
          executeTime: s.executeTime,
          enabled: s.enabled ? 1 : 0,
          settings: s.settings ? JSON.stringify(s.settings) : '{}'
        });
      }
    });
    transaction(schedulesArray);
    return true;
  } catch (error) {
    console.error('Error saving schedules to SQLite:', error);
    return false;
  }
}

function getAllSchedules() {
  try {
    const rows = getAllSchedulesStmt.all();
    return rows.map(mapRowToSchedule);
  } catch (error) {
    console.error('Error reading schedules from SQLite:', error);
    return [];
  }
}

module.exports = {
  saveAllSchedules,
  getAllSchedules
};
