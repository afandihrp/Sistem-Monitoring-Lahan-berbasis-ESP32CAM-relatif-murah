const WebSocket = require('ws');

class AIClient {
  constructor() {
    this.url = 'ws://127.0.0.1:5000';
    this.ws = null;
    this.pendingRequests = new Map();
    this.reconnectTimer = null;
    this.requestIdCounter = 0;
    this.isConnected = false;
    this.connect();
  }

  connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    console.log(`[AI Client] Connecting to Python AI server at ${this.url}...`);
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('[AI Client] Connected to Python AI server successfully.');
      this.isConnected = true;
    });

    this.ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
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
        console.error('[AI Client] Error parsing incoming message:', err);
      }
    });

    this.ws.on('close', () => {
      if (this.isConnected) {
        console.warn('[AI Client] Connection to Python AI server closed.');
        this.isConnected = false;
      }
      this.rejectAllPending(new Error('AI Server Connection Closed'));
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[AI Client] WebSocket error:', err.message);
      // 'close' event will trigger reconnect
    });
  }

  scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, 3000); // Reconnect every 3 seconds
    }
  }

  rejectAllPending(error) {
    for (const [requestId, { reject, timeout }] of this.pendingRequests.entries()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pendingRequests.clear();
  }

  sendRequest(imageBuffer, annotate = false, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('AI Client is not connected to Python server'));
      }

      const requestId = ++this.requestIdCounter;
      const base64Image = imageBuffer.toString('base64');

      const payload = JSON.stringify({
        requestId,
        type: 'detect',
        image: base64Image,
        annotate
      });

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('AI request timeout'));
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      this.ws.send(payload);
    });
  }
}

const aiClient = new AIClient();

module.exports = {
  aiClient
};
