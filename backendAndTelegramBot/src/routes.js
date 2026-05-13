const express = require('express');

function createRouter(wss) {
  const router = express.Router();

  // Hello World route
  router.get('/', (req, res) => {
    res.send('hello world');
  });

  // Action route to control frontend stream
  router.get('/action', (req, res) => {
    const action = req.query.do;
    if (action === 'left' || action === 'right') {
      const payload = JSON.stringify({ type: 'stream_action', direction: action });
      wss.clients.forEach((client) => {
        // WebSocket.OPEN is 1
        if (client.readyState === 1) {
          client.send(payload);
        }
      });
      console.log(`Broadcasted action: ${action}`);
      res.send(`Action ${action} executed`);
    } else {
      res.status(400).send('Invalid action. Use ?do=left or ?do=right');
    }
  });

  return router;
}

module.exports = createRouter;
