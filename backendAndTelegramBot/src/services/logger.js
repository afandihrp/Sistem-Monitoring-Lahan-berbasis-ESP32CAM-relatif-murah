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

async function updateLatestLogWithAI(sensor, deviceIp, imageUrl, humanPresence, aiDetails) {
  const deviceId = `cam_${deviceIp.replace(/\./g, '_')}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (fs.existsSync(LOG_FILE_PATH)) {
        const logs = JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf8'));
        let found = false;
        for (let i = logs.length - 1; i >= 0; i--) {
          const log = logs[i];
          const logTime = new Date(log.timestamp).getTime();
          const isRecent = (Date.now() - logTime) < 10000; // 10 seconds
          if (log.sensor === sensor && log.deviceId === deviceId && !log.imageUrl && isRecent) {
            log.imageUrl = imageUrl;
            log.humanPresence = humanPresence;
            if (aiDetails) {
              log.aiDetails = aiDetails;
            }
            fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
            found = true;
            break;
          }
        }
        if (found) {
          console.log(`[Logger] Successfully updated PIR log with photo after ${attempt + 1} attempt(s).`);
          return;
        }
      }
    } catch (error) {
      console.error('Error updating log with AI:', error);
      return;
    }
    // Wait 100ms before next retry
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Fallback: If still not found after retries, create a new log entry
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const logs = JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf8'));
      logs.push({
        type: 'motion_event',
        sensor: sensor,
        location: deviceIp,
        deviceId: deviceId,
        imageUrl: imageUrl,
        humanPresence: humanPresence,
        aiDetails: aiDetails,
        timestamp: new Date().toISOString()
      });
      fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
      console.log(`[Logger] Fallback triggered: Created new PIR log entry with photo.`);
    }
  } catch (error) {
    console.error('Error writing fallback log:', error);
  }
}


function updateLatestLogVideo(sensor, deviceIp, videoUrl) {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const logs = JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf8'));
      for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        if (log.sensor === sensor && log.deviceId === `cam_${deviceIp.replace(/\./g, '_')}`) {
          log.videoUrl = videoUrl;
          fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error updating log with video:', error);
  }
}

// --- TAMBAHAN FITUR MANAJEMEN PENYIMPANAN (STORAGE MANAGEMENT) ---

// Fungsi helper untuk menghapus file fisik (gambar/video) dengan aman
function deleteFileSafely(fileUrl, folderName) {
  if (!fileUrl) return;
  const fileName = fileUrl.split('/').pop(); // Mengambil nama file dari URL
  const filePath = path.join(__dirname, `../../../data/${folderName}`, fileName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`[Storage] Deleted file: ${fileName}`);
    } catch (err) {
      console.error(`[Storage] Failed to delete file ${fileName}:`, err.message);
    }
  }
}

// 1. Hapus 1 Kejadian (Single Delete)
function deleteEventSingle(timestamp) {
  try {
    let logs = getLogs();
    const index = logs.findIndex(log => log.timestamp === timestamp);

    if (index !== -1) {
      const log = logs[index];
      // Hapus file fisik
      if (log.imageUrl) deleteFileSafely(log.imageUrl, 'photos');
      if (log.videoUrl) deleteFileSafely(log.videoUrl, 'videos');

      // Hapus data dari array log.json
      logs.splice(index, 1);
      fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
      return true;
    }
  } catch (error) {
    console.error('Error in deleteEventSingle:', error);
  }
  return false;
}

// 2. Hapus Banyak Kejadian di 1 Tanggal (Batch Delete)
function deleteEventsByDate(dateString) { // format dateString: "YYYY-MM-DD"
  try {
    let logs = getLogs();
    const initialLength = logs.length;

    logs = logs.filter(log => {
      const logDate = new Date(log.timestamp);
      // Ubah timestamp menjadi format YYYY-MM-DD sesuai waktu lokal
      const localDateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;

      if (localDateStr === dateString) {
        // Hapus file fisik jika tanggal cocok
        if (log.imageUrl) deleteFileSafely(log.imageUrl, 'photos');
        if (log.videoUrl) deleteFileSafely(log.videoUrl, 'videos');
        return false; // false = buang dari array (dihapus)
      }
      return true; // true = simpan
    });

    if (logs.length !== initialLength) {
      fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
      return true;
    }
  } catch (error) {
    console.error('Error in deleteEventsByDate:', error);
  }
  return false;
}

// 3. Hapus Kejadian Paling Tua (Auto-Purge)
function deleteOldestEvent() {
  try {
    let logs = getLogs();
    if (logs.length > 0) {
      const log = logs.shift(); // Menghapus elemen pertama (paling tua)
      if (log.imageUrl) deleteFileSafely(log.imageUrl, 'photos');
      if (log.videoUrl) deleteFileSafely(log.videoUrl, 'videos');

      fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
      return true;
    }
  } catch (error) {
    console.error('Error in deleteOldestEvent:', error);
  }
  return false;
}

// Pastikan fungsi-fungsi ini ikut di-export agar bisa dipanggil oleh websocket.js
module.exports = {
  logEvent,
  getLogs,
  updateLatestLogWithAI,
  updateLatestLogVideo,
  deleteEventSingle,    // <--- Tambahkan
  deleteEventsByDate,   // <--- Tambahkan
  deleteOldestEvent     // <--- Tambahkan
}; 