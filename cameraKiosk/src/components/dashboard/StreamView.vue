<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import CameraSettingsModal from './CameraSettingsModal.vue'
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
  isForceMobile: {
    type: Boolean,
    default: false
  },
  viewMode: {
    type: String,
    default: 'single'
  },
  aiEnabled: {
    type: Boolean,
    default: true
  },
  systemConfig: {
    type: Object,
    default: () => ({
      pirEnabled: true,
      pirCooldown: 30,
      pirRecordVideo: true,
      pirRecordDuration: 10,
      telegramAlertPir: true,
      telegramAlertAi: true,
      telegramAlertMotion: false,
      cameraDetectionMode: 'AI',
      streamAiDetection: true,
      streamAiCaptureEnabled: true,
      objectTracking: true,
      pixelMotionSensitivity: 10,
      pixelMotionMode: 0,
      pixelMotionMerge: false,
      pixelMotionResetInterval: 1,
      pixelMotionClusterDist: 50,
      pixelMotionMinSize: 10,
      pixelMotionCaptureEnabled: true,
      webSoundEnabled: true,
      // AI defaults consolidated
      pirAiDetection: true,
      pirAiRecording: true,
      streamAiRecording: 'continuous',
      streamAiTelegram: true,
      telegramInterval: 10,
      maxDuration: 30
    })
  }
})

const emit = defineEmits(['triggerCameraAction', 'triggerServoAction', 'setViewMode', 'setAiEnabled', 'saveSystemConfig', 'triggerSweepAction', 'setActiveStream'])
const servoValue = ref(90)
const localSweepMode = ref('off')

const selectActiveStream = (deviceId) => {
  emit('setActiveStream', deviceId)
}

// Sync manual slider ref with backend-synced currentAngle
watch(() => props.currentStream?.currentAngle, (newAngle) => {
  if (newAngle !== undefined && newAngle !== null) {
    servoValue.value = newAngle
  }
}, { immediate: true })

// Sync sweep status from backend
watch(() => props.currentStream?.sweepActive, (newVal) => {
  localSweepMode.value = newVal || 'off'
}, { immediate: true })

const startContinuousSweep = () => {
  const nextMode = localSweepMode.value === 'continuous' ? 'off' : 'continuous'
  localSweepMode.value = nextMode
  emit('triggerSweepAction', nextMode)
}

const triggerSingleSweep = () => {
  localSweepMode.value = 'once'
  emit('triggerSweepAction', 'once')
}

const isSimulating = ref(null) // null, 'left', 'right'
let simulationInterval = null

const stopSimulation = () => {
  if (simulationInterval) {
    clearInterval(simulationInterval)
    simulationInterval = null
  }
  isSimulating.value = null
}

const startHoldSimulation = (direction) => {
  stopSimulation()
  isSimulating.value = direction

  const step = () => {
    let nextAngle = parseInt(servoValue.value)
    if (direction === 'left') {
      nextAngle = Math.max(0, nextAngle - 10)
    } else {
      nextAngle = Math.min(180, nextAngle + 10)
    }

    if (nextAngle !== parseInt(servoValue.value)) {
      servoValue.value = nextAngle
      emit('triggerServoAction', nextAngle)
    }

    if (nextAngle === 0 || nextAngle === 180) {
      stopSimulation()
    }
  }

  step()
  if (isSimulating.value) {
    simulationInterval = setInterval(step, 500)
  }
}

onUnmounted(() => {
  stopSimulation()
})

const showCameraSettings = ref(false)
const configDeviceMac = ref('')

const onlineDevices = computed(() => props.devices.filter(d => d.status === 'Online' && d.type === 'Camera'))

const gridClass = computed(() => {
  const count = onlineDevices.value.length;
  if (count <= 1) return 'grid-container devices-1';
  if (count === 2) return 'grid-container devices-2';
  if (count <= 4) return 'grid-container devices-3-4';
  if (count <= 6) return 'grid-container devices-5-6';
  if (count <= 9) return 'grid-container devices-7-9';
  return 'grid-container devices-more';
})

const openCameraSettings = (mac) => {
  configDeviceMac.value = mac
  showCameraSettings.value = true
}

const getNominalDbm = (bars) => {
  const mapping = {
    5: -25,
    4: -35,
    3: -45,
    2: -55,
    1: -65
  };
  return mapping[bars] || 'N/A';
}
</script>

<template>
  <div :class="['stream-view-wrapper', 'd-flex', 'flex-column', 'col-lg-10', 'p-0', { 'force-mobile': isForceMobile }]">
    <!-- KIRI: Primary Stream View -->
    <section class="stream-section bg-black position-relative flex-grow-1">
      <!-- Header Stream (Absolute agar video bisa full edge-to-edge) -->
      <div class="position-absolute top-0 start-0 w-100 p-3 d-flex justify-content-between align-items-center z-2">
        <span v-if="currentStream.status !== 'Online' && viewMode !== 'multiple'" class="badge rounded-pill bg-secondary text-white border border-secondary border-opacity-25 d-flex align-items-center gap-2 px-2 py-1" style="font-size: 0.7rem; letter-spacing: 0.5px;">
          <i class="bi bi-camera-video-off-fill" style="font-size: 0.7rem;"></i>
          {{ $t('stream.offline') }}
        </span>
        
        <div v-if="viewMode !== 'multiple'" class="d-flex align-items-center gap-2 gap-sm-3 ms-auto">
          <div class="d-flex align-items-center gap-2">
            <span class="text-white fw-bold font-monospace text-uppercase ip-label" style="text-shadow: 1px 1px 2px black; font-size: 0.8rem;">
              {{ currentStream.name || ('Cam ' + (props.devices.filter(d => d.type === 'Camera').findIndex(c => c.id === currentStream.id) + 1)) }}
            </span>
            <div v-if="currentStream.status === 'Online'" class="d-flex align-items-center gap-2" style="height: 16px;">
              <div class="d-flex align-items-end gap-1 signal-bars-wrapper" style="height: 12px;" :title="`Signal Strength: ${currentStream.signalBars || 0}/5`">
                <div v-for="bar in 5" :key="bar" 
                     :style="{ 
                       width: '2px', 
                       height: (bar * 20) + '%', 
                       backgroundColor: (currentStream.signalBars || 0) >= bar ? '#22c55e' : '#64748b',
                       boxShadow: (currentStream.signalBars || 0) >= bar ? '0 0 6px rgba(34, 197, 94, 0.6)' : 'none',
                       borderRadius: '1px'
                     }">
                </div>
              </div>
            </div>
          </div>
          <!-- Camera Settings Configurator Button next to IP -->
          <button v-if="currentStream.mac && currentStream.mac !== 'Unknown MAC'"
                  @click.stop="openCameraSettings(currentStream.mac)" 
                  class="btn btn-sm btn-link p-0 text-slate-400 hover-info"
                  title="Configure Camera Settings">
            <i class="bi bi-sliders text-white" style="font-size: 0.85rem; text-shadow: 1px 1px 2px black;"></i>
          </button>
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
            :detectionMode="systemConfig.cameraDetectionMode"
            :showFpsMeter="systemConfig.showFpsMeter"
          />
          
          <!-- Overlay Left/Right Navigation Buttons (Single View) -->
          <button @click="emit('triggerCameraAction', 'left')" 
                  class="btn position-absolute start-0 top-50 translate-middle-y z-3 nav-overlay-btn btn-left" 
                  title="Previous Camera">
            &lt;
          </button>
          <button @click="emit('triggerCameraAction', 'right')" 
                  class="btn position-absolute end-0 top-50 translate-middle-y z-3 nav-overlay-btn btn-right" 
                  title="Next Camera">
            &gt;
          </button>
          <!-- Offline Overlay -->
          <div v-if="currentStream.status !== 'Online'" 
               class="position-absolute top-50 start-50 translate-middle d-flex flex-column align-items-center text-secondary opacity-50">
            <i class="bi bi-camera-video-off" style="font-size: 6rem;"></i>
            <div class="fw-bold text-uppercase mt-2" style="letter-spacing: 4px; font-size: 0.8rem;">{{ $t('stream.cameraOffline') }}</div>
          </div>
        </template>

        <!-- MULTIPLE VIEW (GRID) -->
        <template v-else>
          <div :class="gridClass">
            <div v-for="device in onlineDevices" 
                 :key="device.id" 
                 @click="selectActiveStream(device.id)"
                 :class="['grid-item', 'bg-black', 'position-relative']">
              
              <!-- Premium Custom Radio Selector -->
              <div class="position-absolute top-0 start-0 p-3 z-3 select-indicator-container">
                <div :class="['select-radio-btn', { 'selected': device.id === currentStream.id }]">
                  <div class="select-radio-inner"></div>
                </div>
              </div>

              <!-- Grid Header -->
              <div class="position-absolute top-0 start-0 w-100 p-3 d-flex justify-content-end align-items-center z-2">
                <div class="d-flex align-items-center gap-2 gap-sm-3">
                  <div class="d-flex align-items-center gap-2">
                    <span class="text-white fw-bold font-monospace text-uppercase ip-label" style="text-shadow: 1px 1px 2px black; font-size: 0.8rem;">
                      {{ device.name || ('Cam ' + (props.devices.filter(d => d.type === 'Camera').findIndex(c => c.id === device.id) + 1)) }}
                    </span>
                    <div v-if="device.status === 'Online'" class="d-flex align-items-center gap-2" style="height: 16px;">
                      <div class="d-flex align-items-end gap-1 signal-bars-wrapper" style="height: 12px;" :title="`Signal Strength: ${device.signalBars || 0}/5`">
                        <div v-for="bar in 5" :key="bar" 
                             :style="{ 
                               width: '2px', 
                               height: (bar * 20) + '%', 
                               backgroundColor: (device.signalBars || 0) >= bar ? '#22c55e' : '#64748b',
                               boxShadow: (device.signalBars || 0) >= bar ? '0 0 6px rgba(34, 197, 94, 0.6)' : 'none',
                               borderRadius: '1px'
                             }">
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Camera Settings Configurator Button next to IP -->
                  <button v-if="device.mac && device.mac !== 'Unknown MAC'"
                          @click.stop="openCameraSettings(device.mac)" 
                          class="btn btn-sm btn-link p-0 text-slate-400 hover-info"
                          title="Configure Camera Settings">
                    <i class="bi bi-sliders text-white" style="font-size: 0.85rem; text-shadow: 1px 1px 2px black;"></i>
                  </button>
                </div>
              </div>

              <!-- Camera Feed Area -->
              <div class="w-100 h-100 d-flex align-items-center justify-content-center position-relative">
                <CameraFeed
                  :deviceId="device.id"
                  :imageSrc="cameraImages[device.id]"
                  :boxes="cameraBoxes[device.id]"
                  :aiEnabled="aiEnabled"
                  :detectionMode="systemConfig.cameraDetectionMode"
                  :showFpsMeter="systemConfig.showFpsMeter"
                />
              </div>
            </div>
            
            <!-- Empty State -->
            <div v-if="onlineDevices.length === 0" class="position-absolute top-50 start-50 translate-middle text-secondary opacity-50 d-flex flex-column align-items-center">
              <i class="bi bi-camera-video-off" style="font-size: 6rem;"></i>
              <div class="fw-bold text-uppercase mt-2" style="letter-spacing: 4px; font-size: 0.8rem;">{{ $t('stream.noOnlineCameras') }}</div>
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- CONTROLS PANEL: Strictly visible on mobile viewports (<1000px) -->
    <div v-if="windowWidth <= 1000" class="controls-panel bg-slate-800 border-bottom border-slate-700 p-3">
      <div class="d-flex flex-column gap-4">
        <!-- Servo Controls (PTZ Slider, Always visible on mobile panel) -->
        <div class="d-flex flex-column gap-2">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <label class="text-secondary small fw-bold text-uppercase mb-0" style="font-size: 0.65rem;">{{ $t('stream.servoPtz') }}</label>
              <button @click="triggerSingleSweep" 
                      :disabled="localSweepMode !== 'off'"
                      :class="['btn py-1 px-3 fw-bold text-uppercase font-monospace d-flex align-items-center gap-1', localSweepMode === 'once' ? 'btn-danger shadow-danger-btn' : 'btn-outline-info text-info']"
                      style="font-size: 0.75rem; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.3);">
                <i class="bi bi-play-fill" style="font-size: 0.8rem;"></i>
                {{ $t('stream.sweepOnce') }}
              </button>
              <span class="badge bg-slate-900 border border-slate-700 text-info font-monospace animate-pulse-custom animate-pulse" v-if="localSweepMode !== 'off'" style="font-size: 0.65rem; border-radius: 4px; border: 1px solid rgba(220, 53, 69, 0.3);">
                {{ $t('stream.sweeping') }}
              </span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-slate-900 border border-slate-700 text-info font-monospace" style="font-size: 0.8rem; min-width: 50px;">
                {{ servoValue }}°
              </span>
            </div>
          </div>
          <div class="position-relative py-2">
            <!-- Simulated Slider Mode: Hold-to-move Step Buttons -->
            <div v-if="systemConfig.simulatedSliderEnabled" class="d-flex align-items-center gap-2 py-1 justify-content-center">
              <button @mousedown="startHoldSimulation('left')"
                      @touchstart.passive="startHoldSimulation('left')"
                      @mouseup="stopSimulation"
                      @mouseleave="stopSimulation"
                      @touchend="stopSimulation"
                      :class="['btn btn-outline-info flex-grow-1 py-2 fw-bold text-uppercase d-flex align-items-center justify-content-center gap-2 prevent-select', { 'btn-info text-dark shadow-info': isSimulating === 'left' }]">
                <i class="bi bi-chevron-double-left" style="font-size: 1rem;"></i>
                Hold Left
              </button>
              <button @mousedown="startHoldSimulation('right')"
                      @touchstart.passive="startHoldSimulation('right')"
                      @mouseup="stopSimulation"
                      @mouseleave="stopSimulation"
                      @touchend="stopSimulation"
                      :class="['btn btn-outline-info flex-grow-1 py-2 fw-bold text-uppercase d-flex align-items-center justify-content-center gap-2 prevent-select', { 'btn-info text-dark shadow-info': isSimulating === 'right' }]">
                Hold Right
                <i class="bi bi-chevron-double-right" style="font-size: 1rem;"></i>
              </button>
            </div>

            <!-- Standard Slider Mode -->
            <input v-else
                   type="range" 
                   class="form-range custom-slider" 
                   min="0" max="180" step="1"
                   v-model="servoValue"
                   @change="emit('triggerServoAction', servoValue)">
            
            <div v-if="!systemConfig.simulatedSliderEnabled" class="d-flex justify-content-between mt-1 px-1 text-slate-500" style="font-size: 0.65rem;">
              <span>0°</span>
              <span>90°</span>
              <span>180°</span>
            </div>
            
          </div>
        </div>
      </div>
    </div>

    <CameraSettingsModal
      v-if="showCameraSettings"
      :mac="configDeviceMac"
      @close="showCameraSettings = false"
    />
  </div>
</template>

<style scoped>
.font-monospace { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }
.object-fit-contain { object-fit: contain; }

/* High-Visibility Custom Slider (for PTZ manual control) */
.custom-slider {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 20px;
  background: #334155;
  border-radius: 10px;
  outline: none;
  margin: 10px 0;
}

.custom-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 20px;
  background: #334155;
  border-radius: 10px;
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
  margin-top: -4px;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
}

.custom-slider::-moz-range-track {
  width: 100%;
  height: 20px;
  background: #334155;
  border-radius: 10px;
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
  padding: 0;
  gap: 0;
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
.grid-container.devices-5-6 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
}
.grid-container.devices-7-9 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
}
.grid-container.devices-more {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  grid-auto-rows: 1fr;
}

@media (max-width: 799px) {
  .grid-container.devices-5-6,
  .grid-container.devices-7-9,
  .grid-container.devices-more {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: none;
    grid-auto-rows: 1fr;
  }
}

.grid-item {
  position: relative;
  overflow: hidden;
  border: 1px solid #1e293b;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease;
}



.select-radio-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(15, 23, 42, 0.6);
  transition: border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s ease;
}
.select-radio-btn.selected {
  border-color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.15);
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
}
.select-radio-inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: transparent;
  transform: scale(0);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.25s ease;
}
.select-radio-btn.selected .select-radio-inner {
  background-color: #3b82f6;
  transform: scale(1);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.8);
}

.prevent-select {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* --- DESKTOP --- */
@media (min-width: 1001px) {
  .stream-view-wrapper:not(.force-mobile) .stream-section {
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
    height: auto !important;
    aspect-ratio: 4/3;
    min-height: 350px;
    max-height: 75vh;
    position: sticky;
    top: 0px;
    z-index: 1020;
    border-bottom: 2px solid #1e293b;
  }
}

/* --- FORCE MOBILE OVERRIDES --- */
.stream-view-wrapper.force-mobile {
  width: 100% !important;
  flex: none !important;
  max-width: 100% !important;
}
.stream-view-wrapper.force-mobile .stream-section {
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 4/3;
  min-height: 350px;
  max-height: 75vh;
  position: sticky;
  top: 0px;
  z-index: 1020;
  border-bottom: 2px solid #1e293b;
}

/* Premium AI Cog Button styling & Micro-animations */
.ai-cog-btn {
  opacity: 0.7;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.ai-cog-btn:hover {
  opacity: 1;
  transform: rotate(45deg);
}

.shadow-danger-btn {
  box-shadow: 0 0 10px rgba(220, 53, 69, 0.4);
}
@keyframes pulseCustom {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.animate-pulse-custom {
  animation: pulseCustom 1.5s infinite;
}

/* Slim Overlay Navigation Buttons styling */
.nav-overlay-btn {
  background: rgba(15, 23, 42, 0.15);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 2px solid rgba(255, 255, 255, 0.45);
  color: rgba(255, 255, 255, 0.85);
  width: 36px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  font-weight: bold;
  transition: all 0.2s ease;
  border-radius: 0;
  padding: 0;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.4);
}
.nav-overlay-btn:hover {
  background: rgba(15, 23, 42, 0.45);
  color: #0ea5e9;
  border-color: #0ea5e9;
  box-shadow: 0 0 15px rgba(14, 165, 233, 0.4);
}
.nav-overlay-btn.btn-left {
  border-top-right-radius: 10px;
  border-bottom-right-radius: 10px;
  border-left: none;
}
.nav-overlay-btn.btn-right {
  border-top-left-radius: 10px;
  border-bottom-left-radius: 10px;
  border-right: none;
}

.ip-label {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.8) !important;
}

.hover-info i {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.95));
}

.signal-bars-wrapper {
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.95)) !important;
}

/* Custom Blue PTZ & Sweep button styling overrides */
.btn-outline-info {
  color: #3b82f6 !important;
  border-color: #3b82f6 !important;
}
.btn-outline-info:hover, 
.btn-outline-info:active, 
.btn-outline-info:focus {
  background-color: #3b82f6 !important;
  color: #ffffff !important;
  border-color: #3b82f6 !important;
}

.btn-info {
  background-color: #3b82f6 !important;
  color: #ffffff !important;
  border-color: #3b82f6 !important;
}
.btn-info:hover {
  background-color: #2563eb !important;
  border-color: #2563eb !important;
}

.text-info {
  color: #3b82f6 !important;
}
</style>
