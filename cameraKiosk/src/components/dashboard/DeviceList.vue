<script setup>
defineProps({
  devices: {
    type: Array,
    required: true
  }
})

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
  <div class="d-flex flex-column border-bottom border-slate-700 flex-shrink-0 device-panel">
    <div class="bg-slate-800 px-3 py-2 border-bottom border-slate-700">
      <h6 class="m-0 fw-bold d-flex align-items-center gap-2 small">
        <i class="bi bi-hdd-network-fill text-primary"></i> Devices
      </h6>
    </div>
    <div class="overflow-auto custom-scrollbar flex-grow-1">
      <div class="list-group list-group-flush">
        <div v-for="device in devices" :key="device.id" 
             class="list-group-item bg-transparent border-slate-700 px-3 py-2 transition-all hover-bg">
          <div class="d-flex justify-content-between align-items-center">
            <div class="overflow-hidden">
              <div class="fw-bold text-truncate" style="font-size: 0.85rem;">{{ device.mac || 'Unknown MAC' }}</div>
              <code class="text-info d-block text-truncate" style="font-size: 0.75rem;">{{ device.ip }}</code>
            </div>
            <!-- Dynamic signal status indicator (replaces Online/Offline text badge) -->
            <div class="d-flex align-items-center ms-2" style="height: 24px;">
              <!-- Online Device: Green Dynamic Signal Bars + dBm label -->
              <div v-if="device.status === 'Online'" class="d-flex align-items-center gap-2" style="height: 16px;">
                <span class="text-slate-400 font-monospace" style="font-size: 0.7rem;">
                  {{ device.signalRssi !== null && device.signalRssi !== undefined ? device.signalRssi + ' dBm' : (device.signalBars ? getNominalDbm(device.signalBars) + ' dBm' : 'N/A') }}
                </span>
                <div class="d-flex align-items-end gap-1" style="height: 16px;" :title="`Signal Strength: ${device.signalBars || 0}/5`">
                  <div v-for="bar in 5" :key="bar" 
                       :style="{ 
                         width: '3px', 
                         height: (bar * 20) + '%', 
                         backgroundColor: (device.signalBars || 0) >= bar ? '#22c55e' : '#64748b',
                         boxShadow: (device.signalBars || 0) >= bar ? '0 0 6px rgba(34, 197, 94, 0.6)' : 'none',
                         borderRadius: '1px'
                       }">
                  </div>
                </div>
              </div>
              <!-- Offline Device: Muted Bars with a Red X Overlay indicating lost signal -->
              <div v-else class="position-relative d-flex align-items-end gap-1" style="height: 16px;" title="Signal Lost (Offline)">
                <div v-for="bar in 5" :key="bar" 
                     :style="{ 
                       width: '3px', 
                       height: (bar * 20) + '%', 
                       backgroundColor: '#64748b',
                       opacity: 0.65,
                       borderRadius: '1px'
                     }">
                </div>
                <div class="position-absolute top-50 start-50 translate-middle d-flex align-items-center justify-content-center" style="width: 100%; height: 100%;">
                  <i class="bi bi-x-lg" style="font-size: 1.1rem; color: #ff0000; -webkit-text-stroke: 1.2px #ff0000; font-weight: 900 !important; filter: drop-shadow(0 0 3px rgba(255, 0, 0, 0.9));"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hover-bg:hover { background-color: rgba(255, 255, 255, 0.03) !important; }
.list-group-item { border-left: none; border-right: none; }
.list-group-item:first-child { border-top: none; }

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

@media (min-width: 1001px) {
  .device-panel {
    max-height: 40%;
  }
}

@media (max-width: 1000px) {
  .device-panel {
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
  }
  .device-panel .list-group-item {
    padding-left: 1.25rem !important;
    padding-right: 1.25rem !important;
  }
  .custom-scrollbar { overflow-y: visible !important; }
}
</style>
