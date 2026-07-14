function handlePing(req, res) {
  const deviceId = req.query.deviceId;
  const mac = req.query.mac || 'Unknown MAC';
  const rssi = parseInt(req.query.rssi, 10) || 0;
  // Get IP without IPv6 prefix if present
  const ip = req.ip ? req.ip.replace(/^.*:/, '') : 'Unknown IP';

  if (!deviceId) {
    return res.status(400).send('Missing deviceId parameter');
  }

  try {
    const { handleDevicePing } = require('../websocket');
    handleDevicePing(deviceId, mac, rssi, ip);
    res.status(200).send('Ping OK');
  } catch (err) {
    console.error('[API] Error handling device ping:', err);
    res.status(500).send('Internal Server Error');
  }
}

module.exports = handlePing;
