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
      streamAiDetection: true,
      streamAiRecording: true,
      streamAiTelegram: true,
      telegramInterval: 10,
      objectTracking: true,
      maxDuration: 30
    })
  }
})

const emit = defineEmits(['close', 'save'])

const pirAiDetection = ref(props.initialConfig.pirAiDetection)
const pirAiRecording = ref(props.initialConfig.pirAiRecording)
const streamAiDetection = ref(props.initialConfig.streamAiDetection)
const streamAiRecording = ref(props.initialConfig.streamAiRecording)
const streamAiTelegram = ref(props.initialConfig.streamAiTelegram)
const telegramInterval = ref(props.initialConfig.telegramInterval !== undefined ? props.initialConfig.telegramInterval : 10)
const objectTracking = ref(props.initialConfig.objectTracking)
const maxDuration = ref(props.initialConfig.maxDuration)

// Watch detection toggle to automatically turn off recording if detection is disabled
watch(pirAiDetection, (newVal) => {
  if (!newVal) {
    pirAiRecording.value = false
  }
})

// Watch stream detection toggle to automatically turn off dependent switches if stream detection is disabled
watch(streamAiDetection, (newVal) => {
  if (!newVal) {
    streamAiTelegram.value = false
    streamAiRecording.value = false
    telegramInterval.value = 10
  }
})

// Watch stream Telegram notification toggle to automatically turn off recording if Telegram is disabled
watch(streamAiTelegram, (newVal) => {
  if (!newVal) {
    streamAiRecording.value = false
    telegramInterval.value = 10
  }
})

const saveConfig = () => {
  emit('save', {
    pirAiDetection: pirAiDetection.value,
    pirAiRecording: pirAiRecording.value,
    streamAiDetection: streamAiDetection.value,
    streamAiRecording: streamAiRecording.value,
    streamAiTelegram: streamAiTelegram.value,
    telegramInterval: telegramInterval.value,
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

      <!-- Scrollable body container for settings -->
      <div class="modal-body-custom pe-1">
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

        <!-- Stream Camera AI Detection & Recording Container -->
        <div class="mb-4 p-3 bg-slate-800 rounded-2 border border-slate-700 transition-all"
             :style="{ opacity: aiEnabled ? 1 : 0.4, pointerEvents: aiEnabled ? 'auto' : 'none' }">
          <!-- Parent Switch: Detection -->
          <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
            <div>
              <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="streamDetectionSwitch">
                Stream Camera Detection
              </label>
              <span class="text-slate-500" style="font-size: 0.7rem;">Enables AI object detection on live stream frames</span>
            </div>
            <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="streamDetectionSwitch" v-model="streamAiDetection" :disabled="!aiEnabled">
          </div>

          <!-- Divider Line -->
          <hr style="border-color: #334155; opacity: 0.35; margin: 1rem 0;">

          <!-- Sub-setting Switch: Telegram Notification -->
          <div class="form-check form-switch d-flex justify-content-between align-items-center p-0 ms-4" 
               :style="{ opacity: streamAiDetection ? 1 : 0.4, transition: 'opacity 0.2s ease', pointerEvents: streamAiDetection ? 'auto' : 'none' }">
            <div>
              <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="streamTelegramSwitch">
                Telegram Notification
              </label>
              <span class="text-slate-500 d-block" style="font-size: 0.7rem;">Sends snapshot and video alerts to Telegram chat</span>
            </div>
            <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="streamTelegramSwitch" v-model="streamAiTelegram" :disabled="!aiEnabled || !streamAiDetection">
          </div>

          <!-- Telegram Interval Setting (Child of Telegram Notification) -->
          <div class="mt-3 ms-5 transition-all"
               :style="{ opacity: (streamAiDetection && streamAiTelegram) ? 1 : 0.4, pointerEvents: (streamAiDetection && streamAiTelegram) ? 'auto' : 'none' }">
            <label class="text-slate-300 small fw-bold mb-2 text-uppercase d-block" style="font-size: 0.7rem;">Notification Cool-off</label>
            <span class="text-slate-500 d-block mb-3" style="font-size: 0.65rem;">Minimum time between consecutive Telegram alerts</span>
            
            <div class="d-flex gap-1 justify-content-between flex-wrap">
              <button 
                type="button"
                @click="telegramInterval = 10" 
                :disabled="!aiEnabled || !streamAiDetection || !streamAiTelegram"
                :class="['btn p-2 fw-bold duration-btn flex-grow-1', telegramInterval === 10 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                style="font-size: 0.7rem; min-width: 50px;">
                10s
              </button>
              <button 
                type="button"
                @click="telegramInterval = 20" 
                :disabled="!aiEnabled || !streamAiDetection || !streamAiTelegram"
                :class="['btn p-2 fw-bold duration-btn flex-grow-1', telegramInterval === 20 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                style="font-size: 0.7rem; min-width: 50px;">
                20s
              </button>
              <button 
                type="button"
                @click="telegramInterval = 30" 
                :disabled="!aiEnabled || !streamAiDetection || !streamAiTelegram"
                :class="['btn p-2 fw-bold duration-btn flex-grow-1', telegramInterval === 30 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                style="font-size: 0.7rem; min-width: 50px;">
                30s
              </button>
              <button 
                type="button"
                @click="telegramInterval = 60" 
                :disabled="!aiEnabled || !streamAiDetection || !streamAiTelegram"
                :class="['btn p-2 fw-bold duration-btn flex-grow-1', telegramInterval === 60 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                style="font-size: 0.7rem; min-width: 50px;">
                1m
              </button>
              <button 
                type="button"
                @click="telegramInterval = 120" 
                :disabled="!aiEnabled || !streamAiDetection || !streamAiTelegram"
                :class="['btn p-2 fw-bold duration-btn flex-grow-1', telegramInterval === 120 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                style="font-size: 0.7rem; min-width: 50px;">
                2m
              </button>
              <button 
                type="button"
                @click="telegramInterval = 180" 
                :disabled="!aiEnabled || !streamAiDetection || !streamAiTelegram"
                :class="['btn p-2 fw-bold duration-btn flex-grow-1', telegramInterval === 180 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                style="font-size: 0.7rem; min-width: 50px;">
                3m
              </button>
            </div>
          </div>

          <!-- Divider Line -->
          <hr style="border-color: #334155; opacity: 0.35; margin: 1rem 0;">

          <!-- Sub-setting Switch: Recording -->
          <div class="form-check form-switch d-flex justify-content-between align-items-center p-0 ms-5" 
               :style="{ opacity: (streamAiDetection && streamAiTelegram) ? 1 : 0.4, transition: 'opacity 0.2s ease', pointerEvents: (streamAiDetection && streamAiTelegram) ? 'auto' : 'none' }">
            <div>
              <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="streamRecordingSwitch">
                Stream Camera Recording
              </label>
              <span class="text-slate-500 d-block" style="font-size: 0.7rem;">Continuous recording as long as there is an object detected</span>
            </div>
            <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="streamRecordingSwitch" v-model="streamAiRecording" :disabled="!aiEnabled || !streamAiDetection || !streamAiTelegram">
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
              <span class="text-slate-500 d-block" style="font-size: 0.7rem;">Continuous recording as long as there is an object detected</span>
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
              <span class="text-slate-500" style="font-size: 0.7rem;">Camera servo follows detected human objects only during active recording events</span>
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

/* Custom Scrollable Body styling */
.modal-body-custom {
  max-height: 55vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 6px;
}

/* Custom dark scrollbar matching premium theme */
.modal-body-custom::-webkit-scrollbar {
  width: 6px;
}
.modal-body-custom::-webkit-scrollbar-track {
  background: transparent;
}
.modal-body-custom::-webkit-scrollbar-thumb {
  background-color: #334155;
  border-radius: 4px;
}
.modal-body-custom::-webkit-scrollbar-thumb:hover {
  background-color: #475569;
}
</style>
