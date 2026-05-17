const { WebSocketServer } = require('ws');
const { logEvent, getLogs } = require('./services/logger');
const { sendMotionAlert } = require('./services/telegram');

// Track connected camera devices
const devices = new Map();

function heartbeat() {
  this.isAlive = true;
}

function broadcastDeviceList(wss) {
  const deviceList = Array.from(devices.values()).map(device => ({
    id: device.id,
    name: device.name,
    status: device.status,
    ip: device.ip,
    mac: device.mac,
    type: device.type,
    signalBars: device.signalBars,
    lastSeen: device.lastSeen
  }));

  const payload = JSON.stringify({ type: 'device_list', devices: deviceList });
  
  wss.clients.forEach((client) => {
    // Only send to Kiosks (not the camera itself)
    if (client.readyState === 1 && !client.path.startsWith('/camera')) {
      client.send(payload);
    }
  });
}

function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const isCamera = req.url.startsWith('/camera');
    const remoteIp = req.socket.remoteAddress.replace('::ffff:', '');
    const macAddress = req.headers['x-mac-address'] || 'Unknown MAC';
    
    console.log(`Connection attempt: URL=${req.url}, isCamera=${isCamera}, IP=${remoteIp}`);
    
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    ws.path = req.url; // Store path to identify client type later

    if (isCamera) {
      console.log(`Camera connected: ${remoteIp} (MAC: ${macAddress})`);
      const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
      devices.set(deviceId, {
        id: deviceId,
        name: macAddress !== 'Unknown MAC' ? `ESP32-CAM [${macAddress}]` : `ESP32-CAM (${remoteIp})`,
        status: 'Online',
        ip: remoteIp,
        mac: macAddress,
        type: 'Camera',
        signalBars: 0,
        lastSeen: new Date().toLocaleTimeString(),
        ws: ws  // simpan referensi untuk on-demand capture
      });
      broadcastDeviceList(wss);
    } else {
      console.log('Kiosk connected.');
      // Send current device list to the new Kiosk immediately
      broadcastDeviceList(wss);
      
      // Send historical logs to the kiosk
      const historicalLogs = getLogs();
      if (historicalLogs && historicalLogs.length > 0) {
        ws.send(JSON.stringify({ type: 'historical_logs', logs: historicalLogs }));
      }
    }
    
    ws.on('message', (message, isBinary) => {
      if (isBinary && isCamera) {
        // Broadcast binary camera frames ONLY to Kiosks that subscribed to THIS camera
        const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && !client.path.startsWith('/camera') && client.activeDeviceId === deviceId) {
            client.send(message, { binary: true });
          }
        });
      } else if (!isBinary) {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'signal' && isCamera) {
            const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
            const device = devices.get(deviceId);
            if (device) {
              device.signalBars = data.bars;
              device.lastSeen = new Date().toLocaleTimeString();
              broadcastDeviceList(wss);
            }
          } else if (data.type === 'motion' && isCamera) {
            const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
            const device = devices.get(deviceId);
            const location = device ? device.name : remoteIp;
            
            console.log(`Motion detected by ${location}: ${data.sensor}`);

            // Log event to data/log.json
            logEvent({
              type: 'motion_event',
              sensor: data.sensor,
              location: location,
              deviceId: deviceId,
              timestamp: new Date().toISOString()
            });

            // Broadcast motion event to all Kiosks
            const payload = JSON.stringify({ 
              type: 'motion_event', 
              sensor: data.sensor, 
              location: location,
              deviceId: deviceId,
              timestamp: new Date().toLocaleTimeString()
            });
            
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && !client.path.startsWith('/camera')) {
                client.send(payload);
              }
            });

            // Telegram alert sekarang dikirim dari routes.js SETELAH foto tersimpan
            // agar gambar yang dilampirkan selalu foto dari event ini, bukan foto lama

          } else if (data.type === 'set_active_stream' && !isCamera) {
            // Kiosk subscribing to a specific camera stream
            ws.activeDeviceId = data.deviceId;
            console.log(`Kiosk subscribed to stream: ${data.deviceId}`);
          }
        } catch (e) {
          console.log(`Received text message from ${isCamera ? 'Camera' : 'Kiosk'}: ${message}`);
        }
      }
    });

    ws.on('close', () => {
      if (isCamera) {
        const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
        const device = devices.get(deviceId);
        if (device) {
          device.status = 'Offline';
          device.lastSeen = new Date().toLocaleTimeString();
          console.log(`Camera ${remoteIp} disconnected.`);
          broadcastDeviceList(wss);
        }
      } else {
        console.log('Kiosk connection closed.');
      }
    });
  });

  // Heartbeat interval check setiap 30 detik
  // Harus lebih panjang dari max upload time ESP32 (~15 detik untuk foto 1080p)
  // agar koneksi tidak di-terminate saat kamera sedang upload foto
  const interval = setInterval(function ping() {

    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) {
        console.log(`Terminating inactive connection: ${ws.path}`);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);


  wss.on('close', function close() {
    clearInterval(interval);
  });

  return wss;
}

// Kirim perintah capture ke kamera tertentu via WebSocket
function sendCaptureRequest(deviceId) {
  const device = devices.get(deviceId);
  if (!device || !device.ws || device.ws.readyState !== 1) {
    console.log(`sendCaptureRequest: device ${deviceId} not available`);
    return false;
  }
  device.ws.send(JSON.stringify({ type: 'capture_request' }));
  console.log(`Capture request sent to ${deviceId}`);
  return true;
}

// Getter untuk mengakses daftar perangkat yang terhubung dari modul lain
function getDevices() {
  return devices;
}

module.exports = { initWebSocket, getDevices, sendCaptureRequest };
