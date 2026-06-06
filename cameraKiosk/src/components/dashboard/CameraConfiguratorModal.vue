<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  mac: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close', 'save'])

const camConfig = ref({
  resolution: 'HVGA',
  quality: 12,
  scaleMode: 'static',
  dynRes5: 'UXGA',
  dynQual5: 10,
  dynRes4: 'SVGA',
  dynQual4: 12,
  dynRes3: 'VGA',
  dynQual3: 15,
  dynRes2: 'HVGA',
  dynQual2: 20,
  dynRes1: 'QVGA',
  dynQual1: 25,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  awb: true,
  aec: true,
  agc: true,
  hmirror: false,
  vflip: false,
  specialEffect: 'None',
  xclk: 8000000,
  flashOnCapture: true
})

const xclkMHz = computed({
  get: () => Math.round(camConfig.value.xclk / 1000000),
  set: (val) => {
    camConfig.value.xclk = val * 1000000
  }
})

const fetchCameraConfig = () => {
  if (!props.mac || props.mac === 'Unknown MAC') return
  window.dispatchEvent(new CustomEvent('request_camera_config', { 
    detail: { mac: props.mac } 
  }));
}

const handleConfigReceived = (event) => {
  const { mac, config } = event.detail;
  if (mac === props.mac && config) {
    camConfig.value = {
      resolution: config.resolution ?? 'HVGA',
      quality: config.quality ?? 12,
      scaleMode: config.scaleMode ?? 'static',
      dynRes5: config.dynRes5 ?? 'UXGA',
      dynQual5: config.dynQual5 ?? 10,
      dynRes4: config.dynRes4 ?? 'SVGA',
      dynQual4: config.dynQual4 ?? 12,
      dynRes3: config.dynRes3 ?? 'VGA',
      dynQual3: config.dynQual3 ?? 15,
      dynRes2: config.dynRes2 ?? 'HVGA',
      dynQual2: config.dynQual2 ?? 20,
      dynRes1: config.dynRes1 ?? 'QVGA',
      dynQual1: config.dynQual1 ?? 25,
      brightness: config.brightness ?? 0,
      contrast: config.contrast ?? 0,
      saturation: config.saturation ?? 0,
      awb: config.awb ?? true,
      aec: config.aec ?? true,
      agc: config.agc ?? true,
      hmirror: config.hmirror ?? false,
      vflip: config.vflip ?? false,
      specialEffect: config.specialEffect ?? 'None',
      xclk: config.xclk ?? 8000000,
      flashOnCapture: config.flashOnCapture ?? true
    };
    console.log('Loaded saved camera config via WS for:', mac);
  }
};

onMounted(() => {
  window.addEventListener('camera_config_received', handleConfigReceived);
  fetchCameraConfig();
})

onUnmounted(() => {
  window.removeEventListener('camera_config_received', handleConfigReceived);
})

const getSignalDbText = (bar) => {
  const dbmMap = {
    5: '-50 dBm (Excellent)',
    4: '-60 dBm (Good)',
    3: '-70 dBm (Fair)',
    2: '-80 dBm (Weak)',
    1: '-90 dBm (Very Weak)'
  };
  return dbmMap[bar];
}

const saveConfig = () => {
  emit('save', camConfig.value)
}
</script>

<template>
  <div class="modal-overlay d-flex align-items-center justify-content-center p-3">
    <div class="modal-content-custom bg-slate-900 border border-slate-700 rounded-3 shadow-lg p-4" style="max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto;">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h6 class="text-white mb-0 text-uppercase fw-bold" style="letter-spacing: 1px;">
          <i class="bi bi-sliders me-2 text-info"></i>Camera Configuration
        </h6>
        <button @click="emit('close')" class="btn-close btn-close-white shadow-none"></button>
      </div>

      <div class="d-flex flex-column gap-3">
        <!-- Sensor Type Banner -->
        <div class="p-2 bg-slate-800 rounded border border-slate-700 text-center">
          <span class="text-slate-400 small fw-bold font-monospace">TARGET SENSOR: AI-THINKER OV2640 / OV3660</span>
        </div>

        <!-- Format & Quality -->
        <div class="p-3 bg-slate-800 rounded-2 border border-slate-700">
          <label class="text-slate-300 small fw-bold mb-3 d-block text-uppercase">Resolution & Quality</label>
          
          <div class="mb-3">
            <label class="text-slate-400 small mb-1">Scale Mode</label>
            <select v-model="camConfig.scaleMode" class="form-select bg-slate-900 border-slate-700 text-white small">
              <option value="static">Static (Single Configuration)</option>
              <option value="dynamic">Dynamic (Signal Strength Based)</option>
            </select>
          </div>

          <!-- Static Mode Options -->
          <div v-if="camConfig.scaleMode === 'static'" class="row g-3">
            <div class="col-6">
              <label class="text-slate-400 small mb-1">Resolution</label>
              <select v-model="camConfig.resolution" class="form-select bg-slate-900 border-slate-700 text-white font-monospace small">
                <option value="UXGA">UXGA (1600x1200)</option>
                <option value="SVGA">SVGA (800x600)</option>
                <option value="VGA">VGA (640x480)</option>
                <option value="HVGA">HVGA (480x320)</option>
                <option value="QVGA">QVGA (320x240)</option>
              </select>
            </div>
            <div class="col-6">
              <label class="text-slate-400 small mb-1 d-flex justify-content-between">
                Quality <span>{{ camConfig.quality }}</span>
              </label>
              <input type="range" class="form-range custom-slider mt-2" min="0" max="63" v-model.number="camConfig.quality">
            </div>
          </div>

          <!-- Dynamic Mode Options (Nested inside the same container box) -->
          <div v-else class="d-flex flex-column gap-3 mt-3 pt-3 border-top border-slate-700 border-opacity-50">
            <label class="text-slate-300 small fw-bold mb-0 text-uppercase" style="font-size: 0.7rem; letter-spacing: 0.5px;">Bandwidth Scaling Options</label>
            <div class="d-flex flex-column gap-3">
              <div v-for="bar in [5, 4, 3, 2, 1]" :key="bar" class="p-3 bg-slate-900 rounded border border-slate-700">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <span class="small fw-bold text-slate-300 text-uppercase" style="letter-spacing: 0.5px;">
                    <i class="bi bi-reception-4 text-success me-1" v-if="bar >= 4"></i>
                    <i class="bi bi-reception-2 text-warning me-1" v-else-if="bar >= 2"></i>
                    <i class="bi bi-reception-1 text-danger me-1" v-else></i>
                    {{ getSignalDbText(bar) }}
                  </span>
                </div>
                <div class="row g-3">
                  <div class="col-6">
                    <label class="text-slate-400 small mb-1">Resolution</label>
                    <select v-model="camConfig['dynRes' + bar]" class="form-select bg-slate-900 border-slate-700 text-white font-monospace small">
                      <option value="UXGA">UXGA (1600x1200)</option>
                      <option value="SVGA">SVGA (800x600)</option>
                      <option value="VGA">VGA (640x480)</option>
                      <option value="HVGA">HVGA (480x320)</option>
                      <option value="QVGA">QVGA (320x240)</option>
                    </select>
                  </div>
                  <div class="col-6">
                    <label class="text-slate-400 small mb-1 d-flex justify-content-between">
                      Quality <span>{{ camConfig['dynQual' + bar] }}</span>
                    </label>
                    <input type="range" class="form-range custom-slider mt-2" min="0" max="63" v-model.number="camConfig['dynQual' + bar]">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Image Tuning (Sliders) -->
        <div class="p-3 bg-slate-800 rounded-2 border border-slate-700">
          <label class="text-slate-300 small fw-bold mb-3 d-block text-uppercase">Image Tuning</label>
          
          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <label class="text-slate-400 small">Brightness</label>
              <span class="text-info font-monospace small">{{ camConfig.brightness > 0 ? '+' : '' }}{{ camConfig.brightness }}</span>
            </div>
            <input type="range" class="form-range custom-slider" min="-2" max="2" v-model.number="camConfig.brightness">
          </div>

          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <label class="text-slate-400 small">Contrast</label>
              <span class="text-info font-monospace small">{{ camConfig.contrast > 0 ? '+' : '' }}{{ camConfig.contrast }}</span>
            </div>
            <input type="range" class="form-range custom-slider" min="-2" max="2" v-model.number="camConfig.contrast">
          </div>

          <div>
            <div class="d-flex justify-content-between align-items-center mb-1">
              <label class="text-slate-400 small">Saturation</label>
              <span class="text-info font-monospace small">{{ camConfig.saturation > 0 ? '+' : '' }}{{ camConfig.saturation }}</span>
            </div>
            <input type="range" class="form-range custom-slider" min="-2" max="2" v-model.number="camConfig.saturation">
          </div>
        </div>

        <!-- Filters & Switches -->
        <div class="p-3 bg-slate-800 rounded-2 border border-slate-700">
          <label class="text-slate-300 small fw-bold mb-3 d-block text-uppercase">Filters & Exposure Controls</label>
          
          <div class="mb-3">
            <label class="text-slate-400 small mb-1">Special Effect</label>
            <select v-model="camConfig.specialEffect" class="form-select bg-slate-900 border-slate-700 text-white small">
              <option value="None">None (Normal)</option>
              <option value="Negative">Negative</option>
              <option value="Grayscale">Grayscale</option>
              <option value="Red Tint">Red Tint</option>
              <option value="Green Tint">Green Tint</option>
              <option value="Blue Tint">Blue Tint</option>
              <option value="Sepia">Sepia</option>
            </select>
          </div>

          <div class="row g-3">
            <div class="col-4 d-flex flex-column align-items-center text-center p-2 bg-slate-900 rounded border border-slate-700 border-opacity-50">
              <span class="text-slate-400 small mb-1">AWB</span>
              <div class="form-check form-switch p-0 m-0">
                <input class="form-check-input ms-0" type="checkbox" role="switch" v-model="camConfig.awb">
              </div>
            </div>
            <div class="col-4 d-flex flex-column align-items-center text-center p-2 bg-slate-900 rounded border border-slate-700 border-opacity-50">
              <span class="text-slate-400 small mb-1">AEC</span>
              <div class="form-check form-switch p-0 m-0">
                <input class="form-check-input ms-0" type="checkbox" role="switch" v-model="camConfig.aec">
              </div>
            </div>
            <div class="col-4 d-flex flex-column align-items-center text-center p-2 bg-slate-900 rounded border border-slate-700 border-opacity-50">
              <span class="text-slate-400 small mb-1">AGC</span>
              <div class="form-check form-switch p-0 m-0">
                <input class="form-check-input ms-0" type="checkbox" role="switch" v-model="camConfig.agc">
              </div>
            </div>
          </div>

          <!-- Mirror & Flip -->
          <div class="row g-3 mt-1">
            <div class="col-6 d-flex justify-content-between align-items-center p-2 px-3 bg-slate-900 rounded border border-slate-700 border-opacity-50">
              <span class="text-slate-400 small">H-Mirror</span>
              <div class="form-check form-switch p-0 m-0">
                <input class="form-check-input ms-0" type="checkbox" role="switch" v-model="camConfig.hmirror">
              </div>
            </div>
            <div class="col-6 d-flex justify-content-between align-items-center p-2 px-3 bg-slate-900 rounded border border-slate-700 border-opacity-50">
              <span class="text-slate-400 small">V-Flip</span>
              <div class="form-check form-switch p-0 m-0">
                <input class="form-check-input ms-0" type="checkbox" role="switch" v-model="camConfig.vflip">
              </div>
            </div>
          </div>
        </div>

        <!-- Hardware & Capture settings -->
        <div class="p-3 bg-slate-800 rounded-2 border border-slate-700">
          <label class="text-slate-300 small fw-bold mb-3 d-block text-uppercase">Hardware & Capture Settings</label>
          <div class="d-flex flex-column gap-3">
            <div>
              <div class="d-flex justify-content-between align-items-center mb-1">
                <label class="text-slate-400 small">XCLK Frequency</label>
                <span class="text-info font-monospace small fw-bold">{{ xclkMHz }} MHz</span>
              </div>
              <input type="range" class="form-range custom-slider" min="1" max="21" step="1" v-model.number="xclkMHz">
            </div>

            <div class="d-flex justify-content-between align-items-center p-2 px-3 bg-slate-900 rounded border border-slate-700 border-opacity-50">
              <span class="text-slate-400 small">Flash on Capture</span>
              <div class="form-check form-switch p-0 m-0">
                <input class="form-check-input ms-0" type="checkbox" role="switch" v-model="camConfig.flashOnCapture">
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex gap-2 mt-4">
        <button @click="saveConfig" class="btn btn-primary flex-grow-1 py-2 fw-bold text-uppercase" style="font-size: 0.75rem;">
          Save Camera Settings
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-monospace { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }

/* Custom Switche Overrides for Sleek Dark Mode */
.form-check-input:checked {
  background-color: #3b82f6;
  border-color: #3b82f6;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.form-check-input {
  background-color: #334155;
  border-color: #475569;
  cursor: pointer;
}

/* Custom Slider styling */
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
  background: #3b82f6;
  border: 2px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
}

.custom-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #3b82f6;
  border: 2px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
}

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
.text-slate-600 { color: #475569; }
</style>
