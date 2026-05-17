<script setup>
import { ref, onMounted, computed, watch } from 'vue'

const currentTime = ref(new Date().toLocaleTimeString())
setInterval(() => {
  currentTime.value = new Date().toLocaleTimeString()
}, 1000)

const wsStatus = ref('Offline')
let ws = null

const devices = ref([])
const liveImageSrc = ref('')
let lastObjectUrl = null

const currentStreamIndex = ref(0)
const currentStream = computed(() => devices.value[currentStreamIndex.value] || { name: 'No Active Stream', ip: 'N/A', status: 'Offline' })

const connectWS = () => {
  const backendUrl = `wss://${window.location.hostname}:3000`
  ws = new WebSocket(backendUrl)

  ws.onopen = () => {
    console.log('Connected to WebSocket server')
    wsStatus.value = 'Online'
    // Send initial stream subscription if available
    if (currentStream.value && currentStream.value.id) {
      ws.send(JSON.stringify({ type: 'set_active_stream', deviceId: currentStream.value.id }))
    }
  }

  ws.onclose = () => {
    console.log('WebSocket connection closed')
    wsStatus.value = 'Offline'
    setTimeout(connectWS, 3000)
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    wsStatus.value = 'Offline'
  }

  ws.onmessage = (event) => {
    if (event.data instanceof Blob) {
      if (lastObjectUrl) {
        URL.revokeObjectURL(lastObjectUrl)
      }
      lastObjectUrl = URL.createObjectURL(event.data)
      liveImageSrc.value = lastObjectUrl
      return
    }

    try {
      const data = JSON.parse(event.data)
      if (data.type === 'stream_action') {
        if (data.direction === 'right') {
          currentStreamIndex.value = (currentStreamIndex.value + 1) % devices.value.length
        } else if (data.direction === 'left') {
          currentStreamIndex.value = (currentStreamIndex.value - 1 + devices.value.length) % devices.value.length
        }
        console.log(`Stream switched to index: ${currentStreamIndex.value}`)
      } else if (data.type === 'device_list') {
        devices.value = data.devices
        console.log('Device list updated:', devices.value)
      } else if (data.type === 'motion_event') {
        events.value.unshift({
          id: Date.now(),
          timestamp: data.timestamp,
          trigger: `Motion (${data.sensor.charAt(0).toUpperCase() + data.sensor.slice(1)})`,
          location: data.location,
          sensor: data.sensor, // Keep this to match later
          imageUrl: 'https://via.placeholder.com/640x360/1e293b/f8fafc?text=Capturing+Image...'
        })
        console.log('Motion event received:', data)
      } else if (data.type === 'motion_image_update') {
        // Find the latest motion event for this sensor and update its image
        const eventIndex = events.value.findIndex(e => e.sensor === data.sensor);
        if (eventIndex !== -1) {
          events.value[eventIndex].imageUrl = data.imageUrl;
        }
      } else if (data.type === 'historical_logs') {
        events.value = data.logs.map((log, index) => {
          let formattedTime = log.timestamp;
          if (log.timestamp && log.timestamp.includes('T')) {
            formattedTime = new Date(log.timestamp).toLocaleTimeString();
          }
          return {
            id: `hist_${Date.now()}_${index}`,
            timestamp: formattedTime,
            trigger: log.sensor ? `Motion (${log.sensor.charAt(0).toUpperCase() + log.sensor.slice(1)})` : 'Motion',
            location: log.location || 'Unknown',
            sensor: log.sensor,
            imageUrl: log.imageUrl || 'https://via.placeholder.com/640x360/1e293b/f8fafc?text=Motion+Detected'
          };
        }).reverse();
        console.log('Historical logs loaded:', events.value.length)
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e)
    }
  }
}

watch(currentStream, (newStream) => {
  if (ws && ws.readyState === 1 && newStream && newStream.id) {
    ws.send(JSON.stringify({ type: 'set_active_stream', deviceId: newStream.id }))
    console.log(`Requested stream change to: ${newStream.id}`)
  }
})

onMounted(() => {
  connectWS()
})

const events = ref([])

const triggerCameraAction = async (direction) => {
  console.log(`Triggering camera action: ${direction}`)
  try {
    const response = await fetch(`https://gateway.local:3000/action?do=${direction}`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    console.log(`Camera action ${direction} successful`)
  } catch (error) {
    console.error(`Failed to trigger camera action ${direction}:`, error)
  }
}

const triggerServoAction = (direction) => {
  console.log(`Servo ${direction} triggered (Dummy)`)
}
</script>

<template>
  <!-- WRAPPER UTAMA: Tidak ada padding luar -->
  <div class="main-wrapper d-flex flex-column" data-bs-theme="dark">
    
    <!-- Top Navigation (Tanpa margin, tanpa lengkungan) -->
    <nav class="navbar navbar-expand-lg bg-slate-800 px-3 py-0 border-bottom border-slate-700 z-3" style="min-height: 45px;">
      <div class="container-fluid p-0">
        <a class="navbar-brand fw-bold d-flex align-items-center gap-2 m-0" href="#" style="font-size: 1.1rem;">
          <i class="bi bi-shield-lock-fill text-primary fs-5"></i>
          Gateway_OS
        </a>
        <div class="d-flex align-items-center gap-3">
          <div class="d-flex align-items-center gap-2 border-end pe-3 border-slate-700">
            <div class="fw-bold font-monospace lh-1" style="font-size: 1rem;">{{ currentTime }}</div>
            <div class="text-secondary" style="font-size: 0.75rem;">
              {{ new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }}
            </div>
          </div>
          <div class="d-flex gap-2 text-secondary" style="font-size: 0.85rem;">
            <span class="d-flex align-items-center gap-1">
              <span :class="wsStatus === 'Online' ? 'text-success' : 'text-danger'" class="fw-bold">
                <i :class="wsStatus === 'Online' ? 'bi-broadcast text-success' : 'bi-broadcast-pin text-danger'"></i>
                WS: {{ wsStatus }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content: g-0 membuang gutter/jarak antar kolom -->
    <main class="row g-0 flex-grow-1" id="main-layout">
      
      <!-- KIRI: Primary Stream View -->
      <section class="col-lg-10 stream-section bg-black position-relative">
        <!-- Header Stream (Absolute agar video bisa full edge-to-edge) -->
        <div class="position-absolute top-0 start-0 w-100 p-3 d-flex justify-content-between align-items-center z-2 stream-header-grad">
          <span v-if="currentStream.status === 'Online'" class="badge rounded-pill bg-danger text-white border border-danger border-opacity-25 d-flex align-items-center gap-2 px-3 py-1 fs-6">
            <span class="spinner-grow spinner-grow-sm" style="width: 0.8rem; height: 0.8rem;" role="status"></span>
            LIVE FEED
          </span>
          <span v-else class="badge rounded-pill bg-secondary text-white border border-secondary border-opacity-25 d-flex align-items-center gap-2 px-3 py-1 fs-6">
            <i class="bi bi-camera-video-off-fill fs-6"></i>
            OFFLINE
          </span>
          
          <div class="d-flex align-items-center gap-3">
            <span class="text-white fs-6 fw-bold font-monospace text-uppercase" style="text-shadow: 1px 1px 2px black;">ESP32-CAM [{{ currentStream.ip }}]</span>
            <!-- Signal Icon -->
            <div class="d-flex align-items-end gap-1" style="height: 18px;" :title="currentStream.status === 'Online' ? `Signal Strength: ${currentStream.signalBars || 0}/5` : 'No Signal'">
              <div v-for="i in 5" :key="i" 
                   :style="{ 
                     width: '5px', 
                     height: (i * 20) + '%', 
                     backgroundColor: (currentStream.status === 'Online' && (currentStream.signalBars || 0) >= i) ? '#22c55e' : '#64748b',
                     opacity: (currentStream.status === 'Online' && (currentStream.signalBars || 0) >= i) ? 0.9 : 0.4,
                     boxShadow: (currentStream.status === 'Online' && (currentStream.signalBars || 0) >= i) ? '0 0 8px rgba(34, 197, 94, 0.8)' : 'none',
                     borderRadius: '1.5px'
                   }">
              </div>
            </div>
          </div>
        </div>

        <!-- Video Container -->
        <div class="w-100 h-100 position-relative d-flex align-items-center justify-content-center">
          <img :src="currentStream.status === 'Online' ? (liveImageSrc || `https://via.placeholder.com/1920x1080/000000/3b82f6?text=WAITING+FOR+STREAM`) : `https://via.placeholder.com/1920x1080/000000/000000?text=.`" 
               class="w-100 h-100 object-fit-contain" 
               alt="Main Stream" />
          
          <!-- Offline Overlay -->
          <div v-if="currentStream.status !== 'Online'" 
               class="position-absolute top-50 start-50 translate-middle d-flex flex-column align-items-center text-secondary opacity-50">
            <i class="bi bi-camera-video-off" style="font-size: 6rem;"></i>
            <div class="fw-bold text-uppercase mt-2" style="letter-spacing: 4px; font-size: 0.8rem;">Camera Offline</div>
          </div>
        </div>
      </section>

      <!-- MOBILE CONTROLS: Only visible below 1000px -->
      <div class="mobile-controls-panel bg-slate-800 border-bottom border-slate-700 p-3 d-lg-none">
        <div class="row g-2">
          <!-- Camera Controls -->
          <div class="col-6">
            <div class="d-flex flex-column gap-2">
              <label class="text-secondary small fw-bold text-uppercase" style="font-size: 0.65rem;">Camera Switch</label>
              <div class="d-flex gap-2">
                <button @click="triggerCameraAction('left')" class="btn btn-outline-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2">
                  <i class="bi bi-chevron-left"></i> Left
                </button>
                <button @click="triggerCameraAction('right')" class="btn btn-outline-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2">
                  Right <i class="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
          <!-- Servo Controls -->
          <div class="col-6">
            <div class="d-flex flex-column gap-2">
              <label class="text-secondary small fw-bold text-uppercase" style="font-size: 0.65rem;">Servo (PTZ)</label>
              <div class="d-flex gap-2">
                <button @click="triggerServoAction('left')" class="btn btn-outline-secondary flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2">
                  <i class="bi bi-arrow-left-circle"></i> Left
                </button>
                <button @click="triggerServoAction('right')" class="btn btn-outline-secondary flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2">
                  Right <i class="bi bi-arrow-right-circle"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- KANAN: Sidebar -->
      <aside class="col-lg-2 sidebar-section d-flex flex-column bg-slate-900 border-start border-slate-700">
        
        <!-- Devices Card (Tanpa border luar) -->
        <div class="d-flex flex-column border-bottom border-slate-700 flex-shrink-0 device-panel">
          <div class="bg-slate-800 px-3 py-2 border-bottom border-slate-700">
            <h6 class="m-0 fw-bold d-flex align-items-center gap-2 small">
              <i class="bi bi-hdd-network-fill text-primary"></i> Devices
            </h6>
          </div>
          <div class="overflow-auto custom-scrollbar flex-grow-1">
            <div class="list-group list-group-flush">
              <div v-for="device in devices" :key="device.id" 
                   class="list-group-item bg-transparent border-slate-700 px-3 py-2 transition-all hover-bg">
                <div class="d-flex justify-content-between align-items-center">
                  <div class="overflow-hidden">
                    <div class="fw-bold text-truncate" style="font-size: 0.85rem;">{{ device.mac || 'Unknown MAC' }}</div>
                    <code class="text-info d-block text-truncate" style="font-size: 0.75rem;">{{ device.ip }}</code>
                  </div>
                  <span :class="device.status === 'Online' ? 'bg-success' : 'bg-danger'" 
                        class="badge rounded-pill ms-1" style="font-size: 0.75rem;">
                    {{ device.status }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Events Card -->
        <div class="d-flex flex-column flex-grow-1 overflow-hidden event-panel">
          <div class="bg-slate-800 px-3 py-2 border-bottom border-slate-700 d-flex justify-content-between align-items-center">
            <h6 class="m-0 fw-bold d-flex align-items-center gap-2 small">
              <i class="bi bi-bell-fill text-warning"></i> Events
            </h6>
            <span class="badge bg-slate-700 text-secondary border border-slate-600 extra-small">{{ events.length }}</span>
          </div>
          <div class="overflow-auto custom-scrollbar flex-grow-1">
            <div v-for="event in events" :key="event.id" 
                 class="px-3 py-2 border-bottom border-slate-700 last-child-border-0 transition-all hover-bg">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <div class="d-flex align-items-center gap-2">
                  <div :class="event.trigger.includes('Motion') ? 'bg-primary' : 'bg-warning'" 
                       class="rounded-circle" style="width: 6px; height: 6px;"></div>
                  <span class="fw-bold text-slate-200" style="font-size: 0.8rem;">{{ event.trigger }}</span>
                </div>
                <span class="text-secondary font-monospace" style="font-size: 0.65rem;">{{ event.timestamp }}</span>
              </div>
              <div class="d-flex align-items-center gap-1 text-secondary ps-3" style="font-size: 0.7rem;">
                <i class="bi bi-geo-alt-fill extra-small opacity-50"></i>
                <span class="text-truncate">{{ event.location }}</span>
              </div>
              <div v-if="event.imageUrl" class="mt-2 ps-3 pe-1">
                <img :src="event.imageUrl" class="img-fluid rounded border border-slate-700 w-100" style="max-height: 120px; object-fit: cover;" alt="Motion Snapshot" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </aside>

    </main>
  </div>
</template>

<style scoped>
/* --- BASE UTILITIES --- */
.hover-bg:hover { background-color: rgba(255, 255, 255, 0.03) !important; }
.extra-small { font-size: 0.7rem; }
.font-monospace { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }
.bi-shield-lock-fill { filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5)); }
.list-group-item { border-left: none; border-right: none; }
.list-group-item:first-child { border-top: none; }
.last-child-border-0:last-child { border-bottom: none !important; }
.object-fit-contain { object-fit: contain; }
.stream-header-grad { background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%); }

.main-wrapper {
  width: 100vw;
  background-color: #0f172a; /* bg-slate-900 */
}

/* --- DESKTOP (TV / PC MONITOR) --- */
/* FIXATED: Edge to Edge, No Margin, No Scroll Layout */
@media (min-width: 1001px) {
  .mobile-controls-panel {
    display: none !important;
  }
  
  .main-wrapper {
    height: 100vh;
    overflow: hidden;
  }
  
  #main-layout {
    height: calc(100vh - 45px); /* Setinggi layar dipotong Navbar */
    overflow: hidden;
  }

  .stream-section {
    height: 100%;
  }

  .sidebar-section {
    height: 100%;
    overflow: hidden;
  }

  .device-panel {
    max-height: 40%; /* Bagi tinggi dengan events */
  }

  .event-panel {
    height: 60%;
  }
  
  /* Scrollbar custom hanya untuk list di Sidebar PC */
  .custom-scrollbar { overflow-y: auto; }
}

/* --- MOBILE (SMARTPHONE) --- */
/* SCROLLABLE: Kamera Fixed di atas, Devices & Events berjajar di bawah */
@media (max-width: 1000px) {
  .mobile-controls-panel {
    display: block !important;
  }

  .main-wrapper {
    height: auto !important;
    min-height: 100vh;
    overflow-y: auto !important;
    overflow-x: hidden;
  }

  #main-layout {
    display: flex;
    flex-direction: column;
    height: auto !important;
  }

  .stream-section {
    width: 100% !important;
    height: 45vh; /* Kamera ambil 45% dari layar HP */
    min-height: 280px;
    position: sticky; /* Agar tetap di atas saat scroll */
    top: 0px; /* Nempel saat di-scroll */
    z-index: 1020;
    border-bottom: 2px solid #1e293b;
  }

  .sidebar-section {
    width: 100% !important;
    height: auto !important;
    border-left: none !important;
  }

  .device-panel, .event-panel {
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
  }

  /* Compact padding for mobile readability */
  .device-panel .list-group-item,
  .event-panel .px-3 {
    padding-left: 1.25rem !important;
    padding-right: 1.25rem !important;
  }

  /* Agar di HP konten memanjang terus ke bawah mengikuti scroll body */
  .custom-scrollbar { overflow-y: visible !important; }
}

/* CUSTOM SCROLLBAR UI */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
</style>