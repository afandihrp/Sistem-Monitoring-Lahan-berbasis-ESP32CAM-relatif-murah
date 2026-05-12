<script setup>
import { ref } from 'vue'

const devices = ref([
  { id: 1, name: 'ESP32-CAM-01', status: 'Online', ip: '192.168.1.101' },
  { id: 2, name: 'ESP32-CAM-02', status: 'Online', ip: '192.168.1.102' },
  { id: 3, name: 'Sensor-Node-01', status: 'Offline', ip: '192.168.1.105' },
])

const latestCapture = ref({
  timestamp: new Date().toLocaleString(),
  imageUrl: 'https://via.placeholder.com/400x300?text=Latest+Capture',
  trigger: 'Motion Sensor 1'
})
</script>

<template>
  <div class="kiosk-container">
    <header class="kiosk-header">
      <h1>ESP32CAM Kiosk Gateway</h1>
      <div class="status-bar">
        <span>System Status: <span class="online">Active</span></span>
        <span>{{ new Date().toLocaleDateString() }}</span>
      </div>
    </header>

    <main class="kiosk-main">
      <section class="stream-view">
        <div class="placeholder-stream">
          <div class="overlay">LIVE STREAM - ESP32-CAM-01</div>
          <img src="https://via.placeholder.com/1280x720?text=Camera+Stream+Loading..." alt="Stream View" />
        </div>
      </section>

      <aside class="sidebar">
        <section class="device-list">
          <h2>Connected Devices</h2>
          <ul>
            <li v-for="device in devices" :key="device.id" :class="device.status.toLowerCase()">
              <div class="device-info">
                <span class="device-name">{{ device.name }}</span>
                <span class="device-ip">{{ device.ip }}</span>
              </div>
              <span class="device-status">{{ device.status }}</span>
            </li>
          </ul>
        </section>

        <section class="latest-capture">
          <h2>Latest Capture</h2>
          <div class="capture-card">
            <img :src="latestCapture.imageUrl" alt="Latest Capture" />
            <div class="capture-info">
              <p><strong>Trigger:</strong> {{ latestCapture.trigger }}</p>
              <p><small>{{ latestCapture.timestamp }}</small></p>
            </div>
          </div>
        </section>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.kiosk-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg);
  color: var(--text);
}

.kiosk-header {
  padding: 1rem 2rem;
  background-color: var(--text-h);
  color: var(--bg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--accent);
}

.kiosk-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: inherit;
}

.status-bar {
  display: flex;
  gap: 1.5rem;
  font-size: 0.9rem;
}

.online {
  color: #41B883;
  font-weight: bold;
}

.kiosk-main {
  display: grid;
  grid-template-columns: 3fr 1fr;
  flex-grow: 1;
  overflow: hidden;
  gap: 1px;
  background-color: var(--border);
}

.stream-view {
  background-color: #000;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-stream {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.placeholder-stream img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.overlay {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.8rem;
  z-index: 10;
}

.sidebar {
  display: flex;
  flex-direction: column;
  background-color: var(--bg);
  overflow: hidden;
}

.device-list, .latest-capture {
  padding: 1.5rem;
  overflow-y: auto;
}

.device-list {
  flex: 1;
  border-bottom: 1px solid var(--border);
}

.latest-capture {
  flex: 1;
}

h2 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: var(--accent);
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--social-bg);
  border: 1px solid var(--border);
}

li.online { border-left: 4px solid #41B883; }
li.offline { border-left: 4px solid #ff4141; opacity: 0.7; }

.device-info {
  display: flex;
  flex-direction: column;
}

.device-name {
  font-weight: 500;
  color: var(--text-h);
}

.device-ip {
  font-size: 0.8rem;
  font-family: var(--mono);
}

.device-status {
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: bold;
}

.capture-card {
  background-color: var(--social-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.capture-card img {
  width: 100%;
  height: auto;
  display: block;
}

.capture-info {
  padding: 0.75rem;
}

.capture-info p {
  margin: 0;
  font-size: 0.9rem;
}
</style>
