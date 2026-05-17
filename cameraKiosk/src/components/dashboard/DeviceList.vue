<script setup>
defineProps({
  devices: {
    type: Array,
    required: true
  }
})
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
            <span :class="device.status === 'Online' ? 'bg-success' : 'bg-danger'" 
                  class="badge rounded-pill ms-1" style="font-size: 0.75rem;">
              {{ device.status }}
            </span>
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
