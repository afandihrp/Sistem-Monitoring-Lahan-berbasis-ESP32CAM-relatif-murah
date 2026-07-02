const mdns = require('multicast-dns')();
const os = require('os');

/**
 * Gets the first local IPv4 address found (excluding internal/loopback).
 * @returns {string|null} The IP address or null if not found.
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

/**
 * Publishes an mDNS service by listening for queries and responding with the local IP.
 * @param {string} name - The service name (e.g., 'gateway').
 * @param {string} type - The service type (e.g., 'https').
 * @param {number} port - The port number.
 * @param {string} host - The host domain to advertise (e.g., 'gateway.local').
 */
function publishService(name, type, port, host) {
  const ip = getLocalIP();
  
  if (!ip) {
    console.error('mDNS Error: Could not find local IPv4 address.');
    return;
  }

  mdns.on('query', (query) => {
    // Check if any of the questions match the desired host
    const matches = query.questions.some(q => q.name === host && q.type === 'A');

    if (matches) {
      console.log(`mDNS: Responding to query for ${host} with ${ip}`);
      mdns.respond({
        answers: [{
          name: host,
          type: 'A',
          class: 'IN',
          ttl: 300,
          flush: true,
          data: ip
        }]
      });
    }
  });

  console.log(`mDNS advertising "${host}" pointing to ${ip} on port ${port}.`);
}

module.exports = {
  publishService
};
