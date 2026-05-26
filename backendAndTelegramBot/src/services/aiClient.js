const { WebSocketServer, WebSocket } = require('ws');

class AIClient {
  constructor() {
    this.port = 5000;
    this.wss = new WebSocketServer({ port: this.port });
    this.ws = null;
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
    this.isConnected = false;
    this.statusListeners = [];
    this.initServer();
  }

  initServer() {
    console.log(`[AI Server] Starting WebSocket Server on port ${this.port}...`);

    this.wss.on('connection', (ws) => {
      console.log('[AI Server] Python AI client connected successfully.');
      this.ws = ws;
      this.isConnected = true;
      this.notifyStatusChange();

      ws.on('message', (data, isBinary) => {
        try {
          let response;
          if (!isBinary) {
            // Standard text message (JSON string)
            response = JSON.parse(data.toString());
          } else {
            // Binary message (for annotate = true)
            const buffer = data;
            const requestId = buffer.readUInt32BE(0);
            const jsonLen = buffer.readUInt32BE(4);
            const jsonString = buffer.toString('utf8', 8, 8 + jsonLen);
            response = JSON.parse(jsonString);
            response.requestId = requestId;
            
            // Convert the remaining bytes of the buffer (which is the JPEG image) to base64
            // to maintain complete backward compatibility with the rest of the backend
            const imgBuffer = buffer.subarray(8 + jsonLen);
            response.annotated_image = imgBuffer.toString('base64');
            response.status = 'success';
          }

          const { requestId } = response;
          if (requestId !== undefined && this.pendingRequests.has(requestId)) {
            const { resolve, reject, timeout } = this.pendingRequests.get(requestId);
            clearTimeout(timeout);
            this.pendingRequests.delete(requestId);

            if (response.status === 'success') {
              resolve(response);
            } else {
              reject(new Error(response.message || 'AI Server Error'));
            }
          }
        } catch (err) {
          console.error('[AI Server] Error parsing incoming message:', err);
        }
      });

      ws.on('close', () => {
        console.warn('[AI Server] Python AI client disconnected.');
        this.ws = null;
        this.isConnected = false;
        this.notifyStatusChange();
        this.rejectAllPending(new Error('AI Server Connection Closed'));
      });

      ws.on('error', (err) => {
        console.error('[AI Server] Python AI client socket error:', err.message);
      });
    });

    this.wss.on('error', (err) => {
      console.error('[AI Server] WebSocket Server error:', err.message);
    });
  }

  rejectAllPending(error) {
    for (const [requestId, { reject, timeout }] of this.pendingRequests.entries()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pendingRequests.clear();
  }

  onStatusChange(listener) {
    this.statusListeners.push(listener);
  }

  notifyStatusChange() {
    for (const listener of this.statusListeners) {
      try {
        listener(this.isConnected);
      } catch (err) {
        console.error('[AI Client] Error in status listener:', err);
      }
    }
  }

  sendRequest(imageBuffer, annotate = false, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('AI Client is not connected to Python server'));
      }

      const requestId = ++this.requestIdCounter;

      // Construct binary payload:
      // Bytes 0-3: requestId (UInt32BE)
      // Byte 4: annotate flag (UInt8)
      // Bytes 5+: raw binary JPEG image buffer
      const header = Buffer.alloc(5);
      header.writeUInt32BE(requestId, 0);
      header.writeUInt8(annotate ? 1 : 0, 4);
      const payload = Buffer.concat([header, imageBuffer]);

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('AI request timeout'));
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      this.ws.send(payload, { binary: true });
    });
  }
}

const aiClient = new AIClient();

module.exports = {
  aiClient
};
