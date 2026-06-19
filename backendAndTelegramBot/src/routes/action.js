function handleAction(req, res) {
  const action = req.query.do;
  if (action === 'left' || action === 'right') {
    const { switchActiveStream } = require('../websocket');
    const newActiveId = switchActiveStream(action);
    console.log(`Action ${action} executed. New active stream: ${newActiveId}`);
    res.send(`Action ${action} executed. New active stream: ${newActiveId}`);
  } else {
    res.status(400).send('Invalid action. Use ?do=left or ?do=right');
  }
}

module.exports = handleAction;
