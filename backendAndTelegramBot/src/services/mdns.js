const { Bonjour } = require('bonjour-service');

const bonjour = new Bonjour();

function publishService(name, type, port, host) {
  bonjour.publish({ name, type, port, host });
  console.log(`mDNS service "${name}.${type}" published on port ${port} with host ${host}.`);
}

module.exports = {
  publishService
};
