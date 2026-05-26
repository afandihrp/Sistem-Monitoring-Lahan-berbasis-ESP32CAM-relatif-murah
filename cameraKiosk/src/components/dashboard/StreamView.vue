<script setup>
import { ref, onMounted, watch } from 'vue'
import ServoConfiguratorModal from './ServoConfiguratorModal.vue'

const props = defineProps({
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
  windowWidth: {
    type: Number,
    required: true
  },
  viewMode: {
    type: String,
    default: 'single'
  }
})

const emit = defineEmits(['triggerCameraAction', 'triggerServoAction', 'saveServoConfig', 'setViewMode'])
const servoValue = ref(90)
const showConfig = ref(false)
const overlayCanvas = ref(null)
const streamImg = ref(null)

const drawBoxes = () => {
  const canvas = overlayCanvas.value
  const img = streamImg.value
  if (!canvas || !img) return

  const ctx = canvas.getContext('2d')
  
  // Match canvas size to displayed image size
  canvas.width = img.clientWidth
  canvas.height = img.clientHeight

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (!props.liveBoxes || props.liveBoxes.length === 0) return

  // Calculate the exact displayed bounds of the image inside the <img> element (accounting for object-fit: contain)
  const getDisplayImageRect = () => {
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const clientWidth = img.clientWidth;
    const clientHeight = img.clientHeight;

    if (!naturalWidth || !naturalHeight || !clientWidth || !clientHeight) {
      return { left: 0, top: 0, width: clientWidth, height: clientHeight };
    }

    const imageRatio = naturalWidth / naturalHeight;
    const elementRatio = clientWidth / clientHeight;

    let width, height, left, top;

    if (elementRatio > imageRatio) {
      // The element is wider than the image: height matches element, width is scaled
      height = clientHeight;
      width = height * imageRatio;
      top = 0;
      left = (clientWidth - width) / 2;
    } else {
      // The element is taller than the image: width matches element, height is scaled
      width = clientWidth;
      height = width / imageRatio;
      left = 0;
      top = (clientHeight - height) / 2;
    }

    return { left, top, width, height };
  }

  const rect = getDisplayImageRect();

  props.liveBoxes.forEach(box => {
    const [x1_norm, y1_norm, x2_norm, y2_norm] = box.posisi
    const conf = box.confidence

    // Scale and shift coordinates relative to the actual displayed camera feeds (excluding black bars)
    const bx1 = rect.left + x1_norm * rect.width
    const by1 = rect.top + y1_norm * rect.height
    const bw = (x2_norm - x1_norm) * rect.width
    const bh = (y2_norm - y1_norm) * rect.height

    // Draw Box
    ctx.strokeStyle = '#ff0000'
    ctx.lineWidth = 3
    ctx.strokeRect(bx1, by1, bw, bh)

    // Draw Label
    const label = `Person ${Math.round(conf * 100)}%`
    ctx.font = 'bold 14px Arial'
    const textMetrics = ctx.measureText(label)
    const textHeight = 18
    
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(bx1, by1 - textHeight, textMetrics.width + 10, textHeight)
    
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, bx1 + 5, by1 - 5)
  })
}

watch(() => props.liveBoxes, drawBoxes, { deep: true })
watch(() => props.liveImageSrc, drawBoxes)
watch(() => props.windowWidth, drawBoxes)

const handleSaveConfig = (config) => {
  emit('saveServoConfig', {
    mac: props.currentStream.mac,
    config
  })
  showConfig.value = false
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
        
        <div v-if="viewMode !== 'multiple'" class="d-flex align-items-center gap-2 gap-sm-3">
          <span class="text-white fw-bold font-monospace text-uppercase ip-label" style="text-shadow: 1px 1px 2px black;">
            <span class="d-none d-sm-inline">ESP32-CAM</span> [{{ currentStream.ip }}]
          </span>
        </div>
      </div>

      <!-- Video Container -->
      <div class="w-100 h-100 position-relative d-flex align-items-center justify-content-center">
        <img :src="currentStream.status === 'Online' ? (liveImageSrc || `https://via.placeholder.com/1920x1080/000000/3b82f6?text=WAITING+FOR+STREAM`) : `https://via.placeholder.com/1920x1080/000000/000000?text=.`" 
             class="w-100 h-100 object-fit-contain" 
             ref="streamImg"
             alt="Main Stream" />
        
        <!-- AI Overlay Canvas -->
        <canvas ref="overlayCanvas" 
                class="position-absolute pointer-events-none"
                style="pointer-events: none; z-index: 10;">
        </canvas>

        <!-- Offline Overlay -->
        <div v-if="currentStream.status !== 'Online'" 
             class="position-absolute top-50 start-50 translate-middle d-flex flex-column align-items-center text-secondary opacity-50">
          <i class="bi bi-camera-video-off" style="font-size: 6rem;"></i>
          <div class="fw-bold text-uppercase mt-2" style="letter-spacing: 4px; font-size: 0.8rem;">Camera Offline</div>
        </div>
      </div>
    </section>

    <!-- CONTROLS PANEL: Strictly visible on mobile viewports (<1000px) -->
    <div v-if="windowWidth <= 1000" class="controls-panel bg-slate-800 border-bottom border-slate-700 p-3">
      <div class="d-flex flex-column gap-4">
        <!-- Camera Grid Controls -->
        <div class="row g-2 align-items-end">
          <!-- Camera Switch (Always visible on mobile panel) -->
          <div class="col-md-6 d-flex flex-column gap-2">
            <label class="text-secondary small fw-bold text-uppercase" style="font-size: 0.65rem;">
              Camera Switch <span class="text-info font-monospace ms-1">[{{ currentStream.ip || 'N/A' }}]</span>
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

          <!-- View Mode Toggle (Only visible and controllable on mobile screens) -->
          <div v-if="windowWidth <= 1000" class="col-md-6 d-flex flex-column gap-2">
            <label class="text-secondary small fw-bold text-uppercase" style="font-size: 0.65rem;">View Mode</label>
            <div class="d-flex gap-2">
              <button @click="emit('setViewMode', 'single')" 
                      :class="['btn flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2', viewMode === 'single' ? 'btn-primary' : 'btn-outline-primary']">
                <i class="bi bi-camera-fill"></i> Single View
              </button>
              <button @click="emit('setViewMode', 'multiple')" 
                      :class="['btn flex-grow-1 d-flex align-items-center justify-content-center gap-1 py-2', viewMode === 'multiple' ? 'btn-primary' : 'btn-outline-primary']">
                <i class="bi bi-grid-3x3-gap-fill"></i> Multiple View
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
