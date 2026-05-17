<script setup>
defineProps({
  events: {
    type: Array,
    required: true
  },
  paginatedEvents: {
    type: Array,
    required: true
  },
  currentEventPage: {
    type: Number,
    required: true
  },
  totalPages: {
    type: Number,
    required: true
  },
  windowWidth: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['nextPage', 'prevPage'])
</script>

<template>
  <div class="d-flex flex-column flex-grow-1 overflow-hidden event-panel">
    <div class="bg-slate-800 px-3 py-2 border-bottom border-slate-700 d-flex justify-content-between align-items-center">
      <h6 class="m-0 fw-bold d-flex align-items-center gap-2 small">
        <i class="bi bi-bell-fill text-warning"></i> Events
      </h6>
      <span class="badge bg-slate-700 text-secondary border border-slate-600 extra-small">{{ events.length }}</span>
    </div>
    <div class="overflow-auto custom-scrollbar flex-grow-1">
      <div v-for="event in (windowWidth <= 1000 ? paginatedEvents : events)" :key="event.id" 
           class="px-3 py-2 border-bottom border-slate-700 last-child-border-0 transition-all hover-bg">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="d-flex align-items-center gap-2">
            <div :class="event.trigger.includes('Motion') ? 'bg-primary' : 'bg-warning'" 
                 class="rounded-circle" style="width: 6px; height: 6px;"></div>
            <span class="fw-bold text-slate-200" style="font-size: 0.8rem;">{{ event.trigger }}</span>
          </div>
          <span class="text-secondary font-monospace" style="font-size: 0.65rem;">{{ event.timestamp }}</span>
        </div>
        <div class="d-flex align-items-center gap-1 text-secondary ps-3" style="font-size: 0.7rem;">
          <i class="bi bi-geo-alt-fill extra-small opacity-50"></i>
          <span class="text-truncate">{{ event.location }}</span>
        </div>
        <div v-if="event.imageUrl" class="mt-2 ps-3 pe-1">
          <img :src="event.imageUrl" class="img-fluid rounded border border-slate-700 w-100" style="max-height: 120px; object-fit: cover;" alt="Motion Snapshot" loading="lazy" />
        </div>
      </div>
    </div>
    
    <!-- Pagination Controls (Mobile only) -->
    <div v-if="windowWidth <= 1000" class="bg-slate-800 p-2 border-top border-slate-700 d-flex justify-content-between align-items-center">
      <button @click="emit('prevPage')" :disabled="currentEventPage === 1" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-chevron-left"></i> Prev
      </button>
      <span class="text-secondary small">Page {{ currentEventPage }} of {{ totalPages }}</span>
      <button @click="emit('nextPage')" :disabled="currentEventPage === totalPages" class="btn btn-sm btn-outline-secondary">
        Next <i class="bi bi-chevron-right"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.hover-bg:hover { background-color: rgba(255, 255, 255, 0.03) !important; }
.extra-small { font-size: 0.7rem; }
.font-monospace { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }
.last-child-border-0:last-child { border-bottom: none !important; }

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

@media (min-width: 1001px) {
  .event-panel {
    height: 60%;
  }
}

@media (max-width: 1000px) {
  .event-panel {
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
  }
  .event-panel .px-3 {
    padding-left: 1.25rem !important;
    padding-right: 1.25rem !important;
  }
  .custom-scrollbar { overflow-y: visible !important; }
}
</style>
