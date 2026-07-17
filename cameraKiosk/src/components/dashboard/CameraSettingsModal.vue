<script setup>
import { ref } from 'vue'
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

const emit = defineEmits(['close', 'saveCameraConfig', 'saveServoConfig'])

const activeTab = ref('camera')

const handleSaveCamera = (config) => {
  emit('saveCameraConfig', config)
}

const handleSaveServo = (config) => {
  emit('saveServoConfig', config)
}
</script>

<template>
  <div class="modal-overlay d-flex align-items-center justify-content-center p-3">
    <div class="modal-content-custom bg-slate-900 border border-slate-700 rounded-3 shadow-lg d-flex flex-column" style="max-width: 500px; width: 100%; height: 90vh;">
      
      <!-- Modal Header & Tabs -->
      <div class="p-3 pb-0 border-bottom border-slate-700 flex-shrink-0">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="text-white mb-0 text-uppercase fw-bold" style="letter-spacing: 1px;">
            <i class="bi bi-camera me-2 text-info"></i>{{ t('cameraConfig.title') || 'Camera Settings' }}
          </h6>
          <button @click="emit('close')" class="btn-close btn-close-white shadow-none"></button>
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
      <div class="flex-grow-1 overflow-hidden p-3 bg-slate-900 rounded-bottom-3 position-relative">
        <!-- Transition wrapper for smooth tab switching -->
        <Transition name="fade" mode="out-in">
          <!-- Keep alive ensures we don't lose the local state in the configurator components while switching tabs -->
          <KeepAlive>
            <CameraConfigurator 
              v-if="activeTab === 'camera'" 
              :mac="props.mac" 
              @save="handleSaveCamera" 
            />
            <ServoConfigurator 
              v-else-if="activeTab === 'servo'" 
              :mac="props.mac" 
              @save="handleSaveServo" 
            />
          </KeepAlive>
        </Transition>
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
  color: #0dcaf0;
  border-bottom-color: #0dcaf0;
  background: transparent;
  text-shadow: 0 0 8px rgba(13, 202, 240, 0.4);
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
