<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import ServoConfiguratorModal from './ServoConfiguratorModal.vue'
import CameraConfiguratorModal from './CameraConfiguratorModal.vue'
import CameraFeed from './CameraFeed.vue'

const props = defineProps({
  devices: {
    type: Array,
    default: () => []
  },
  currentStream: {
    type: Object,
    required: true
  },
  liveImageSrc: {
    type: String,
    required: true
  },
  liveBoxes: {
    type: Array,
    default: () => []
  },
  cameraImages: {
    type: Object,
    default: () => ({})
  },
  cameraBoxes: {
    type: Object,
    default: () => ({})
  },
  windowWidth: {
    type: Number,
    required: true
  },
  viewMode: {
    type: String,
    default: 'single'
  },
  aiEnabled: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['triggerCameraAction', 'triggerServoAction', 'saveServoConfig', 'saveCameraConfig', 'setViewMode', 'setAiEnabled'])
const servoValue = ref(90)
const showConfig = ref(false)
const showCameraConfig = ref(false)

const gridClass = computed(() => {
  const count = props.devices.length;
  if (count <= 1) return 'grid-container devices-1';
  if (count === 2) return 'grid-container devices-2';
  return 'grid-container devices-3-4';
})

const handleSaveConfig = (config) => {
  emit('saveServoConfig', {
    mac: props.currentStream.mac,
    config
  })
  showConfig.value = false
}

const handleSaveCameraConfig = (config) => {
  emit('saveCameraConfig', {
    mac: props.currentStream.mac,
    config
  })
  showCameraConfig.value = false
}
</script>

<template>
  <div class="stream-view-wrapper d-flex flex-column col-lg-10 p-0">
    <!-- KIRI: Primary Stream View -->
    <section class="stream-section bg-black position-relative flex-grow-1">
      <!-- Header Stream (Absolute agar video bisa full edge-to-edge) -->
      <div class="position-absolute top-0 start-0 w-100 p-3 d-flex justify-content-between align-items-center z-2 stream-header-grad">
        <span v-if="currentStream.status === 'Online' && viewMode !== 'multiple'" class="badge rounded-pill bg-danger text-white border border-danger border-opacity-25 d-flex align-items-center gap-2 px-3 py-1 fs-6">
          <span class="spinner-grow spinner-grow-sm" style="width: 0.8rem; height: 0.8rem;" role="status"></span>
          LIVE FEED
        </span>
        <span v-else-if="viewMode !== 'multiple'" class="badge rounded-pill bg-secondary text-white border border-secondary border-opacity-25 d-flex align-items-center gap-2 px-3 py-1 fs-6">
          <i class="bi bi-camera-video-off-fill fs-6"></i>
          OFFLINE
        </span>
        
        <div v-if="viewMode !== 'multiple'" class="d-flex align-items-center gap-2 gap-sm-3">
          <span class="text-white fw-bold font-monospace text-uppercase ip-label" style="text-shadow: 1px 1px 2px black; font-size: 0.8rem;">
            <span class="d-none d-sm-inline">ESP32-CAM</span> [{{ currentStream.ip }}]
          </span>
        </div>
      </div>

      <!-- Video Container -->
      <div class="w-100 h-100 position-relative d-flex align-items-center justify-content-center">
        <!-- SINGLE VIEW -->
        <template v-if="viewMode !== 'multiple'">
          <CameraFeed v-if="currentStream.status === 'Online'"
            :deviceId="currentStream.id"
            :imageSrc="liveImageSrc"
            :boxes="liveBoxes"
            :aiEnabled="aiEnabled"
          />
          <!-- Offline Overlay -->
          <div v-if="currentStream.status !== 'Online'" 
               class="position-absolute top-50 start-50 translate-middle d-flex flex-column align-items-center text-secondary opacity-50">
            <i class="bi bi-camera-video-off" style="font-size: 6rem;"></i>
            <div class="fw-bold text-uppercase mt-2" style="letter-spacing: 4px; font-size: 0.8rem;">Camera Offline</div>
          </div>
        </template>

        <!-- MULTIPLE VIEW (GRID) -->
        <template v-else>
          <div :class="gridClass">
            <div v-for="device in devices" :key="device.id" class="grid-item bg-black position-relative">
              <!-- Grid Header -->
              <div class="position-absolute top-0 start-0 w-100 p-2 d-flex justify-content-between align-items-center z-2 stream-header-grad">
                <span v-if="device.status === 'Online'" class="badge rounded-pill bg-danger text-white border border-danger border-opacity-25 d-flex align-items-center gap-1 px-2 py-0.5" style="font-size: 0.65rem;">
                  <span class="spinner-grow spinner-grow-sm" style="width: 0.5rem; height: 0.5rem;" role="status"></span>
                  LIVE FEED
                </span>
                <span v-else class="badge rounded-pill bg-secondary text-white border border-secondary border-opacity-25 d-flex align-items-center gap-1 px-2 py-0.5" style="font-size: 0.65rem;">
                  OFFLINE
                </span>
                <span class="text-white fw-bold font-monospace text-uppercase text-truncate px-2" style="text-shadow: 1px 1px 2px black; font-size: 0.75rem; max-width: 60%;">
                  {{ device.ip }}
                </span>
              </div>

              <!-- Camera Feed Area -->
              <div class="w-100 h-100 d-flex align-items-center justify-content-center position-relative">
                <CameraFeed v-if="device.status === 'Online'"
                  :deviceId="device.id"
                  :imageSrc="cameraImages[device.id]"
                  :boxes="cameraBoxes[device.id]"
                  :aiEnabled="aiEnabled"
                />
                <div v-else class="text-secondary opacity-50 d-flex flex-column align-items-center">
                  <i class="bi bi-camera-video-off" style="font-size: 2.5rem;"></i>
                  <div class="fw-bold text-uppercase mt-1" style="letter-spacing: 2px; font-size: 0.6rem;">Offline</div>
                </div>
              </div>
            </div>
            
            <!-- Empty State -->
            <div v-if="devices.length === 0" class="position-absolute top-50 start-50 translate-middle text-secondary opacity-50 d-flex flex-column align-items-center">
              <i class="bi bi-camera-video-off" style="font-size: 6rem;"></i>
              <div class="fw-bold text-uppercase mt-2" style="letter-spacing: 4px; font-size: 0.8rem;">No Cameras Available</div>
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- CONTROLS PANEL: Strictly visible on mobile viewports (<1000px) -->
    <div v-if="windowWidth <= 1000" class="controls-panel bg-slate-800 border-bottom border-slate-700 p-3">
      <div class="d-flex flex-column gap-4">
        <!-- Camera Grid Controls -->
        <div class="row g-2 align-items-end">
          <!-- Camera Switch (Always visible on mobile panel) -->
          <div class="col-md-6 d-flex flex-column gap-2">
            <label class="text-secondary small fw-bold text-uppercase d-flex align-items-center gap-2" style="font-size: 0.65rem;">
              Camera Switch <span class="text-info font-monospace">[{{ currentStream.ip || 'N/A' }}]</span>
              <button v-if="currentStream.status === 'Online' && currentStream.mac && currentStream.mac !== 'Unknown MAC'"
                      @click="showCameraConfig = true" 
                      class="btn btn-sm btn-link p-0 text-slate-500 hover-info" 
                      title="Camera Sensor Configuration">
                <i class="bi bi-sliders" style="font-size: 0.75rem;"></i>
              </button>
            </label>
            <div class="d-flex gap-2">
              <button @click="emit('triggerCameraAction', 'left')" 
                      class="btn btn-outline-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2">
                <i class="bi bi-chevron-left"></i> Left
              </button>
              <button @click="emit('triggerCameraAction', 'right')" 
                      class="btn btn-outline-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2">
                Right <i class="bi bi-chevron-right"></i>
              </button>
            </div>
          </div>

          <!-- View Mode Toggle & AI Control (Only visible and controllable on mobile screens) -->
          <div v-if="windowWidth <= 1000" class="col-md-6 d-flex flex-column gap-2">
            <label class="text-secondary small fw-bold text-uppercase" style="font-size: 0.65rem;">Display & AI Controls</label>
            <div class="d-flex gap-2">
              <!-- Single Toggle View Mode Button -->
              <button @click="emit('setViewMode', viewMode === 'single' ? 'multiple' : 'single')" 
                      class="btn btn-outline-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2">
                <i :class="viewMode === 'single' ? 'bi bi-grid-3x3-gap-fill' : 'bi bi-camera-fill'"></i>
                {{ viewMode === 'single' ? 'Multiple View' : 'Single View' }}
              </button>

              <!-- Repurposed AI Disable/Enable Button -->
              <button @click="emit('setAiEnabled', !aiEnabled)" 
                      :class="['btn flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2', aiEnabled ? 'btn-outline-warning' : 'btn-warning']">
                <i :class="aiEnabled ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'"></i>
                {{ aiEnabled ? 'Disable AI' : 'Enable AI' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Servo Controls (PTZ Slider, Always visible on mobile panel) -->
        <div class="d-flex flex-column gap-2">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <label class="text-secondary small fw-bold text-uppercase" style="font-size: 0.65rem;">Servo (PTZ)</label>
              <button @click="showConfig = true" class="btn btn-sm btn-link p-0 text-slate-500 hover-info" title="Servo Configuration">
                <i class="bi bi-gear-fill" style="font-size: 0.75rem;"></i>
              </button>
            </div>
            <span class="badge bg-slate-900 border border-slate-700 text-info font-monospace" style="font-size: 0.8rem; min-width: 50px;">
              {{ servoValue }}°
            </span>
          </div>
          <div class="position-relative py-2">
            <input type="range" 
                   class="form-range custom-slider" 
                   min="0" max="180" step="1"
                   v-model="servoValue"
                   @change="emit('triggerServoAction', servoValue)">
            <div class="d-flex justify-content-between mt-1 px-1 text-slate-500" style="font-size: 0.6rem;">
              <span>0°</span>
              <span>90°</span>
              <span>180°</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Servo Configuration Modal -->
    <ServoConfiguratorModal 
      v-if="showConfig" 
      :mac="currentStream.mac" 
      @close="showConfig = false" 
      @save="handleSaveConfig" 
    />

    <!-- Camera Configuration Modal -->
    <CameraConfiguratorModal 
      v-if="showCameraConfig" 
      :mac="currentStream.mac" 
      @close="showCameraConfig = false" 
      @save="handleSaveCameraConfig" 
    />
  </div>
</template>

<style scoped>
.font-monospace { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }
.object-fit-contain { object-fit: contain; }
.stream-header-grad { background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%); }

/* High-Visibility Custom Slider (for PTZ manual control) */
.custom-slider {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 10px;
  background: #334155;
  border-radius: 5px;
  outline: none;
  margin: 10px 0;
}

.custom-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 10px;
  background: #334155;
  border-radius: 5px;
  border: none;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 28px;
  height: 28px;
  background: #3b82f6;
  border: 3px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -9px;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
}

.custom-slider::-moz-range-track {
  width: 100%;
  height: 10px;
  background: #334155;
  border-radius: 5px;
}

.custom-slider::-moz-range-thumb {
  width: 28px;
  height: 28px;
  background: #3b82f6;
  border: 3px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
}

.text-slate-500 { color: #64748b; }

.bg-slate-800 { background-color: #1e292b; }
.bg-slate-900 { background-color: #0f172a; }

/* --- MULTIPLE VIEW GRID --- */
.grid-container {
  display: grid;
  width: 100%;
  height: 100%;
  padding: 8px;
  gap: 8px;
  background-color: #020617;
}

.grid-container.devices-1 {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}
.grid-container.devices-2 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
}
@media (max-width: 768px) {
  .grid-container.devices-2 {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
}
.grid-container.devices-3-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.grid-item {
  position: relative;
  overflow: hidden;
  border: 1px solid #1e293b;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* --- DESKTOP --- */
@media (min-width: 1001px) {
  .stream-section {
    flex-grow: 1;
    min-height: 0;
    height: 0; /* Let flexbox allocate height dynamically without page overflow */
  }
}

/* --- MOBILE --- */
@media (max-width: 1000px) {
  .stream-view-wrapper {
    width: 100% !important;
    flex: none !important;
    max-width: 100% !important;
  }
  
  .stream-section {
    width: 100% !important;
    height: 45vh;
    min-height: 280px;
    position: sticky;
    top: 0px;
    z-index: 1020;
    border-bottom: 2px solid #1e293b;
  }
}
</style>
