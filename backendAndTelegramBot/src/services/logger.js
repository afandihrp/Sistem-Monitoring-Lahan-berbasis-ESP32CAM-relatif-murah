const fs = require('fs');
const path = require('path');

const LOG_FILE_PATH = path.join(__dirname, '../../../data/log.json');

function logEvent(eventData) {
  try {
    let logs = [];
    if (fs.existsSync(LOG_FILE_PATH)) {
      const fileContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
      if (fileContent) {
        logs = JSON.parse(fileContent);
      }
    }
    
    const logEntry = {
      ...eventData,
      timestamp: eventData.timestamp || new Date().toISOString()
    };
    
    logs.push(logEntry);
    
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to log.json:', error);
  }
}

function getLogs() {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const fileContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
      if (fileContent) {
        return JSON.parse(fileContent);
      }
    }
  } catch (error) {
    console.error('Error reading from log.json:', error);
  }
  return [];
}

module.exports = {
  logEvent,
  getLogs
};
