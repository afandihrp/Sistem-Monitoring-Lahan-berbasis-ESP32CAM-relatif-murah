<script setup>
import { ref, onMounted, computed } from 'vue'

const currentTime = ref(new Date().toLocaleTimeString())
setInterval(() => {
  currentTime.value = new Date().toLocaleTimeString()
}, 1000)

const wsStatus = ref('Offline')
let ws = null

const devices = ref([])

const currentStreamIndex = ref(0)
const currentStream = computed(() => devices.value[currentStreamIndex.value] || { name: 'No Active Stream', ip: 'N/A' })

const connectWS = () => {
  // Replace with your actual server IP/domain if necessary
  ws = new WebSocket('wss://localhost:3000')

  ws.onopen = () => {
    console.log('Connected to WebSocket server')
    wsStatus.value = 'Online'
  }

  ws.onclose = () => {
    console.log('WebSocket connection closed')
    wsStatus.value = 'Offline'
    // Reconnect after 3 seconds
    setTimeout(connectWS, 3000)
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    wsStatus.value = 'Offline'
  }

  ws.onmessage = (event) => {
    console.log('Message from server:', event.data)
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
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e)
    }
  }
}

onMounted(() => {
  connectWS()
})

const events = ref([
  { id: 1, timestamp: '12:45:02', trigger: 'Motion', location: 'Main Gate', imageUrl: 'https://via.placeholder.com/640x360/1e293b/f8fafc?text=Gate+Motion' },
  { id: 2, timestamp: '12:40:15', trigger: 'Door', location: 'Backyard', imageUrl: 'https://via.placeholder.com/640x360/1e293b/f8fafc?text=Door+Open' },
  { id: 3, timestamp: '12:35:50', trigger: 'Motion', location: 'Driveway', imageUrl: 'https://via.placeholder.com/640x360/1e293b/f8fafc?text=Driveway+Motion' },
])
</script>

<template>
  <div class="vh-100 d-flex flex-column p-3 gap-3" data-bs-theme="dark">
    <!-- Top Navigation -->
    <nav class="navbar navbar-expand-lg bg-slate-800 rounded-4 shadow-soft px-4 py-2 border border-slate-700">
      <div class="container-fluid p-0">
        <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="#">
          <i class="bi bi-shield-lock-fill text-primary fs-4"></i>
          Gateway_OS
        </a>
        <div class="d-flex align-items-center gap-4">
          <div class="text-end border-end pe-4 border-slate-700">
            <div class="fw-bold fs-5 font-monospace lh-1">{{ currentTime }}</div>
            <div class="text-secondary small" style="font-size: 0.7rem;">
              {{ new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }}
            </div>
          </div>
          <div class="d-flex gap-3 text-secondary small">
            <span class="d-flex align-items-center gap-1">
              <span :class="wsStatus === 'Online' ? 'text-success' : 'text-danger'" class="fw-bold">
                <i :class="wsStatus === 'Online' ? 'bi-broadcast text-success' : 'bi-broadcast-pin text-danger'"></i>
                WS: {{ wsStatus }}
              </span>
            </span>
            <span class="d-flex align-items-center gap-1">
              <i class="bi bi-cpu text-info"></i> 14%
            </span>
            <span class="d-flex align-items-center gap-1">
              <i class="bi bi-memory text-warning"></i> 2.4GB
            </span>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="row g-3 flex-grow-1 overflow-hidden">
      <!-- Left: Primary Stream View -->
      <section class="col-lg-10 d-flex flex-column h-100 overflow-hidden">
        <div class="card h-100 rounded-4 shadow-soft bg-black border-slate-700 overflow-hidden position-relative">
          <div class="card-header bg-slate-800 border-bottom border-slate-700 px-3 py-2 d-flex justify-content-between align-items-center z-1">
            <span class="badge rounded-pill bg-danger-subtle text-danger border border-danger border-opacity-25 d-flex align-items-center gap-2">
              <span class="spinner-grow spinner-grow-sm" role="status"></span>
              LIVE FEED
            </span>
            <span class="text-white fs-5 fw-bold font-monospace text-uppercase">ESP32-CAM [{{ currentStream.ip }}]</span>
          </div>
          
          <div class="card-body p-0 d-flex align-items-center justify-content-center bg-black">
            <img :src="`https://via.placeholder.com/1280x720/000000/3b82f6?text=${currentStream.name}+Stream`" 
                 class="img-fluid w-100 h-100 object-fit-contain opacity-75" 
                 alt="Main Stream" />
            
            <!-- Floating Overlay HUD -->
            <div class="position-absolute bottom-0 start-0 m-4 p-3 rounded-3 bg-slate-800 bg-opacity-75 border border-slate-700 shadow-lg" style="backdrop-filter: blur(8px);">
              <div class="d-flex flex-column gap-1">
                <div class="small fw-bold text-primary text-uppercase">Telemetry</div>
                <div class="font-monospace extra-small">RES: 1080P // FPS: 24</div>
                <div class="font-monospace extra-small text-success">LINK: STABLE (94%)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Right: Sidebar -->
      <aside class="col-lg-2 d-flex flex-column h-100 gap-3 overflow-hidden">
        <!-- Devices Card (Shorter) -->
        <div class="card rounded-4 shadow-soft bg-slate-800 border-slate-700 overflow-hidden flex-shrink-1" style="max-height: 30%;">
          <div class="card-header border-bottom border-slate-700 px-3 py-2">
            <h6 class="m-0 fw-bold d-flex align-items-center gap-2 small">
              <i class="bi bi-hdd-network-fill text-primary"></i>
              Devices
            </h6>
          </div>
          <div class="card-body p-0 overflow-auto custom-scrollbar">
            <div class="list-group list-group-flush">
              <div v-for="device in devices" :key="device.id" 
                   class="list-group-item bg-transparent border-slate-700 px-3 py-2 transition-all hover-bg">
                <div class="d-flex justify-content-between align-items-center">
                  <div class="overflow-hidden">
                    <div class="fw-bold text-truncate" style="font-size: 0.9rem;">{{ device.mac || 'Unknown MAC' }}</div>
                    <code class="text-info d-block text-truncate" style="font-size: 0.75rem;">{{ device.ip }}</code>
                  </div>
                  <span :class="device.status === 'Online' ? 'bg-success' : 'bg-danger'" 
                        class="badge rounded-pill ms-1" style="font-size: 0.7rem; padding: 0.25em 0.5em;">
                    {{ device.status }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Latest Event Card (Bigger) -->
        <div class="card flex-grow-1 rounded-4 shadow-soft bg-slate-800 border-slate-700 overflow-hidden">
          <div class="card-header border-bottom border-slate-700 px-3 py-2">
            <h6 class="m-0 fw-bold d-flex align-items-center gap-2 small">
              <i class="bi bi-bell-fill text-warning"></i>
              Events
            </h6>
          </div>
          <div class="card-body p-0 overflow-auto custom-scrollbar">
            <div v-for="event in events" :key="event.id" class="p-3 border-bottom border-slate-700 last-child-border-0">
              <div class="rounded-3 overflow-hidden border border-slate-700 bg-black mb-2">
                <img :src="event.imageUrl" class="img-fluid opacity-50" alt="Event" />
              </div>
              <div class="d-flex justify-content-between align-items-center mb-1 gap-1">
                <span class="badge bg-primary-subtle text-primary border border-primary border-opacity-25" style="font-size: 0.65rem;">
                  {{ event.trigger }}
                </span>
                <span class="text-secondary font-monospace" style="font-size: 0.65rem;">{{ event.timestamp }}</span>
              </div>
              <p class="small text-secondary m-0" style="font-size: 0.75rem;">At <strong>{{ event.location }}</strong></p>
            </div>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.hover-bg:hover {
  background-color: rgba(255, 255, 255, 0.03) !important;
}

.extra-small {
  font-size: 0.7rem;
}

.font-monospace {
  font-family: 'JetBrains Mono', ui-monospace, monospace !important;
}

.object-fit-contain {
  object-fit: contain;
}

/* Navbar icon glow */
.bi-shield-lock-fill {
  filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5));
}

/* Custom list group styles */
.list-group-item {
  border-left: none;
  border-right: none;
}
.list-group-item:first-child {
  border-top: none;
}

.last-child-border-0:last-child {
  border-bottom: none !important;
}

/* Responsive fixes for kiosk */
@media (max-height: 600px) {
  .p-3 { padding: 0.5rem !important; }
  .gap-3 { gap: 0.5rem !important; }
  .py-3 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
}
</style>
