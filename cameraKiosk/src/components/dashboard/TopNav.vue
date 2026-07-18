<script setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const { locale } = useI18n()

const isLocalIp = computed(() => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || 
         hostname === '127.0.0.1' || 
         hostname.startsWith('192.168.') || 
         hostname.startsWith('10.') || 
         (hostname.startsWith('172.') && parseInt(hostname.split('.')[1]) >= 16 && parseInt(hostname.split('.')[1]) <= 31) ||
         hostname.endsWith('.local');
});

function toggleLanguage() {
  locale.value = locale.value === 'id' ? 'en' : 'id'
  localStorage.setItem('kiosk_locale', locale.value)
}

defineProps({
  currentTime: {
    type: String,
    required: true
  },
  wsStatus: {
    type: String,
    required: true
  },
  aiConnected: {
    type: Boolean,
    required: true
  },
  aiDetecting: {
    type: Boolean,
    required: true
  },
  aiEnabled: {
    type: Boolean,
    default: true
  },
  // Tambahan prop untuk menerima data storage dari backend
  storageData: {
    type: Object,
    default: null
  },
  isForceMobile: {
    type: Boolean,
    default: false
  },
  windowWidth: {
    type: Number,
    required: true
  },
  viewMode: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['toggle-force-mobile', 'openSystemConfig', 'setViewMode', 'logout', 'openDeviceList'])
</script>

<template>
  <nav class="navbar bg-slate-800 px-3 py-1 py-md-0 border-bottom border-slate-700 z-3 flex-shrink-0" style="min-height: 45px;">
    <div class="container-fluid p-0 d-flex align-items-center justify-content-between flex-wrap" style="row-gap: 6px;">
      <div class="d-flex align-items-center gap-2">
        <a class="navbar-brand fw-bold d-flex align-items-center gap-2 m-0" href="#" style="font-size: 1.1rem;">
          <img src="/magic cam logo.png" alt="Magic Cam Logo" height="24" class="brand-logo" />
          <span v-if="windowWidth >= 510">Magic Cam</span>
        </a>
        <button @click="toggleLanguage" class="btn btn-sm btn-outline-secondary border-slate-700 text-slate-300 px-2 py-1" style="font-size: 0.65rem; border: 1px solid rgba(148, 163, 184, 0.3);">
          {{ locale === 'id' ? '🇮🇩 ID' : '🇬🇧 EN' }}
        </button>
      </div>
      <div class="d-flex align-items-center gap-3 ms-auto">
        
        <div v-if="storageData" class="d-flex flex-column justify-content-center border-end pe-3 me-1 border-slate-700 storage-monitor-wrapper" style="width: 110px;">
          <!-- Minimal Storage Indicator for small mobile screens -->
          <div class="storage-label-minimal align-items-center gap-1 font-monospace" 
               :class="storageData.percentage >= 90 ? 'text-danger animate-pulse' : (storageData.percentage >= 70 ? 'text-warning' : 'text-success')"
               style="font-size: 0.7rem; font-weight: bold;">
            <i class="bi bi-hdd-fill"></i>
            <span>{{ storageData.percentage }}%</span>
          </div>

          <div class="d-flex justify-content-between mb-1 storage-label-full" style="font-size: 0.6rem; font-weight: bold;">
            <span class="text-secondary">{{ $t('nav.storage') }}</span>
            <span :class="storageData.percentage >= 90 ? 'text-danger animate-pulse' : (storageData.percentage >= 70 ? 'text-warning' : 'text-success')">
              {{ storageData.percentage }}%
            </span>
          </div>
          <div class="progress storage-progress-container" style="height: 4px; background-color: #334155; border-radius: 2px;">
            <div class="progress-bar" 
                 :class="storageData.percentage >= 90 ? 'bg-danger' : (storageData.percentage >= 70 ? 'bg-warning' : 'bg-success')" 
                 :style="{ width: storageData.percentage + '%' }" >
            </div>
          </div>
          <div class="text-secondary mt-1 text-center font-monospace storage-detail-text" style="font-size: 0.55rem;">
            {{ storageData.usedGb }}GB / {{ storageData.totalGb }}GB
          </div>
        </div>
        <div v-if="windowWidth >= 695" class="d-flex align-items-center gap-2 border-end pe-2 pe-sm-3 border-slate-700">
          <div class="fw-bold font-monospace lh-1" style="font-size: 0.85rem;">{{ currentTime }}</div>
          <div class="text-secondary" style="font-size: 0.65rem;">
            {{ new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }}
          </div>
        </div>
        
        <!-- Force Mobile View Toggle (Only shown on Desktop > 1000px) -->
        <button 
          v-if="windowWidth > 1000" 
          @click="$emit('toggle-force-mobile')" 
          :class="['btn btn-sm text-uppercase fw-bold font-monospace px-2 py-1 border-slate-700', isForceMobile ? 'btn-info text-slate-900' : 'btn-outline-secondary text-slate-300']"
          style="font-size: 0.65rem; border: 1px solid rgba(148, 163, 184, 0.3);"
        >
          <i :class="isForceMobile ? 'bi bi-phone-fill me-1' : 'bi bi-pc-display me-1'"></i>
          {{ isForceMobile ? $t('nav.normalView') : $t('nav.mobileView') }}
        </button>
        
        <div class="d-flex align-items-center text-secondary" style="font-size: 1rem; gap: 0.5rem;">
          <!-- Combined WebSocket & AI Status Button to toggle Device List -->
          <button @click="emit('openDeviceList')" 
                  class="btn btn-sm btn-link p-1 px-2 d-flex align-items-center justify-content-center gap-2 hover-info" 
                  title="View Connected Devices"
                  style="min-height: 32px; background: rgba(255,255,255,0.05); border-radius: 6px; text-decoration: none;">
            <!-- WebSocket Status Icon -->
            <i :class="wsStatus === 'Online' ? 'bi-broadcast text-success' : 'bi-broadcast-pin text-danger'"></i>
            
            <!-- AI Status Icon -->
            <i v-if="!aiEnabled" class="bi bi-eye-slash-fill text-slate-400"></i>
            <i v-else-if="!aiConnected" class="bi bi-cloud-slash text-danger"></i>
            <i v-else-if="aiDetecting" class="bi bi-eye-fill text-warning animate-pulse"></i>
            <i v-else class="bi bi-eye text-success"></i>
          </button>

          <!-- Separator between status and display mode -->
          <div class="vr bg-slate-600 opacity-40 mx-1" style="height: 1rem; align-self: center; width: 1.5px;"></div>

          <!-- Display Mode Toggle Button -->
          <button @click="emit('setViewMode', viewMode === 'single' ? 'multiple' : 'single')" 
                  class="btn btn-sm btn-link p-1 hover-info d-flex align-items-center justify-content-center"
                  :title="viewMode === 'single' ? $t('stream.multipleView') : $t('stream.singleView')"
                  style="min-width: 32px; min-height: 32px;">
            <i :class="viewMode === 'single' ? 'bi bi-grid-3x3-gap-fill text-info' : 'bi bi-camera-fill text-info'" style="font-size: 1rem; transition: color 0.2s ease, transform 0.2s ease; display: inline-block;"></i>
          </button>

          <!-- Separator between display mode and settings -->
          <div class="vr bg-slate-600 opacity-40 mx-1" style="height: 1rem; align-self: center; width: 1.5px;"></div>

          <!-- System Settings Button -->
          <button @click="emit('openSystemConfig')" 
                  class="btn btn-sm btn-link p-1 hover-info d-flex align-items-center justify-content-center" 
                  title="System Settings"
                  style="min-width: 32px; min-height: 32px;">
            <i class="bi bi-gear-fill text-info" style="font-size: 1rem; transition: color 0.2s ease, transform 0.2s ease; display: inline-block;"></i>
          </button>

          <!-- Separator between settings and logout -->
          <div v-if="!isLocalIp" class="vr bg-slate-600 opacity-40 mx-1" style="height: 1rem; align-self: center; width: 1.5px;"></div>

          <!-- Logout Button -->
          <button v-if="!isLocalIp" @click="emit('logout')" 
                  class="btn btn-sm btn-link p-1 text-danger hover-danger d-flex align-items-center justify-content-center" 
                  title="Logout"
                  style="min-width: 32px; min-height: 32px;">
            <i class="bi bi-box-arrow-right" style="font-size: 1rem; transition: transform 0.2s ease; display: inline-block;"></i>
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.font-monospace { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }

.brand-logo { filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5)); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.animate-pulse {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Custom Blue Hover and Active Colors */
.hover-info:hover i {
  color: #3b82f6 !important;
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

@media (max-width: 480px) {
  .container-fluid { padding-left: 0.4rem !important; padding-right: 0.4rem !important; }
  .gap-3 { gap: 0.5rem !important; }
}

@media (max-width: 440px) {
  .storage-label-full {
    display: none !important;
  }
  .storage-label-minimal {
    display: inline-flex !important;
  }
  .storage-progress-container {
    display: none !important;
  }
  .storage-detail-text {
    display: none !important;
  }
  .storage-monitor-wrapper {
    width: auto !important;
    padding-right: 0.5rem !important;
    margin-right: 0.25rem !important;
  }
}

@media (min-width: 441px) {
  .storage-label-minimal {
    display: none !important;
  }
}
</style>