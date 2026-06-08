<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  aiEnabled: {
    type: Boolean,
    default: true
  },
  initialConfig: {
    type: Object,
    default: () => ({
      pirAiDetection: true,
      pirAiRecording: true,
      objectTracking: true,
      maxDuration: 30
    })
  }
})

const emit = defineEmits(['close', 'save'])

const pirAiDetection = ref(props.initialConfig.pirAiDetection)
const pirAiRecording = ref(props.initialConfig.pirAiRecording)
const objectTracking = ref(props.initialConfig.objectTracking)
const maxDuration = ref(props.initialConfig.maxDuration)

// Watch detection toggle to automatically turn off recording if detection is disabled
watch(pirAiDetection, (newVal) => {
  if (!newVal) {
    pirAiRecording.value = false
  }
})

const saveConfig = () => {
  emit('save', {
    pirAiDetection: pirAiDetection.value,
    pirAiRecording: pirAiRecording.value,
    objectTracking: objectTracking.value,
    maxDuration: maxDuration.value
  })
}
</script>

<template>
  <div class="modal-overlay d-flex align-items-center justify-content-center p-3">
    <div class="modal-content-custom bg-slate-900 border border-slate-700 rounded-3 shadow-lg p-4" style="max-width: 450px; width: 100%;">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h6 class="text-white mb-0 text-uppercase fw-bold" style="letter-spacing: 1px;">
          <i class="bi bi-cpu me-2 text-warning"></i>AI Configuration
        </h6>
        <button @click="emit('close')" class="btn-close btn-close-white shadow-none"></button>
      </div>

      <!-- AI Disabled Warning Note -->
      <div v-if="!aiEnabled" class="mb-4 p-3 rounded-2 d-flex gap-3 align-items-center" style="background-color: rgba(239, 68, 68, 0.07); border: 1px solid rgba(239, 68, 68, 0.25);">
        <i class="bi bi-exclamation-triangle-fill text-danger fs-5"></i>
        <div>
          <div class="text-danger fw-bold small text-uppercase" style="letter-spacing: 0.5px; font-size: 0.7rem;">AI Features Disabled</div>
          <div class="text-slate-400 mt-1" style="font-size: 0.7rem; line-height: 1.3;">
            The global AI switch is currently turned off. All AI-dependent detection, recording, and tracking settings below are temporarily inactive.
          </div>
        </div>
      </div>

      <!-- PIR Sensor AI Detection & Recording Container -->
      <div class="mb-4 p-3 bg-slate-800 rounded-2 border border-slate-700 transition-all"
           :style="{ opacity: aiEnabled ? 1 : 0.4, pointerEvents: aiEnabled ? 'auto' : 'none' }">
        <!-- Parent Switch: Detection -->
        <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
          <div>
            <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="detectionSwitch">
              PIR Sensor AI Detection
            </label>
            <span class="text-slate-500" style="font-size: 0.7rem;">Enables AI object detection on PIR sensor events</span>
          </div>
          <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="detectionSwitch" v-model="pirAiDetection" :disabled="!aiEnabled">
        </div>

        <!-- Divider Line -->
        <hr style="border-color: #334155; opacity: 0.35; margin: 1rem 0;">

        <!-- Sub-setting Switch: Recording -->
        <div class="form-check form-switch d-flex justify-content-between align-items-center p-0 ms-4" 
             :style="{ opacity: pirAiDetection ? 1 : 0.4, transition: 'opacity 0.2s ease', pointerEvents: pirAiDetection ? 'auto' : 'none' }">
          <div>
            <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="recordingSwitch">
              PIR Sensor AI Recording
            </label>
            <span class="text-slate-500 d-block" style="font-size: 0.7rem;">Saves video clips during PIR AI detection events</span>
          </div>
          <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="recordingSwitch" v-model="pirAiRecording" :disabled="!aiEnabled || !pirAiDetection">
        </div>
      </div>

      <!-- AI Camera Object Tracking Switch -->
      <div class="mb-4 p-3 bg-slate-800 rounded-2 border border-slate-700 transition-all"
           :style="{ opacity: aiEnabled ? 1 : 0.4, pointerEvents: aiEnabled ? 'auto' : 'none' }">
        <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
          <div>
            <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="trackingSwitch">
              AI Camera Object Tracking
            </label>
            <span class="text-slate-500" style="font-size: 0.7rem;">Camera servo follows detected human objects in live stream</span>
          </div>
          <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="trackingSwitch" v-model="objectTracking" :disabled="!aiEnabled">
        </div>
      </div>

      <!-- Max Video Recording Duration (Single Selectable Buttons) -->
      <div class="mb-4 p-3 bg-slate-800 rounded-2 border border-slate-700 transition-all"
           :style="{ opacity: aiEnabled ? 1 : 0.4, pointerEvents: aiEnabled ? 'auto' : 'none' }">
        <label class="text-slate-300 small fw-bold mb-2 text-uppercase d-block">Max Recording Duration</label>
        <span class="text-slate-500 d-block mb-3" style="font-size: 0.7rem;">Compression limits for recorded video files</span>
        
        <div class="d-flex gap-2 justify-content-between">
          <button 
            type="button"
            @click="maxDuration = 10" 
            :class="['btn flex-grow-1 py-2 fw-bold text-uppercase duration-btn', maxDuration === 10 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
            style="font-size: 0.75rem;">
            10s
          </button>
          <button 
            type="button"
            @click="maxDuration = 20" 
            :class="['btn flex-grow-1 py-2 fw-bold text-uppercase duration-btn', maxDuration === 20 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
            style="font-size: 0.75rem;">
            20s
          </button>
          <button 
            type="button"
            @click="maxDuration = 30" 
            :class="['btn flex-grow-1 py-2 fw-bold text-uppercase duration-btn', maxDuration === 30 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
            style="font-size: 0.75rem;">
            30s
          </button>
        </div>
      </div>

      <div class="d-flex gap-2 mt-4">
        <button 
          @click="saveConfig" 
          :disabled="!aiEnabled"
          :class="['btn flex-grow-1 py-2 fw-bold text-uppercase', aiEnabled ? 'btn-warning text-dark' : 'btn-secondary text-slate-300 opacity-50']" 
          style="font-size: 0.75rem;">
          Save Config
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.bg-slate-800 { background-color: #1e293b; }
.bg-slate-900 { background-color: #0f172a; }
.text-slate-300 { color: #cbd5e1; }
.text-slate-500 { color: #64748b; }

/* Custom Switch Styling to look premium */
.custom-switch {
  width: 3.2em;
  height: 1.6em;
  cursor: pointer;
  background-color: #334155;
  border-color: #475569;
}
.custom-switch:focus {
  box-shadow: none;
  border-color: #475569;
}
.custom-switch:checked {
  background-color: #f59e0b;
  border-color: #d97706;
}

/* Duration Button Shadow */
.duration-btn {
  transition: all 0.2s ease;
  border-radius: 6px;
}
.shadow-info {
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.4);
}
</style>
