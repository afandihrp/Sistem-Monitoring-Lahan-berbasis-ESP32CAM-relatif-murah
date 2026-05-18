<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  currentStream: {
    type: Object,
    required: true
  },
  liveImageSrc: {
    type: String,
    required: true
  },
  windowWidth: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['triggerCameraAction', 'triggerServoAction', 'saveServoConfig'])
const servoValue = ref(90)
const showConfig = ref(false)
const servoConfig = ref({
  defaultAngle: 90,
  leftPirAngle: 45,
  middlePirAngle: 90,
  rightPirAngle: 135
})

const fetchServoConfig = () => {
  if (!props.currentStream.mac || props.currentStream.mac === 'Unknown MAC') return
  
  // Request config from parent (who has the WS connection)
  window.dispatchEvent(new CustomEvent('request_servo_config', { 
    detail: { mac: props.currentStream.mac } 
  }));
}

const handleConfigReceived = (event) => {
  const { mac, config } = event.detail;
  if (mac === props.currentStream.mac && config) {
    servoConfig.value = {
      defaultAngle: config.defaultAngle ?? 90,
      leftPirAngle: config.leftPirAngle ?? 45,
      middlePirAngle: config.middlePirAngle ?? 90,
      rightPirAngle: config.rightPirAngle ?? 135
    };
    console.log('Loaded saved servo config via WS for:', mac);
  }
};

onMounted(() => {
  window.addEventListener('servo_config_received', handleConfigReceived);
})

onUnmounted(() => {
  window.removeEventListener('servo_config_received', handleConfigReceived);
})

watch(showConfig, (newVal) => {
  if (newVal) {
    fetchServoConfig()
  }
})

const saveConfig = () => {
  emit('saveServoConfig', {
    mac: props.currentStream.mac,
    config: servoConfig.value
  })
  showConfig.value = false
}

// Multi-Thumb Slider Logic
const activeThumb = ref(null)
const multiSliderTrack = ref(null)

const handleThumbStart = (thumb) => {
  activeThumb.value = thumb
  window.addEventListener('mousemove', handleThumbMove)
  window.addEventListener('mouseup', handleThumbEnd)
  window.addEventListener('touchmove', handleThumbMove, { passive: false })
  window.addEventListener('touchend', handleThumbEnd)
}

const handleThumbMove = (e) => {
  if (!activeThumb.value || !multiSliderTrack.value) return
  
  e.preventDefault()
  const rect = multiSliderTrack.value.getBoundingClientRect()
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const offsetX = clientX - rect.left
  const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100))
  const value = Math.round((percentage / 100) * 180)

  // Non-overlapping constraints (min 20 degrees apart)
  const MIN_DIST = 20;
  if (activeThumb.value === 'left') {
    servoConfig.value.leftPirAngle = Math.min(value, servoConfig.value.middlePirAngle - MIN_DIST)
  } else if (activeThumb.value === 'middle') {
    servoConfig.value.middlePirAngle = Math.max(servoConfig.value.leftPirAngle + MIN_DIST, Math.min(value, servoConfig.value.rightPirAngle - MIN_DIST))
  } else if (activeThumb.value === 'right') {
    servoConfig.value.rightPirAngle = Math.max(value, servoConfig.value.middlePirAngle + MIN_DIST)
  }
}

const handleThumbEnd = () => {
  activeThumb.value = null
  window.removeEventListener('mousemove', handleThumbMove)
  window.removeEventListener('mouseup', handleThumbEnd)
  window.removeEventListener('touchmove', handleThumbMove)
  window.removeEventListener('touchend', handleThumbEnd)
}
</script>

<template>
  <div class="stream-view-wrapper d-flex flex-column col-lg-10 p-0">
    <!-- KIRI: Primary Stream View -->
    <section class="stream-section bg-black position-relative flex-grow-1">
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
        
        <div class="d-flex align-items-center gap-2 gap-sm-3">
          <span class="text-white fw-bold font-monospace text-uppercase ip-label" style="text-shadow: 1px 1px 2px black;">
            <span class="d-none d-sm-inline">ESP32-CAM</span> [{{ currentStream.ip }}]
          </span>
          <!-- Signal Icon -->
          <div class="d-flex align-items-end gap-1 signal-bars" style="height: 18px;" :title="currentStream.status === 'Online' ? `Signal Strength: ${currentStream.signalBars || 0}/5` : 'No Signal'">
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
    <div v-show="windowWidth <= 1000" class="mobile-controls-panel bg-slate-800 border-bottom border-slate-700 p-3">
      <div class="d-flex flex-column gap-4">
        <!-- Camera Controls -->
        <div class="d-flex flex-column gap-2">
          <label class="text-secondary small fw-bold text-uppercase" style="font-size: 0.65rem;">Camera Switch</label>
          <div class="d-flex gap-2">
            <button @click="emit('triggerCameraAction', 'left')" class="btn btn-outline-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2">
              <i class="bi bi-chevron-left"></i> Left
            </button>
            <button @click="emit('triggerCameraAction', 'right')" class="btn btn-outline-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2">
              Right <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>

        <!-- Servo Controls (PTZ Slider) -->
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
    <div v-if="showConfig" class="modal-overlay d-flex align-items-center justify-content-center p-3">
      <div class="modal-content-custom bg-slate-900 border border-slate-700 rounded-3 shadow-lg p-4" style="max-width: 450px; width: 100%;">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h6 class="text-white mb-0 text-uppercase fw-bold" style="letter-spacing: 1px;">
            <i class="bi bi-gear-wide-connected me-2 text-info"></i>Servo Configuration
          </h6>
          <button @click="showConfig = false" class="btn-close btn-close-white shadow-none"></button>
        </div>

        <!-- Default Angle -->
        <div class="mb-4 p-3 bg-slate-800 rounded-2 border border-slate-700">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <label class="text-slate-300 small fw-bold">DEFAULT ANGLE</label>
            <span class="text-info font-monospace small">{{ servoConfig.defaultAngle }}°</span>
          </div>
          <input type="range" class="form-range custom-slider" min="0" max="180" v-model.number="servoConfig.defaultAngle">
        </div>

        <!-- PIR Mapping (Multi-Thumb Slider) -->
        <div class="mb-4 p-3 bg-slate-800 rounded-2 border border-slate-700">
          <label class="text-slate-300 small fw-bold mb-4 d-block">PIR SENSOR MAPPING</label>
          
          <div class="position-relative py-4 px-1">
            <!-- Labels -->
            <div class="d-flex justify-content-between position-absolute w-100 top-0 start-0 text-slate-500" style="font-size: 1rem; margin-top: -5px;">
              <span :style="{ color: '#ef4444', fontWeight: 'bold', textShadow: '0 0 4px rgba(239, 68, 68, 0.4)' }">LEFT: {{ servoConfig.leftPirAngle }}°</span>
              <span :style="{ color: '#22c55e', fontWeight: 'bold', textShadow: '0 0 4px rgba(34, 197, 94, 0.4)' }">MID: {{ servoConfig.middlePirAngle }}°</span>
              <span :style="{ color: '#3b82f6', fontWeight: 'bold', textShadow: '0 0 4px rgba(59, 130, 246, 0.4)' }">RIGHT: {{ servoConfig.rightPirAngle }}°</span>
            </div>

            <!-- Track -->
            <div ref="multiSliderTrack" class="multi-range-track position-relative bg-slate-700" style="height: 12px; border-radius: 6px;">
              <!-- Colored Segments -->
              <div class="position-absolute h-100" :style="{ left: 0, width: (servoConfig.leftPirAngle/180*100) + '%', background: '#ef4444', opacity: 0.3, borderRadius: '6px 0 0 6px' }"></div>
              <div class="position-absolute h-100" :style="{ left: (servoConfig.leftPirAngle/180*100) + '%', width: ((servoConfig.middlePirAngle - servoConfig.leftPirAngle)/180*100) + '%', background: '#22c55e', opacity: 0.3 }"></div>
              <div class="position-absolute h-100" :style="{ left: (servoConfig.middlePirAngle/180*100) + '%', width: ((servoConfig.rightPirAngle - servoConfig.middlePirAngle)/180*100) + '%', background: '#3b82f6', opacity: 0.3 }"></div>

              <!-- Thumbs -->
              <!-- Left Thumb -->
              <div class="thumb left" 
                   @mousedown="handleThumbStart('left')" 
                   @touchstart="handleThumbStart('left')"
                   :style="{ left: (servoConfig.leftPirAngle/180*100) + '%' }">
              </div>
              <!-- Middle Thumb -->
              <div class="thumb middle" 
                   @mousedown="handleThumbStart('middle')" 
                   @touchstart="handleThumbStart('middle')"
                   :style="{ left: (servoConfig.middlePirAngle/180*100) + '%' }">
              </div>
              <!-- Right Thumb -->
              <div class="thumb right" 
                   @mousedown="handleThumbStart('right')" 
                   @touchstart="handleThumbStart('right')"
                   :style="{ left: (servoConfig.rightPirAngle/180*100) + '%' }">
              </div>
            </div>

            <!-- Degree Ticks -->
            <div class="d-flex justify-content-between mt-3 px-1 text-slate-600" style="font-size: 0.55rem;">
              <span>0°</span>
              <span>45°</span>
              <span>90°</span>
              <span>135°</span>
              <span>180°</span>
            </div>
          </div>
        </div>

        <div class="d-flex gap-2">
          <button @click="saveConfig" class="btn btn-primary flex-grow-1 py-2 fw-bold text-uppercase" style="font-size: 0.75rem;">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-monospace { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }
.object-fit-contain { object-fit: contain; }
.stream-header-grad { background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%); }

/* High-Visibility Custom Slider */
.custom-slider {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 10px;
  background: #334155; /* Slate-700 for better contrast against Slate-800 */
  border-radius: 5px;
  outline: none;
  margin: 10px 0;
}

/* Chrome, Safari, Opera, Edge */
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
  width: 28px; /* Larger for mobile touch */
  height: 28px;
  background: #3b82f6;
  border: 3px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -9px; /* Centers thumb on track: (track_height/2) - (thumb_height/2) = (10/2) - (28/2) = 5 - 14 = -9 */
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
}

/* Firefox */
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

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  z-index: 2000;
}

.modal-content-custom {
  animation: modalScale 0.2s ease-out;
}

@keyframes modalScale {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.bg-slate-800 { background-color: #1e292b; }
.bg-slate-900 { background-color: #0f172a; }
.text-slate-300 { color: #cbd5e1; }
.text-slate-600 { color: #475569; }

.multi-range-track {
  touch-action: none;
}

.thumb {
  position: absolute;
  top: 50%;
  width: 28px;
  height: 28px;
  background: #ffffff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: pointer;
  z-index: 10;
  box-shadow: 0 0 8px rgba(0,0,0,0.5);
  transition: transform 0.1s ease;
}

.thumb:active {
  transform: translate(-50%, -50%) scale(1.1);
}

.thumb.left { border: 4px solid #ef4444; }
.thumb.middle { border: 4px solid #22c55e; }
.thumb.right { border: 4px solid #3b82f6; }

.custom-slider-pir::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
}

.custom-slider-pir.left::-webkit-slider-runnable-track { background: #ef4444; }
.custom-slider-pir.middle::-webkit-slider-runnable-track { background: #22c55e; }
.custom-slider-pir.right::-webkit-slider-runnable-track { background: #3b82f6; }

.custom-slider-pir::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  margin-top: -7px;
}

/* --- DESKTOP --- */
@media (min-width: 1001px) {
  .stream-section {
    height: 100%;
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

@media (max-width: 480px) {
  .stream-header-grad {
    padding: 0.5rem !important;
  }
  .badge {
    font-size: 0.7rem !important;
    padding: 0.25rem 0.5rem !important;
  }
  .ip-label {
    font-size: 0.7rem !important;
  }
  .signal-bars div {
    width: 3px !important;
  }
}
</style>
