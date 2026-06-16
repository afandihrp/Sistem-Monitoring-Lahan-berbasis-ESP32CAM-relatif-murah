<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  initialConfig: {
    type: Object,
    default: () => ({
      pirEnabled: true,
      pirCooldown: 30,
      pirRecordVideo: true,
      pirRecordDuration: 10,
      telegramAlertPir: true,
      telegramAlertAi: true,
      telegramAlertMotion: false,
      cameraDetectionEnabled: true,
      cameraDetectionMode: 'AI', // 'AI' | 'Pixel'
      streamAiDetection: true,
      streamAiCaptureEnabled: true,
      objectTracking: true,
      pixelMotionSensitivity: 20,
      pixelMotionMode: 0,
      pixelMotionMerge: false,
      pixelMotionResetInterval: 1,
      pixelMotionClusterDist: 50,
      pixelMotionMinSize: 10,
      pixelMotionCaptureEnabled: true,
      pixelMotionRecordingEnabled: true,
      pixelMotionCaptureDelay: 100,
      webSoundEnabled: true,
      showFpsMeter: true,
      // AI Parameters
      pirAiDetection: true,
      pirAiRecording: true,
      streamAiRecording: true,
      streamAiTelegram: true,
      telegramInterval: 10,
      maxDuration: 30
    })
  }
})

const emit = defineEmits(['close', 'save'])

// Active tab tracking
const activeTab = ref('pir')

// PIR Settings state
const pirEnabled = ref(props.initialConfig.pirEnabled !== undefined ? props.initialConfig.pirEnabled : true)
const pirCooldown = ref(props.initialConfig.pirCooldown || 30)
const pirRecordVideo = ref(props.initialConfig.pirRecordVideo !== undefined ? props.initialConfig.pirRecordVideo : true)
const pirRecordDuration = ref(props.initialConfig.pirRecordDuration || 10)

// Telegram Settings state
const telegramAlertPir = ref(props.initialConfig.telegramAlertPir !== undefined ? props.initialConfig.telegramAlertPir : true)
const telegramAlertAi = ref(props.initialConfig.telegramAlertAi !== undefined ? props.initialConfig.telegramAlertAi : true)
const telegramAlertMotion = ref(props.initialConfig.telegramAlertMotion !== undefined ? props.initialConfig.telegramAlertMotion : false)

// Camera Detection Settings state
const cameraDetectionEnabled = ref(props.initialConfig.cameraDetectionEnabled !== undefined ? props.initialConfig.cameraDetectionEnabled : true)
const cameraDetectionMode = ref(props.initialConfig.cameraDetectionMode || 'AI')
const streamAiDetection = ref(props.initialConfig.streamAiDetection !== undefined ? props.initialConfig.streamAiDetection : true)
const objectTracking = ref(props.initialConfig.objectTracking !== undefined ? props.initialConfig.objectTracking : true)
const getClosestSensitivityPreset = (val) => {
  if (val === undefined || val === null) return 20;
  if (val <= 15) return 10;
  if (val <= 25) return 20;
  if (val <= 37) return 30;
  return 40;
};

const pixelMotionSensitivity = ref(getClosestSensitivityPreset(props.initialConfig.pixelMotionSensitivity))
const pixelMotionMode = ref(props.initialConfig.pixelMotionMode !== undefined ? props.initialConfig.pixelMotionMode : 0)
const pixelMotionMerge = ref(props.initialConfig.pixelMotionMerge !== undefined ? props.initialConfig.pixelMotionMerge : false)
const pixelMotionResetInterval = ref(props.initialConfig.pixelMotionResetInterval !== undefined ? props.initialConfig.pixelMotionResetInterval : 1)
const pixelMotionClusterDist = ref(props.initialConfig.pixelMotionClusterDist || 50)
const pixelMotionMinSize = ref(props.initialConfig.pixelMotionMinSize !== undefined ? props.initialConfig.pixelMotionMinSize : 10)
const pixelMotionCaptureEnabled = ref(props.initialConfig.pixelMotionCaptureEnabled !== undefined ? props.initialConfig.pixelMotionCaptureEnabled : true)
const pixelMotionRecordingEnabled = ref(props.initialConfig.pixelMotionRecordingEnabled !== undefined ? props.initialConfig.pixelMotionRecordingEnabled : true)
const pixelMotionCaptureDelay = ref(props.initialConfig.pixelMotionCaptureDelay !== undefined ? props.initialConfig.pixelMotionCaptureDelay : 100)

// Other Settings state
const webSoundEnabled = ref(props.initialConfig.webSoundEnabled !== undefined ? props.initialConfig.webSoundEnabled : true)
const showFpsMeter = ref(props.initialConfig.showFpsMeter !== undefined ? props.initialConfig.showFpsMeter : true)

// AI configurator specific states
const pirAiDetection = ref(props.initialConfig.pirAiDetection !== undefined ? props.initialConfig.pirAiDetection : true)
const pirAiRecording = ref(props.initialConfig.pirAiRecording !== undefined ? props.initialConfig.pirAiRecording : true)
const getNormalizedStreamAiRecording = (val) => {
  if (val === true) return 'continuous';
  if (val === false) return 'off';
  return val !== undefined ? val : 'continuous';
}
const initialStreamAiRecording = getNormalizedStreamAiRecording(props.initialConfig.streamAiRecording)
const streamAiRecording = ref(
  (props.initialConfig.cameraDetectionMode === 'Pixel')
    ? (props.initialConfig.pixelMotionRecordingEnabled ? (initialStreamAiRecording === 'off' ? 'continuous' : initialStreamAiRecording) : 'off')
    : initialStreamAiRecording
)
const lastStreamAiRecordingDuration = ref((() => {
  const raw = props.initialConfig.streamAiRecording
  if (!raw || raw === 'off' || raw === false) return 'continuous'
  if (raw === true) return 'continuous'
  return raw
})())
const streamAiRecordingSwitch = computed({
  get() {
    return streamAiRecording.value !== 'off'
  },
  set(val) {
    if (val) {
      streamAiRecording.value = lastStreamAiRecordingDuration.value || 'continuous'
    } else {
      if (streamAiRecording.value !== 'off') {
        lastStreamAiRecordingDuration.value = streamAiRecording.value
      }
      streamAiRecording.value = 'off'
    }
  }
})
const streamAiCaptureEnabled = ref(props.initialConfig.streamAiCaptureEnabled !== undefined ? props.initialConfig.streamAiCaptureEnabled : true)
const streamAiTelegram = ref(props.initialConfig.streamAiTelegram !== undefined ? props.initialConfig.streamAiTelegram : true)
const telegramInterval = ref(props.initialConfig.telegramInterval !== undefined ? props.initialConfig.telegramInterval : 10)
const maxDuration = ref(props.initialConfig.maxDuration !== undefined ? props.initialConfig.maxDuration : 30)
const udpStreamEnabled = ref(props.initialConfig.udpStreamEnabled !== undefined ? props.initialConfig.udpStreamEnabled : false)

// Watchers copied from legacy AiConfiguratorModal to preserve cascading settings
watch(pirAiDetection, (newVal) => {
  if (!newVal) {
    pirAiRecording.value = false
  }
})

watch(pixelMotionCaptureEnabled, (newVal) => {
  if (!newVal) {
    pixelMotionRecordingEnabled.value = false
  }
})

watch(streamAiDetection, (newVal) => {
  if (!newVal) {
    streamAiTelegram.value = false
    if (cameraDetectionMode.value === 'AI') {
      streamAiRecording.value = 'off'
    }
  }
})

watch(pixelMotionRecordingEnabled, (newVal) => {
  if (cameraDetectionMode.value === 'Pixel') {
    if (newVal) {
      streamAiRecording.value = lastStreamAiRecordingDuration.value || 'continuous'
    } else {
      if (streamAiRecording.value !== 'off') {
        lastStreamAiRecordingDuration.value = streamAiRecording.value
      }
      streamAiRecording.value = 'off'
    }
  }
})

watch(cameraDetectionMode, (newMode) => {
  if (newMode === 'Pixel') {
    if (pixelMotionRecordingEnabled.value) {
      streamAiRecording.value = lastStreamAiRecordingDuration.value || 'continuous'
    } else {
      if (streamAiRecording.value !== 'off') {
        lastStreamAiRecordingDuration.value = streamAiRecording.value
      }
      streamAiRecording.value = 'off'
    }
  }
})

// Helper to manage unified video recording duration
const updateRecordingDuration = (dur) => {
  const isRecordingActive = streamAiRecording.value !== 'off' || 
    (cameraDetectionMode.value === 'Pixel' && pixelMotionRecordingEnabled.value)

  if (dur === 'continuous') {
    if (isRecordingActive) {
      streamAiRecording.value = 'continuous'
    }
    lastStreamAiRecordingDuration.value = 'continuous'
    pirRecordDuration.value = 60
  } else {
    const val = parseInt(dur, 10)
    if (isRecordingActive) {
      streamAiRecording.value = val
    }
    lastStreamAiRecordingDuration.value = val
    pirRecordDuration.value = val
  }
}

const getRecordingDurationActive = (dur) => {
  if (dur === 'continuous') {
    return lastStreamAiRecordingDuration.value === 'continuous' || lastStreamAiRecordingDuration.value === true
  }
  return parseInt(lastStreamAiRecordingDuration.value, 10) === parseInt(dur, 10)
}


// Helper to get duration / cooldown text labels
const getSecondsLabel = (sec) => {
  if (sec < 60) return `${sec}s`
  return `${sec / 60}m`
}

const saveConfig = () => {
  emit('save', {
    pirEnabled: pirEnabled.value,
    pirCooldown: pirCooldown.value,
    pirRecordVideo: pirRecordVideo.value,
    pirRecordDuration: pirRecordDuration.value,
    telegramAlertPir: telegramAlertPir.value,
    telegramAlertAi: streamAiTelegram.value,
    telegramAlertMotion: telegramAlertMotion.value,
    cameraDetectionEnabled: cameraDetectionEnabled.value,
    cameraDetectionMode: cameraDetectionMode.value,
    streamAiDetection: streamAiDetection.value,
    objectTracking: objectTracking.value,
    pixelMotionSensitivity: pixelMotionSensitivity.value,
    pixelMotionMode: pixelMotionMode.value,
    pixelMotionMerge: pixelMotionMerge.value,
    pixelMotionResetInterval: pixelMotionResetInterval.value,
    pixelMotionClusterDist: pixelMotionClusterDist.value,
    pixelMotionMinSize: pixelMotionMinSize.value,
    pixelMotionCaptureEnabled: pixelMotionCaptureEnabled.value,
    pixelMotionRecordingEnabled: pixelMotionRecordingEnabled.value,
    pixelMotionCaptureDelay: pixelMotionCaptureDelay.value,
    webSoundEnabled: webSoundEnabled.value,
    showFpsMeter: showFpsMeter.value,
    udpStreamEnabled: udpStreamEnabled.value,
    // AI Parameters
    pirAiDetection: pirAiDetection.value,
    pirAiRecording: pirAiRecording.value,
    streamAiRecording: streamAiRecording.value,
    streamAiCaptureEnabled: streamAiCaptureEnabled.value,
    streamAiTelegram: streamAiTelegram.value,
    telegramInterval: telegramInterval.value,
    maxDuration: maxDuration.value
  })
}
</script>

<template>
  <div class="modal-overlay d-flex align-items-center justify-content-center p-3">
    <div class="modal-content-custom bg-slate-900 border border-slate-700 rounded-3 shadow-lg p-4" style="max-width: 480px; width: 100%;">
      
      <!-- Modal Header -->
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-white mb-0 text-uppercase fw-bold" style="letter-spacing: 1px;">
          <i class="bi bi-sliders2-vertical me-2 text-info"></i>System Settings
        </h6>
        <button @click="emit('close')" class="btn-close btn-close-white shadow-none"></button>
      </div>

      <!-- Tab Navigation -->
      <div class="d-flex border-bottom border-slate-700 mb-4 nav-tabs-custom">
        <button 
          @click="activeTab = 'pir'"
          :class="['tab-btn pb-2 fw-bold text-uppercase', activeTab === 'pir' ? 'active text-info' : 'text-slate-400']"
        >
          <i class="bi bi-broadcast me-1"></i>PIR Sensor
        </button>
        <button 
          @click="activeTab = 'telegram'"
          :class="['tab-btn pb-2 fw-bold text-uppercase', activeTab === 'telegram' ? 'active text-info' : 'text-slate-400']"
        >
          <i class="bi bi-telegram me-1"></i>Telegram
        </button>
        <button 
          @click="activeTab = 'camera_detection'"
          :class="['tab-btn pb-2 fw-bold text-uppercase', activeTab === 'camera_detection' ? 'active text-info' : 'text-slate-400']"
        >
          <i class="bi bi-camera-video me-1"></i>Camera Detection
        </button>
        <button 
          @click="activeTab = 'other'"
          :class="['tab-btn pb-2 fw-bold text-uppercase', activeTab === 'other' ? 'active text-info' : 'text-slate-400']"
        >
          <i class="bi bi-gear-fill me-1"></i>Other
        </button>
      </div>

      <!-- Scrollable Settings Body -->
      <div class="modal-body-custom pe-1">
        
        <!-- =================== TAB 1: PIR SENSOR =================== -->
        <div v-if="activeTab === 'pir'" class="tab-pane-content d-flex flex-column gap-3">
          
          <!-- Master Switch: Enable PIR Sensor -->
          <div class="p-3 bg-slate-800 rounded border border-slate-700">
            <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
              <div>
                <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="pirMasterSwitch">
                  Enable PIR Sensor
                </label>
                <span class="text-slate-500" style="font-size: 0.7rem;">Activate physical hardware PIR sensor monitoring</span>
              </div>
              <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="pirMasterSwitch" v-model="pirEnabled">
            </div>
          </div>

          <!-- Trigger Cooldown Selection (Active when PIR sensor is enabled) -->
          <div class="p-3 bg-slate-800 rounded border border-slate-700 transition-all"
               :style="{ opacity: pirEnabled ? 1 : 0.4, pointerEvents: pirEnabled ? 'auto' : 'none' }">
            <label class="text-slate-300 small fw-bold text-uppercase mb-2 d-block">Trigger Cooldown Interval</label>
            <span class="text-slate-500 d-block mb-3" style="font-size: 0.7rem;">Minimum time between hardware PIR detection triggers</span>
            <div class="d-flex gap-1 justify-content-between flex-wrap">
              <button 
                v-for="val in [10, 30, 60, 120, 300]" 
                :key="val"
                type="button"
                :disabled="!pirEnabled"
                @click="pirCooldown = val" 
                :class="['btn p-2 fw-bold duration-btn flex-grow-1', pirCooldown === val ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                style="font-size: 0.7rem; min-width: 60px;"
              >
                {{ getSecondsLabel(val) }}
              </button>
            </div>
          </div>

          <!-- Record Video Switch & Duration Container (Active when PIR sensor is enabled) -->
          <div class="p-3 bg-slate-800 rounded border border-slate-700 transition-all"
               :style="{ opacity: pirEnabled ? 1 : 0.4, pointerEvents: pirEnabled ? 'auto' : 'none' }">
            
            <!-- Parent Switch: Record Video -->
            <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
              <div>
                <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="pirRecordSwitch">
                  Record Video
                </label>
                <span class="text-slate-500" style="font-size: 0.7rem;">Record a video clip automatically on PIR trigger events</span>
              </div>
              <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="pirRecordSwitch" v-model="pirRecordVideo" :disabled="!pirEnabled">
            </div>

          </div>

        </div>

        <!-- =================== TAB 2: TELEGRAM ALERTS =================== -->
        <div v-if="activeTab === 'telegram'" class="tab-pane-content d-flex flex-column gap-3">
          
          <div class="p-3 bg-slate-800 rounded border border-slate-700">
            <label class="text-slate-300 small fw-bold text-uppercase mb-3 d-block">Alert Event Subscriptions</label>
            <div class="d-flex flex-column gap-3">
              
              <!-- PIR Alerts Toggle -->
              <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
                <div>
                  <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="tgPirSwitch">
                    PIR Sensor Triggers
                  </label>
                  <span class="text-slate-500" style="font-size: 0.7rem;">Send instant snapshots to Telegram on PIR activity</span>
                </div>
                <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="tgPirSwitch" v-model="telegramAlertPir">
              </div>

              <!-- Divider -->
              <hr class="m-0" style="border-color: #334155; opacity: 0.35;">

              <!-- AI Alerts Toggle -->
              <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
                <div>
                  <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="tgAiSwitch">
                    AI Detection Triggers
                  </label>
                  <span class="text-slate-500" style="font-size: 0.7rem;">Send alarm clip summaries on verified human detections</span>
                </div>
                <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="tgAiSwitch" v-model="streamAiTelegram">
              </div>

              <!-- Divider -->
              <hr class="m-0" style="border-color: #334155; opacity: 0.35;">

              <!-- Pixel Motion Alerts Toggle -->
              <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
                <div>
                  <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="tgMotionSwitch">
                    Pixel Motion Triggers
                  </label>
                  <span class="text-slate-500" style="font-size: 0.7rem;">Send general motion warnings (non-AI differencing)</span>
                </div>
                <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="tgMotionSwitch" v-model="telegramAlertMotion">
              </div>

            </div>
          </div>

          <!-- Notification Cool-off Setting (Global) -->
          <div class="p-3 bg-slate-800 rounded border border-slate-700">
            <label class="text-slate-300 small fw-bold mb-2 text-uppercase d-block" style="font-size: 0.7rem;">Notification Cool-off</label>
            <span class="text-slate-500 d-block mb-3" style="font-size: 0.65rem;">Minimum time between consecutive Telegram alerts (global)</span>
            <div class="d-flex gap-1 justify-content-between flex-wrap">
              <button 
                v-for="val in [10, 20, 30, 60, 120, 180]" 
                :key="val"
                type="button"
                @click="telegramInterval = val" 
                :class="['btn p-2 fw-bold duration-btn flex-grow-1', telegramInterval === val ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                style="font-size: 0.7rem; min-width: 50px;"
              >
                {{ getSecondsLabel(val) }}
              </button>
            </div>
          </div>

        </div>

        <!-- =================== TAB 3: CAMERA DETECTION =================== -->
        <div v-if="activeTab === 'camera_detection'" class="tab-pane-content d-flex flex-column gap-3">
          
          <!-- Master Switch: Enable Camera Detection -->
          <div class="p-3 bg-slate-800 rounded border border-slate-700">
            <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
              <div>
                <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="cameraDetectionMasterSwitch">
                  Enable Camera Detection
                </label>
                <span class="text-slate-500" style="font-size: 0.7rem;">Activate real-time frame detection alerts</span>
              </div>
              <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="cameraDetectionMasterSwitch" v-model="cameraDetectionEnabled">
            </div>
          </div>

          <!-- Rest of Camera Detection sub-settings (gated by Enable Camera Detection switch) -->
          <div class="d-flex flex-column gap-3 transition-all"
               :style="{ opacity: cameraDetectionEnabled ? 1 : 0.4, pointerEvents: cameraDetectionEnabled ? 'auto' : 'none' }">

            <!-- Mode Toggle: AI vs Pixel Comparison -->
            <div class="p-3 bg-slate-800 rounded border border-slate-700">
              <label class="text-slate-300 small fw-bold text-uppercase mb-2 d-block">Detection Engine Mode</label>
              <span class="text-slate-500 d-block mb-3" style="font-size: 0.7rem;">Select whether to run YOLO neural network or cheap pixel differencing</span>
              <div class="d-flex gap-2">
                <button 
                  type="button"
                  :disabled="!cameraDetectionEnabled"
                  @click="cameraDetectionMode = 'AI'" 
                  :class="['btn flex-grow-1 py-2 fw-bold text-uppercase duration-btn', cameraDetectionMode === 'AI' ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                  style="font-size: 0.75rem;"
                >
                  <i class="bi bi-cpu me-1"></i>AI (YOLO)
                </button>
                <button 
                  type="button"
                  :disabled="!cameraDetectionEnabled"
                  @click="cameraDetectionMode = 'Pixel'" 
                  :class="['btn flex-grow-1 py-2 fw-bold text-uppercase duration-btn', cameraDetectionMode === 'Pixel' ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                  style="font-size: 0.75rem;"
                >
                  <i class="bi bi-image me-1"></i>Pixel Comparison
                </button>
              </div>
            </div>

            <!-- AI (YOLO) specific configs -->
            <div v-if="cameraDetectionMode === 'AI'" class="d-flex flex-column gap-3">
              
              <!-- Stream Camera AI Detection & Recording Box -->
              <div class="p-3 bg-slate-800 rounded border border-slate-700">
                <!-- Parent Switch: Detection -->
                <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
                  <div>
                    <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="aiStreamDetSwitch">
                      Stream Camera Detection
                    </label>
                    <span class="text-slate-500" style="font-size: 0.7rem;">Enables AI object detection on live stream frames</span>
                  </div>
                  <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="aiStreamDetSwitch" v-model="streamAiDetection" :disabled="!cameraDetectionEnabled">
                </div>

                <!-- Divider Line -->
                <hr v-if="streamAiDetection" style="border-color: #334155; opacity: 0.35; margin: 1rem 0;">

                <!-- Sub-setting Switch: Capture Stream Camera -->
                <div v-if="streamAiDetection" class="form-check form-switch d-flex justify-content-between align-items-center p-0 ms-3">
                  <div>
                    <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="aiStreamCaptureSwitch">
                      Capture Stream Camera
                    </label>
                    <span class="text-slate-500 d-block" style="font-size: 0.7rem;">Capture and save snapshot to gallery when human is detected</span>
                  </div>
                  <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="aiStreamCaptureSwitch" v-model="streamAiCaptureEnabled" :disabled="!cameraDetectionEnabled || !streamAiDetection">
                </div>

                <!-- Divider Line -->
                <hr v-if="streamAiDetection" style="border-color: #334155; opacity: 0.35; margin: 1rem 0;">

                <!-- Sub-setting Switch: Stream Camera Recording -->
                <div v-if="streamAiDetection" class="form-check form-switch d-flex justify-content-between align-items-center p-0 ms-3">
                  <div>
                    <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="aiStreamRecSwitch">
                      Stream Camera Recording
                    </label>
                    <span class="text-slate-500 d-block" style="font-size: 0.7rem;">Record video clip when human is detected on stream</span>
                  </div>
                  <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="aiStreamRecSwitch" v-model="streamAiRecordingSwitch" :disabled="!cameraDetectionEnabled || !streamAiDetection">
                </div>

              </div>

              <!-- PIR Sensor AI Detection & Recording Box -->
              <div class="p-3 bg-slate-800 rounded border border-slate-700">
                <!-- Parent Switch: Detection -->
                <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
                  <div>
                    <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="aiPirDetSwitch">
                      PIR Sensor AI Detection
                    </label>
                    <span class="text-slate-500" style="font-size: 0.7rem;">Enables AI object detection on PIR sensor events</span>
                  </div>
                  <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="aiPirDetSwitch" v-model="pirAiDetection" :disabled="!cameraDetectionEnabled">
                </div>

                <!-- Divider Line -->
                <hr v-if="pirAiDetection" style="border-color: #334155; opacity: 0.35; margin: 1rem 0;">

                <!-- Sub-setting Switch: Recording -->
                <div v-if="pirAiDetection" class="form-check form-switch d-flex justify-content-between align-items-center p-0 ms-3">
                  <div>
                    <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="aiPirRecSwitch">
                      PIR Sensor AI Recording
                    </label>
                    <span class="text-slate-500" style="font-size: 0.7rem;">Continuous recording as long as there is an object detected</span>
                  </div>
                  <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="aiPirRecSwitch" v-model="pirAiRecording" :disabled="!cameraDetectionEnabled || !pirAiDetection">
                </div>
              </div>

              <!-- AI Camera Object Tracking Switch -->
              <div class="p-3 bg-slate-800 rounded border border-slate-700">
                <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
                  <div>
                    <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="aiTrackingSwitch">
                      AI Camera Object Tracking
                    </label>
                    <span class="text-slate-500" style="font-size: 0.7rem;">Camera servo follows detected human objects</span>
                  </div>
                  <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="aiTrackingSwitch" v-model="objectTracking" :disabled="!cameraDetectionEnabled">
                </div>
              </div>

            </div>

            <!-- Pixel Comparison specific configs -->
            <div v-else class="d-flex flex-column gap-3">
              <div class="p-3 bg-slate-800 rounded border border-slate-700">
                <label class="text-slate-300 small fw-bold text-uppercase mb-3 d-block">Detection Tuner Parameters</label>

                <!-- Image Capture Switch -->
                <div class="form-check form-switch d-flex justify-content-between align-items-center p-0 mb-4 pb-3 border-bottom border-slate-700 border-opacity-50">
                  <div>
                    <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="pixelCaptureSwitch">
                      Capture Motion Image
                    </label>
                    <span class="text-slate-500 d-block" style="font-size: 0.6rem;">Capture and save snapshot to gallery when motion is detected</span>
                  </div>
                  <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="pixelCaptureSwitch" v-model="pixelMotionCaptureEnabled" :disabled="!cameraDetectionEnabled">
                </div>

                <!-- Capture Delay Slider (Child of Capture Motion Image) -->
                <div class="mb-4 pb-3 border-bottom border-slate-700 border-opacity-50 ms-3 transition-opacity" :class="{ 'opacity-50': !pixelMotionCaptureEnabled }">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="text-slate-300 small fw-bold text-uppercase">Capture Delay</label>
                    <span class="text-info font-monospace small fw-bold">{{ pixelMotionCaptureDelay }} ms</span>
                  </div>
                  <input type="range" class="form-range custom-slider" min="0" max="1000" step="50" v-model.number="pixelMotionCaptureDelay" :disabled="!cameraDetectionEnabled || !pixelMotionCaptureEnabled">
                  <span class="text-slate-500 d-block mt-1" style="font-size: 0.6rem;">Delay in milliseconds before capturing the snapshot image</span>
                </div>

                <!-- Record Motion Video Switch (Child of Capture Motion Image) -->
                <div class="form-check form-switch d-flex justify-content-between align-items-center p-0 mb-4 pb-3 border-bottom border-slate-700 border-opacity-50 ms-3 transition-opacity" :class="{ 'opacity-50': !pixelMotionCaptureEnabled }">
                  <div>
                    <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="pixelRecordSwitch">
                      Record Motion Video
                    </label>
                    <span class="text-slate-500 d-block" style="font-size: 0.6rem;">Record and save video clip when motion is detected</span>
                  </div>
                  <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="pixelRecordSwitch" v-model="pixelMotionRecordingEnabled" :disabled="!cameraDetectionEnabled || !pixelMotionCaptureEnabled">
                </div>
                
                <!-- Comparison Mode Selection -->
                <div class="mb-4">
                  <label class="text-slate-400 small d-block mb-2">Comparison Mode</label>
                  <div class="d-flex gap-2">
                    <button 
                      type="button"
                      :disabled="!cameraDetectionEnabled"
                      @click="pixelMotionMode = 0" 
                      :class="['btn flex-grow-1 py-2 fw-bold text-uppercase duration-btn', pixelMotionMode === 0 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                      style="font-size: 0.7rem;"
                    >
                      Static Reference
                    </button>
                    <button 
                      type="button"
                      :disabled="!cameraDetectionEnabled"
                      @click="pixelMotionMode = 1" 
                      :class="['btn flex-grow-1 py-2 fw-bold text-uppercase duration-btn', pixelMotionMode === 1 ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                      style="font-size: 0.7rem;"
                    >
                      Frame-to-Frame
                    </button>
                  </div>
                  <span class="text-slate-500 d-block mt-1" style="font-size: 0.6rem;">Static compares to background; F2F compares consecutive frames</span>
                </div>

                <!-- Static Reset Interval (Only for Static Reference Mode) -->
                <div v-if="pixelMotionMode === 0" class="mb-4">
                  <label class="text-slate-400 small d-block mb-2">Static Reset Interval</label>
                  <div class="d-flex gap-2">
                    <button 
                      v-for="val in [1, 2, 3]"
                      :key="val"
                      type="button"
                      :disabled="!cameraDetectionEnabled"
                      @click="pixelMotionResetInterval = val" 
                      :class="['btn flex-grow-1 py-2 fw-bold text-uppercase duration-btn', pixelMotionResetInterval === val ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                      style="font-size: 0.7rem;"
                    >
                      {{ val }} Sec
                    </button>
                  </div>
                  <span class="text-slate-500 d-block mt-1" style="font-size: 0.6rem;">Periodically rebuilds the static background reference after 1, 2, or 3 seconds to adapt to rapid lighting changes</span>
                </div>

                <!-- Motion Sensitivity Options -->
                <div class="mb-4">
                  <label class="text-slate-400 small d-block mb-2">Motion Sensitivity</label>
                  <div class="d-flex gap-2">
                    <button 
                      v-for="preset in [
                        { label: 'High', value: 10 },
                        { label: 'Medium', value: 20 },
                        { label: 'Low', value: 30 },
                        { label: 'Extra Low', value: 40 }
                      ]"
                      :key="preset.value"
                      type="button"
                      :disabled="!cameraDetectionEnabled"
                      @click="pixelMotionSensitivity = preset.value" 
                      :class="['btn flex-grow-1 py-2 fw-bold text-uppercase duration-btn', pixelMotionSensitivity === preset.value ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                      style="font-size: 0.7rem;"
                    >
                      {{ preset.label }}
                    </button>
                  </div>
                  <span class="text-slate-500 d-block mt-1" style="font-size: 0.6rem;">Higher sensitivity (lower threshold value) makes the detector more reactive to minor pixel changes</span>
                </div>





                <!-- Merge Boxes Switch -->
                <div class="form-check form-switch d-flex justify-content-between align-items-center p-0 mt-3 pt-3 border-top border-slate-700 border-opacity-50">
                  <div>
                    <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="pixelMergeSwitch">
                      Merge Bounding Boxes
                    </label>
                    <span class="text-slate-500 d-block" style="font-size: 0.6rem;">Combine all separate motion rectangles into a single outer box</span>
                  </div>
                  <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="pixelMergeSwitch" v-model="pixelMotionMerge" :disabled="!cameraDetectionEnabled">
                </div>

                <!-- Minimum Contour Size Slider (Child of Merge Bounding Boxes) -->
                <div v-if="pixelMotionMerge" class="mt-3 ps-3 border-start border-slate-700 border-2 ms-2 transition-all duration-300">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="text-slate-400 small">Min Contour Size</label>
                    <span class="text-info font-monospace small fw-bold">{{ pixelMotionMinSize }} px</span>
                  </div>
                  <input type="range" class="form-range custom-slider" min="2" max="150" step="1" v-model.number="pixelMotionMinSize" :disabled="!cameraDetectionEnabled">
                  <span class="text-slate-500 d-block mt-1" style="font-size: 0.6rem;">Minimum width or height of a motion block to trigger the combined merge box</span>
                </div>

                <!-- Clustering Distance Slider (Child of Merge Bounding Boxes) -->
                <div v-if="!pixelMotionMerge" class="mt-3 ps-3 border-start border-slate-700 border-2 ms-2 transition-all duration-300">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="text-slate-400 small">Clustering Distance</label>
                    <span class="text-info font-monospace small fw-bold">{{ pixelMotionClusterDist }} px</span>
                  </div>
                  <input type="range" class="form-range custom-slider" min="10" max="500" step="5" v-model.number="pixelMotionClusterDist" :disabled="!cameraDetectionEnabled">
                  <span class="text-slate-500 d-block mt-1" style="font-size: 0.6rem;">Distance threshold in pixels to group adjacent motion boxes</span>
                </div>

                <!-- Motion Tracking Switch -->
                <div class="form-check form-switch d-flex justify-content-between align-items-center p-0 mt-3 pt-3 border-top border-slate-700 border-opacity-50">
                  <div>
                    <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="pixelTrackingSwitch">
                      Motion Tracking
                    </label>
                    <span class="text-slate-500 d-block" style="font-size: 0.6rem;">Camera servo follows detected motion bounding boxes</span>
                  </div>
                  <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="pixelTrackingSwitch" v-model="objectTracking" :disabled="!cameraDetectionEnabled">
                </div>
              </div>
            </div>

            <!-- Video Recording Duration -->
            <div class="p-3 bg-slate-800 rounded border border-slate-700">
              <label class="text-slate-300 small fw-bold mb-2 text-uppercase d-block">Video Recording Duration</label>
              <span class="text-slate-500 d-block mb-3" style="font-size: 0.7rem;">Controls both AI Stream Recording and PIR Video Recording duration</span>
              <div class="d-flex gap-1 justify-content-between flex-wrap">
                <button 
                  v-for="dur in [10, 20, 30, 60, 'continuous']" 
                  :key="dur"
                  type="button"
                  :disabled="!cameraDetectionEnabled"
                  @click="updateRecordingDuration(dur)" 
                  :class="['btn p-2 fw-bold duration-btn flex-grow-1', getRecordingDurationActive(dur) ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                  style="font-size: 0.7rem; min-width: 50px;"
                >
                  {{ dur === 'continuous' ? 'Continuous' : `${dur}s` }}
                </button>
              </div>
            </div>

            <!-- Max Video Duration Compress -->
            <div class="p-3 bg-slate-800 rounded border border-slate-700">
              <label class="text-slate-300 small fw-bold mb-2 text-uppercase d-block">Max Video Duration Compress</label>
              <span class="text-slate-500 d-block mb-3" style="font-size: 0.7rem;">Compresses and speeds up output video if recording duration exceeds this limit</span>
              <div class="d-flex gap-2 justify-content-between">
                <button 
                  v-for="dur in [10, 20, 30]" 
                  :key="dur"
                  type="button"
                  :disabled="!cameraDetectionEnabled"
                  @click="maxDuration = dur" 
                  :class="['btn flex-grow-1 py-2 fw-bold text-uppercase duration-btn', maxDuration === dur ? 'btn-info text-dark shadow-info' : 'btn-outline-secondary text-slate-300']"
                  style="font-size: 0.75rem;"
                >
                  {{ getSecondsLabel(dur) }}
                </button>
              </div>
            </div>

          </div>

        </div>

        <!-- =================== TAB 4: OTHER SETTINGS =================== -->
        <div v-if="activeTab === 'other'" class="tab-pane-content d-flex flex-column gap-3">
          
          <!-- Web Alert Sound Switch -->
          <div class="p-3 bg-slate-800 rounded border border-slate-700">
            <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
              <div>
                <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="webSoundSwitch">
                  Kiosk Web Alert Sound
                </label>
                <span class="text-slate-500" style="font-size: 0.7rem;">Play alarm audio chime in browser on motion/AI detections</span>
              </div>
              <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="webSoundSwitch" v-model="webSoundEnabled">
            </div>
          </div>

          <!-- UDP Livestream Mode Switch -->
          <div class="p-3 bg-slate-800 rounded border border-slate-700">
            <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
              <div>
                <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="udpStreamSwitch">
                  UDP Livestream Mode
                </label>
                <span class="text-slate-500" style="font-size: 0.7rem;">Stream binary frames via UDP to port 3001 instead of WebSockets (reduces latency)</span>
              </div>
              <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="udpStreamSwitch" v-model="udpStreamEnabled">
            </div>
          </div>

          <!-- FPS Meter Toggle -->
          <div class="p-3 bg-slate-800 rounded border border-slate-700">
            <div class="form-check form-switch d-flex justify-content-between align-items-center p-0">
              <div>
                <label class="form-check-label text-slate-300 small fw-bold text-uppercase d-block" for="fpsMeterSwitch">
                  Show FPS Meter
                </label>
                <span class="text-slate-500" style="font-size: 0.7rem;">Display the real-time frame rate (FPS) overlay on video feeds</span>
              </div>
              <input class="form-check-input custom-switch m-0" type="checkbox" role="switch" id="fpsMeterSwitch" v-model="showFpsMeter">
            </div>
          </div>

        </div>

      </div>

      <!-- Modal Footer -->
      <div class="d-flex gap-2 mt-4">
        <button @click="saveConfig" class="btn btn-info text-dark flex-grow-1 py-2 fw-bold text-uppercase" style="font-size: 0.75rem;">
          Save Settings
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
.text-slate-400 { color: #94a3b8; }
.text-slate-500 { color: #64748b; }

/* Custom Switch Styling */
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
  background-color: #06b6d4;
  border-color: #0891b2;
}

/* Custom Slider Styling */
.custom-slider {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  background: #334155;
  border-radius: 3px;
  outline: none;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #06b6d4;
  border: 2px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.6);
}

.custom-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #06b6d4;
  border: 2px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.6);
}

/* Tab controls */
.nav-tabs-custom {
  gap: 1.5rem;
}
.tab-btn {
  background: none;
  border: none;
  outline: none;
  font-size: 0.8rem;
  letter-spacing: 0.5px;
  padding: 0;
  transition: all 0.2s ease;
  position: relative;
}
.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: #06b6d4;
}
.tab-btn:hover {
  opacity: 0.85;
}

/* Duration selection buttons */
.duration-btn {
  transition: all 0.2s ease;
  border-radius: 6px;
}
.shadow-info {
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.4);
}

/* Scrollable config body list */
.modal-body-custom {
  height: 380px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 6px;
}

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

.transition-all {
  transition: opacity 0.2s ease, pointer-events 0.2s ease;
}
</style>
