const express = require('express');
const handleAction = require('./action');
const handleTripwire = require('./tripwire');
const handleUpload = require('./upload');
const handleLogin = require('./auth');

function createRouter(wss) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.send('hello world');
  });

  router.get('/action', handleAction);
  router.get('/api/tripwire', handleTripwire(wss));
  router.post('/upload', express.raw({ limit: '10mb', type: 'image/jpeg' }), handleUpload(wss));
  router.post('/api/login', express.json(), handleLogin);

  return router;
}

module.exports = createRouter;
