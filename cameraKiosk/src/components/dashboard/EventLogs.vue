<script setup>
import { ref } from 'vue'
import DateSorter from './DateSorter.vue'
import PlaybackView from './PlaybackView.vue'

const activeTab = ref('events')

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

const handleImageError = (e) => {
  const img = e.target;
  if (!img.dataset.retries) {
    img.dataset.retries = '0';
  }
  const retries = parseInt(img.dataset.retries);
  if (retries < 5) {
    img.dataset.retries = (retries + 1).toString();
    setTimeout(() => {
      // Append a cache-buster query parameter to reload the image
      const baseSrc = img.src.split('?')[0];
      img.src = `${baseSrc}?retry=${retries + 1}&t=${Date.now()}`;
    }, 1500);
  }
}
</script>

<template>
  <div class="d-flex flex-column flex-grow-1 overflow-hidden event-panel">
    <!-- Tabbed Header Group -->
    <div class="bg-slate-800 border-bottom border-slate-700 d-flex flex-column">
      <!-- Tabs Selector -->
      <div class="d-flex border-bottom border-slate-700 bg-slate-900">
        <button 
          @click="activeTab = 'events'" 
          :class="activeTab === 'events' ? 'border-primary text-primary font-bold active-tab' : 'border-transparent text-slate-400'" 
          class="flex-grow-1 py-2 px-3 text-center border-bottom-2 small transition-all btn-tab">
          <i class="bi bi-list-task me-1"></i> Events Logs
        </button>
        <button 
          @click="activeTab = 'playback'" 
          :class="activeTab === 'playback' ? 'border-primary text-primary font-bold active-tab' : 'border-transparent text-slate-400'" 
          class="flex-grow-1 py-2 px-3 text-center border-bottom-2 small transition-all btn-tab">
          <i class="bi bi-play-btn me-1"></i> Playback
        </button>
      </div>

      <!-- Info Sub-Header -->
      <div class="px-3 py-1.5 d-flex justify-content-between align-items-center">
        <span class="text-secondary extra-small font-bold text-uppercase tracking-wider">Trigger Logs</span>
        <span class="badge bg-slate-700 text-secondary border border-slate-600 extra-small">{{ events.length }} on {{ selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) }}</span>
      </div>
    </div>

    <!-- Date Sorter Component (Mobile Only) -->
    <DateSorter 
      v-if="windowWidth <= 1000"
      :selectedDate="selectedDate" 
      @dateSelected="(date) => emit('dateSelected', date)" 
    />

    <!-- Event Logs Tab View -->
    <div v-if="activeTab === 'events'" class="overflow-auto custom-scrollbar flex-grow-1 event-list-container" style="min-height: 300px;">
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
            <img :src="getImageUrl(event.imageUrl)" @error="handleImageError" class="img-fluid rounded border border-slate-700" style="height: auto; max-height: 350px; width: auto;" alt="Motion Snapshot" loading="lazy" />
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-else class="h-100 d-flex flex-column align-items-center justify-content-center text-secondary opacity-25 py-5">
        <i class="bi bi-calendar-x fs-1 mb-2"></i>
        <div class="small fw-bold text-uppercase" style="letter-spacing: 2px;">No Events</div>
      </div>
    </div>

    <!-- Playback Tab View -->
    <div v-else class="flex-grow-1 overflow-hidden">
      <PlaybackView :events="events" />
    </div>
    
    <!-- Pagination Controls (Mobile only) -->
    <div v-if="windowWidth <= 1000 && activeTab === 'events'" class="bg-slate-800 p-2 border-top border-slate-700 d-flex justify-content-between align-items-center">
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

.btn-tab {
  background: transparent;
  border-top: none;
  border-left: none;
  border-right: none;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.btn-tab:hover {
  color: #3b82f6 !important;
}
.border-bottom-2 {
  border-bottom: 2px solid;
}
.active-tab {
  border-color: #3b82f6 !important;
}
</style>
