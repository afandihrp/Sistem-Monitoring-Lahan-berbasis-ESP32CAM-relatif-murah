const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Path to SSL certificates
const options = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.cert'))
};

// Hello World route
app.get('/', (req, res) => {
  res.send('hello world');
});

// Create HTTPS server
https.createServer(options, app).listen(port, () => {
  console.log(`HTTPS Server running at https://localhost:${port}/`);
});
