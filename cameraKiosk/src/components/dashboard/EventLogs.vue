<script setup>
import DateSorter from './DateSorter.vue'

defineProps({
  events: {
    type: Array,
    required: true
  },
  selectedDate: {
    type: Date,
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

const emit = defineEmits(['nextPage', 'prevPage', 'dateSelected'])

const formatEventTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  // If it's already a simple time string (old format), just return it
  if (!timestamp.includes('T') && timestamp.includes(':')) return timestamp;
  
  const date = new Date(timestamp);
  if (isNaN(date)) return timestamp;

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  
  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;
  
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr}, ${timeStr}`;
}

const getImageUrl = (url) => {
  if (!url) return '';
  // If it's the old absolute URL format with gateway.local, fix the hostname
  if (url.startsWith('http')) {
    return url.replace('gateway.local', window.location.hostname);
  }
  // If it's a relative path, prepend the backend origin (assuming port 3000)
  return `https://${window.location.hostname}:3000${url}`;
}
</script>

<template>
  <div class="d-flex flex-column flex-grow-1 overflow-hidden event-panel">
    <div class="bg-slate-800 px-3 py-2 border-bottom border-slate-700 d-flex justify-content-between align-items-center">
      <h6 class="m-0 fw-bold d-flex align-items-center gap-2 small">
        <i class="bi bi-calendar3 text-warning"></i> Events
      </h6>
      <span class="badge bg-slate-700 text-secondary border border-slate-600 extra-small">{{ events.length }} on {{ selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) }}</span>
    </div>

    <!-- Date Sorter Component (Mobile Only) -->
    <DateSorter 
      v-if="windowWidth <= 1000"
      :selectedDate="selectedDate" 
      @dateSelected="(date) => emit('dateSelected', date)" 
    />

    <div class="overflow-auto custom-scrollbar flex-grow-1 event-list-container" style="min-height: 300px;">
      <div v-if="events.length > 0">
        <div v-for="event in (windowWidth <= 1000 ? paginatedEvents : events)" :key="event.id" 
             class="px-3 py-2 border-bottom border-slate-700 last-child-border-0 transition-all hover-bg">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="d-flex align-items-center gap-2">
              <div :class="event.trigger.includes('Motion') ? 'bg-primary' : 'bg-warning'" 
                   class="rounded-circle" style="width: 6px; height: 6px;"></div>
              <span class="fw-bold text-slate-200" style="font-size: 0.8rem;">{{ event.trigger }}</span>
              <!-- Human Detection Badge -->
              <span v-if="event.humanPresence" class="badge bg-danger text-white border border-danger border-opacity-25 d-flex align-items-center gap-1 py-0 px-2" style="font-size: 0.6rem; letter-spacing: 0.5px;">
                <i class="bi bi-person-fill"></i> HUMAN
              </span>
            </div>
            <span class="text-secondary font-monospace text-nowrap" style="font-size: 0.6rem;">{{ formatEventTime(event.timestamp) }}</span>
          </div>
          <div class="d-flex align-items-center gap-1 text-secondary ps-3" style="font-size: 0.7rem;">
            <i class="bi bi-geo-alt-fill extra-small opacity-50"></i>
            <span class="text-truncate">{{ event.location }}</span>
          </div>
          <div v-if="event.imageUrl" class="mt-2 ps-3 pe-1 text-center">
            <img :src="getImageUrl(event.imageUrl)" class="img-fluid rounded border border-slate-700" style="height: auto; max-height: 350px; width: auto;" alt="Motion Snapshot" loading="lazy" />
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-else class="h-100 d-flex flex-column align-items-center justify-content-center text-secondary opacity-25 py-5">
        <i class="bi bi-calendar-x fs-1 mb-2"></i>
        <div class="small fw-bold text-uppercase" style="letter-spacing: 2px;">No Events</div>
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
