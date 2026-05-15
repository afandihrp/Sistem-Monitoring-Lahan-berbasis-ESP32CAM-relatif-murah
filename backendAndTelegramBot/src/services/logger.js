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

function updateLatestLogImage(sensor, deviceIp, imageUrl) {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const logs = JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf8'));
      for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        if (log.sensor === sensor && log.deviceId === `cam_${deviceIp.replace(/\./g, '_')}`) {
          log.imageUrl = imageUrl;
          fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error updating log image:', error);
  }
}

module.exports = {
  logEvent,
  getLogs,
  updateLatestLogImage
};
