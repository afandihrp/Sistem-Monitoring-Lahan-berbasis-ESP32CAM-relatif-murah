<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CameraConfigurator from './CameraConfiguratorModal.vue'
import ServoConfigurator from './ServoConfiguratorModal.vue'

const { t } = useI18n()

const props = defineProps({
  mac: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

const activeTab = ref('camera')

// ----- State & WS Sync -----
const camConfig = ref({
  name: '',
  resolution: 'HVGA', quality: 22, scaleMode: 'static',
  dynRes5: 'HVGA', dynQual5: 22, dynRes4: 'HVGA', dynQual4: 22,
  dynRes3: 'HVGA', dynQual3: 22, dynRes2: 'HVGA', dynQual2: 22,
  dynRes1: 'HVGA', dynQual1: 22, brightness: 0, contrast: 0,
  saturation: 0, awb: true, aec: true, agc: true, hmirror: false,
  vflip: false, specialEffect: 'None', xclk: 8000000, flashOnCapture: true
})
const originalCamConfig = ref(null)

const servoConfig = ref({
  defaultAngle: 90, leftPirAngle: 45, middlePirAngle: 90,
  rightPirAngle: 155, returnToDefaultDuration: 15, sweepMode: 'disabled'
})
const originalServoConfig = ref(null)

const isLoadingConfig = ref(true)
const hasReceivedCam = ref(false)
const hasReceivedServo = ref(false)
const isSaving = ref(false)

const fetchCameraConfig = () => {
  if (!props.mac || props.mac === 'Unknown MAC') return
  window.dispatchEvent(new CustomEvent('request_camera_config', { detail: { mac: props.mac } }));
}
const fetchServoConfig = () => {
  if (!props.mac || props.mac === 'Unknown MAC') return
  window.dispatchEvent(new CustomEvent('request_servo_config', { detail: { mac: props.mac } }));
}

let fetchTimeoutTimer = null
let saveTimeoutTimer = null

const handleCloseModal = () => {
  if (fetchTimeoutTimer) clearTimeout(fetchTimeoutTimer)
  if (saveTimeoutTimer) clearTimeout(saveTimeoutTimer)
  emit('close')
}

const handleCameraConfigReceived = (event) => {
  const { mac, config } = event.detail;
  if (mac === props.mac) {
    if (config) {
      const validConfig = Object.fromEntries(Object.entries(config).filter(([_, v]) => v !== null && v !== undefined))
      Object.assign(camConfig.value, validConfig)
    }
    originalCamConfig.value = JSON.parse(JSON.stringify(camConfig.value));
    hasReceivedCam.value = true
    if (hasReceivedServo.value) {
      if (fetchTimeoutTimer) clearTimeout(fetchTimeoutTimer)
      isLoadingConfig.value = false
    }
  }
};
const handleServoConfigReceived = (event) => {
  const { mac, config } = event.detail;
  if (mac === props.mac) {
    if (config) {
      const validConfig = Object.fromEntries(Object.entries(config).filter(([_, v]) => v !== null && v !== undefined))
      Object.assign(servoConfig.value, validConfig)
    }
    originalServoConfig.value = JSON.parse(JSON.stringify(servoConfig.value));
    hasReceivedServo.value = true
    if (hasReceivedCam.value) {
      if (fetchTimeoutTimer) clearTimeout(fetchTimeoutTimer)
      isLoadingConfig.value = false
    }
  }
};

const handleSaveSuccess = (event) => {
  const { mac } = event.detail;
  if (mac === props.mac) {
    if (saveTimeoutTimer) clearTimeout(saveTimeoutTimer)
    isSaving.value = false
    emit('close')
  }
};

onMounted(() => {
  window.addEventListener('camera_config_received', handleCameraConfigReceived);
  window.addEventListener('servo_config_received', handleServoConfigReceived);
  window.addEventListener('save_camera_config_success', handleSaveSuccess);
  window.addEventListener('save_servo_config_success', handleSaveSuccess);
  fetchCameraConfig();
  fetchServoConfig();

  // 8-Second Fetching Timeout Guard
  fetchTimeoutTimer = setTimeout(() => {
    if (isLoadingConfig.value) {
      console.warn('[CameraSettingsModal] Fetching device parameters timed out after 8 seconds');
      isLoadingConfig.value = false;
    }
  }, 8000);
})

onUnmounted(() => {
  if (fetchTimeoutTimer) clearTimeout(fetchTimeoutTimer);
  if (saveTimeoutTimer) clearTimeout(saveTimeoutTimer);
  window.removeEventListener('camera_config_received', handleCameraConfigReceived);
  window.removeEventListener('servo_config_received', handleServoConfigReceived);
  window.removeEventListener('save_camera_config_success', handleSaveSuccess);
  window.removeEventListener('save_servo_config_success', handleSaveSuccess);
})

const handleSaveAll = () => {
  let camSaved = false
  let servoSaved = false
  
  if (originalCamConfig.value) {
    const changedCamConfig = {}
    for (const key in camConfig.value) {
      if (camConfig.value[key] !== originalCamConfig.value[key]) {
        console.log(`[CameraSettingsModal] camConfig key changed: ${key}. Old: ${originalCamConfig.value[key]}, New: ${camConfig.value[key]}`)
        changedCamConfig[key] = camConfig.value[key]
        camSaved = true
      }
    }
    if (camSaved) {
      window.dispatchEvent(new CustomEvent('save_camera_config', { detail: { mac: props.mac, config: changedCamConfig } }))
      originalCamConfig.value = JSON.parse(JSON.stringify(camConfig.value))
    }
  }

  if (originalServoConfig.value) {
    const changedServoConfig = {}
    for (const key in servoConfig.value) {
      if (servoConfig.value[key] !== originalServoConfig.value[key]) {
        console.log(`[CameraSettingsModal] servoConfig key changed: ${key}. Old: ${originalServoConfig.value[key]}, New: ${servoConfig.value[key]}`)
        changedServoConfig[key] = servoConfig.value[key]
        servoSaved = true
      }
    }
    if (servoSaved) {
      window.dispatchEvent(new CustomEvent('save_servo_config', { detail: { mac: props.mac, config: changedServoConfig } }))
      originalServoConfig.value = JSON.parse(JSON.stringify(servoConfig.value))
    }
  }
  
  if (!camSaved && !servoSaved) {
    alert('No settings were changed.')
    emit('close')
  } else {
    isSaving.value = true
    saveTimeoutTimer = setTimeout(() => {
      if (isSaving.value) {
        console.warn('[CameraSettingsModal] Saving parameters timed out after 8 seconds');
        isSaving.value = false;
        alert('Save request timed out (8 seconds). Please verify connection.');
      }
    }, 8000);
  }
}


</script>

<template>
  <div class="modal-overlay d-flex align-items-center justify-content-center p-3">
    <div class="modal-content-custom bg-slate-900 border border-slate-700 rounded-3 shadow-lg d-flex flex-column">
      
      <!-- Modal Header & Tabs -->
      <div class="p-3 pb-0 border-bottom border-slate-700 flex-shrink-0">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="text-white mb-0 text-uppercase fw-bold" style="letter-spacing: 1px;">
            <i class="bi bi-camera me-2 text-info"></i>{{ t('cameraConfig.title') || 'Camera Settings' }}
          </h6>
          <button @click="handleCloseModal" class="btn-close btn-close-white shadow-none"></button>
        </div>
        
        <ul class="nav nav-tabs custom-tabs border-0">
          <li class="nav-item">
            <button 
              class="nav-link text-uppercase fw-bold pb-2 px-3" 
              :class="{ 'active': activeTab === 'camera' }"
              @click="activeTab = 'camera'">
              <i class="bi bi-sliders me-1"></i> Hardware
            </button>
          </li>
          <li class="nav-item">
            <button 
              class="nav-link text-uppercase fw-bold pb-2 px-3" 
              :class="{ 'active': activeTab === 'servo' }"
              @click="activeTab = 'servo'">
              <i class="bi bi-gear-wide-connected me-1"></i> PTZ & Sweep
            </button>
          </li>
        </ul>
      </div>

      <!-- Tab Content Area -->
      <div class="flex-grow-1 overflow-hidden position-relative bg-slate-900" style="min-height: 250px;">
        <!-- Loading Overlay -->
        <div v-if="isLoadingConfig" class="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-slate-900 bg-opacity-95" style="z-index: 100;">
          <div class="spinner-border text-info mb-2" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <span class="text-slate-400 small font-monospace text-uppercase" style="letter-spacing: 1px;">Fetching device parameters...</span>
        </div>

        <!-- Saving Overlay -->
        <div v-if="isSaving" class="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-slate-900 bg-opacity-95" style="z-index: 100;">
          <div class="spinner-border text-info mb-2" role="status">
            <span class="visually-hidden">Saving...</span>
          </div>
          <span class="text-slate-400 small font-monospace text-uppercase" style="letter-spacing: 1px;">Saving parameters to camera...</span>
        </div>

        <!-- We use v-if because the child state is hoisted and d-flex overrides v-show -->
        <Transition name="fade">
          <CameraConfigurator 
            v-if="activeTab === 'camera'" 
            class="position-absolute top-0 start-0 w-100 h-100 p-3 pb-0"
            :mac="props.mac" 
            v-model="camConfig"
          />
        </Transition>
        <Transition name="fade">
          <ServoConfigurator 
            v-if="activeTab === 'servo'" 
            class="position-absolute top-0 start-0 w-100 h-100 p-3 pb-0"
            :mac="props.mac" 
            v-model="servoConfig"
          />
        </Transition>
      </div>

      <!-- Unified Save Button -->
      <div class="p-3 bg-slate-900 border-top border-slate-700 rounded-bottom-3 flex-shrink-0">
        <button @click="handleSaveAll" :disabled="isLoadingConfig || isSaving" class="btn btn-primary w-100 py-2 fw-bold text-uppercase" style="font-size: 0.8rem; letter-spacing: 1px;">
          <i class="bi bi-cloud-upload me-2"></i> {{ t('cameraConfig.save') || 'Save Settings' }}
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
  max-width: 500px;
  width: 100%;
  height: 85vh;
}

@media (max-width: 576px) {
  .modal-overlay {
    align-items: flex-start !important;
    padding-top: 60px !important;
    padding-bottom: 30px !important;
  }
  .modal-content-custom {
    height: 75vh;
  }
}

@keyframes modalScale {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.bg-slate-900 { background-color: #0f172a; }

/* Custom Tabs Styling */
.custom-tabs {
  gap: 0.5rem;
}
.custom-tabs .nav-link {
  color: #64748b;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  font-size: 0.8rem;
  transition: all 0.2s ease;
}
.custom-tabs .nav-link:hover {
  color: #94a3b8;
  border-bottom-color: #334155;
}
.custom-tabs .nav-link.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background: transparent;
  text-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
}

.text-info {
  color: #3b82f6 !important;
}

/* Fade Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
