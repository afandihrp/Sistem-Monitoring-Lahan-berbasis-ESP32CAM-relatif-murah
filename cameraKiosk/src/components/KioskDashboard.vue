<script setup>
import { ref } from 'vue'

const currentTime = ref(new Date().toLocaleTimeString())
setInterval(() => {
  currentTime.value = new Date().toLocaleTimeString()
}, 1000)

const devices = ref([
  { id: 1, name: 'Main Gate Cam', status: 'Online', ip: '192.168.1.101', type: 'Camera', lastSeen: 'Just now' },
  { id: 2, name: 'Backyard Cam', status: 'Online', ip: '192.168.1.102', type: 'Camera', lastSeen: '2 mins ago' },
  { id: 3, name: 'Driveway Sensor', status: 'Offline', ip: '192.168.1.105', type: 'Sensor', lastSeen: '1 hour ago' },
])

const latestCapture = ref({
  timestamp: new Date().toLocaleTimeString(),
  imageUrl: 'https://via.placeholder.com/640x360/1e293b/f8fafc?text=Live+Capture+Feed',
  trigger: 'Motion Detected',
  location: 'Main Gate'
})
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
      <section class="col-lg-9 d-flex flex-column h-100 overflow-hidden">
        <div class="card h-100 rounded-4 shadow-soft bg-black border-slate-700 overflow-hidden position-relative">
          <div class="card-header bg-slate-800 border-bottom border-slate-700 px-4 py-2 d-flex justify-content-between align-items-center z-1">
            <span class="badge rounded-pill bg-danger-subtle text-danger border border-danger border-opacity-25 d-flex align-items-center gap-2">
              <span class="spinner-grow spinner-grow-sm" role="status"></span>
              LIVE FEED
            </span>
            <span class="text-secondary small font-monospace">CAM_01 // MAIN_GATE</span>
          </div>
          
          <div class="card-body p-0 d-flex align-items-center justify-content-center bg-black">
            <img :src="latestCapture.imageUrl" 
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
      <aside class="col-lg-3 d-flex flex-column h-100 gap-3 overflow-hidden">
        <!-- Devices Card -->
        <div class="card flex-grow-1 rounded-4 shadow-soft bg-slate-800 border-slate-700 overflow-hidden">
          <div class="card-header border-bottom border-slate-700 px-4 py-3">
            <h6 class="m-0 fw-bold d-flex align-items-center gap-2">
              <i class="bi bi-hdd-network-fill text-primary"></i>
              Devices
            </h6>
          </div>
          <div class="card-body p-0 overflow-auto custom-scrollbar">
            <div class="list-group list-group-flush">
              <div v-for="device in devices" :key="device.id" 
                   class="list-group-item bg-transparent border-slate-700 px-4 py-3 transition-all hover-bg">
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <div class="fw-bold small">{{ device.name }}</div>
                    <code class="text-info" style="font-size: 0.7rem;">{{ device.ip }}</code>
                  </div>
                  <span :class="device.status === 'Online' ? 'bg-success' : 'bg-danger'" 
                        class="badge rounded-pill" style="font-size: 0.6rem;">
                    {{ device.status }}
                  </span>
                </div>
                <div class="mt-2 text-secondary small" style="font-size: 0.65rem;">
                  <i class="bi bi-clock-history me-1"></i> Last seen: {{ device.lastSeen }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Latest Event Card -->
        <div class="card rounded-4 shadow-soft bg-slate-800 border-slate-700 overflow-hidden">
          <div class="card-header border-bottom border-slate-700 px-4 py-3">
            <h6 class="m-0 fw-bold d-flex align-items-center gap-2">
              <i class="bi bi-bell-fill text-warning"></i>
              Latest Event
            </h6>
          </div>
          <div class="card-body p-3">
            <div class="rounded-3 overflow-hidden border border-slate-700 bg-black">
              <img :src="latestCapture.imageUrl" class="img-fluid opacity-50" alt="Event" />
            </div>
            <div class="mt-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge bg-primary-subtle text-primary border border-primary border-opacity-25 extra-small">
                  {{ latestCapture.trigger }}
                </span>
                <span class="text-secondary font-monospace extra-small">{{ latestCapture.timestamp }}</span>
              </div>
              <p class="small text-secondary m-0">Detected at <strong>{{ latestCapture.location }}</strong></p>
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

/* Responsive fixes for kiosk */
@media (max-height: 600px) {
  .p-3 { padding: 0.5rem !important; }
  .gap-3 { gap: 0.5rem !important; }
  .py-3 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
}
</style>
