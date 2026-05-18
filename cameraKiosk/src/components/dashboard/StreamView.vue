<script setup>
import { ref } from 'vue'

defineProps({
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

const emit = defineEmits(['triggerCameraAction', 'triggerServoAction'])
const servoValue = ref(90)
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
            <label class="text-secondary small fw-bold text-uppercase" style="font-size: 0.65rem;">Servo (PTZ)</label>
            <span class="badge bg-slate-900 border border-slate-700 text-info font-monospace" style="font-size: 0.8rem; min-width: 50px;">
              {{ servoValue }}°
            </span>
          </div>
          <div class="position-relative py-2">
            <input type="range" 
                   class="form-range custom-slider" 
                   min="0" max="180" step="1"
                   v-model="servoValue"
                   @input="emit('triggerServoAction', servoValue)">
            <div class="d-flex justify-content-between mt-1 px-1 text-slate-500" style="font-size: 0.6rem;">
              <span>0°</span>
              <span>90°</span>
              <span>180°</span>
            </div>
          </div>
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
  height: 6px;
  background: #334155; /* Slate-700 for better contrast against Slate-800 */
  border-radius: 5px;
  outline: none;
  margin: 10px 0;
}

/* Chrome, Safari, Opera, Edge */
.custom-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background: #334155;
  border-radius: 3px;
  border: none;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px; /* Larger for mobile touch */
  height: 24px;
  background: #3b82f6;
  border: 3px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -9px; /* Centers thumb on track: (track_height/2) - (thumb_height/2) */
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
}

/* Firefox */
.custom-slider::-moz-range-track {
  width: 100%;
  height: 6px;
  background: #334155;
  border-radius: 3px;
}

.custom-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  background: #3b82f6;
  border: 3px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
}

.text-slate-500 { color: #64748b; }

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
