<script setup>
import { ref, watch } from 'vue'
import DateSorter from './DateSorter.vue'
import PlaybackView from './PlaybackView.vue'
import ImageViewer from './ImageViewer.vue'

const activeTab = ref('events')

const props = defineProps({
  events: { type: Array, required: true },
  selectedDate: { type: Date, required: true },
  paginatedEvents: { type: Array, required: true },
  currentEventPage: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  windowWidth: { type: Number, required: true },
  backendUrl: { type: String, default: '' }
})

// Sudah ditambahkan deleteSingle dan deleteBatch
const emit = defineEmits(['nextPage', 'prevPage', 'dateSelected', 'deleteSingle', 'deleteBatch'])

watch(() => props.windowWidth, (newWidth) => {
  if (newWidth > 1000 && activeTab.value !== 'events') {
    activeTab.value = 'events'
  }
})

const formatEventTime = (timestamp) => {
  if (!timestamp) return 'N/A';
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
  if (url.startsWith('http')) return url.replace('gateway.local', window.location.hostname);
  const base = props.backendUrl || `http://${window.location.hostname}:3000`;
  return `${base}${url}`;
}

const handleImageError = (e) => {
  const img = e.target;
  if (!img.dataset.retries) img.dataset.retries = '0';
  const retries = parseInt(img.dataset.retries);
  if (retries < 5) {
    img.dataset.retries = (retries + 1).toString();
    setTimeout(() => {
      const baseSrc = img.src.split('?')[0];
      img.src = `${baseSrc}?retry=${retries + 1}&t=${Date.now()}`;
    }, 1500);
  }
}

// Fungsi bantu untuk mengubah format selectedDate ke YYYY-MM-DD
const getFormattedDateForBatch = () => {
  const d = props.selectedDate;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const viewerOpen = ref(false)
const viewerInitialIndex = ref(0)

const openViewer = (event) => {
  const index = props.events.findIndex(e => e.id === event.id)
  viewerInitialIndex.value = index !== -1 ? index : 0
  viewerOpen.value = true
}
</script>

<template>
  <div class="d-flex flex-column flex-grow-1 overflow-hidden event-panel">
    <div class="bg-slate-800 border-bottom border-slate-700 d-flex flex-column">
      <div v-if="windowWidth <= 1000" class="d-flex border-bottom border-slate-700 bg-slate-900">
        <button @click="activeTab = 'events'" :class="activeTab === 'events' ? 'border-primary text-primary font-bold active-tab' : 'border-transparent text-slate-400'" class="flex-grow-1 py-2 px-3 text-center border-bottom-2 small transition-all btn-tab">
          <i class="bi bi-list-task me-1"></i> Events Logs
        </button>
        <button @click="activeTab = 'playback'" :class="activeTab === 'playback' ? 'border-primary text-primary font-bold active-tab' : 'border-transparent text-slate-400'" class="flex-grow-1 py-2 px-3 text-center border-bottom-2 small transition-all btn-tab">
          <i class="bi bi-play-btn me-1"></i> Playback
        </button>
      </div>

      <div class="px-3 py-2 d-flex justify-content-between align-items-center">
        <div class="d-flex flex-column">
          <span class="text-secondary extra-small font-bold text-uppercase tracking-wider">Trigger Logs</span>
          <span class="badge bg-slate-700 text-secondary border border-slate-600 extra-small mt-1" style="width: fit-content;">{{ events.length }} on {{ selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) }}</span>
        </div>
        
        <button v-if="events.length > 0" @click="emit('deleteBatch', getFormattedDateForBatch())" class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size: 0.65rem;" title="Delete all today's recorded footage">
          <i class="bi bi-trash3-fill"></i> Clear Day
        </button>
      </div>
    </div>

    <DateSorter v-if="windowWidth <= 1000" :selectedDate="selectedDate" @dateSelected="(date) => emit('dateSelected', date)" />

    <div v-if="activeTab === 'events'" class="overflow-auto custom-scrollbar flex-grow-1 event-list-container" style="min-height: 300px;">
      <div v-if="events.length > 0">
        <div v-for="event in (windowWidth <= 1000 ? paginatedEvents : events)" :key="event.id" class="px-3 py-2 border-bottom border-slate-700 last-child-border-0 transition-all hover-bg">
          
          <div class="d-flex justify-content-between align-items-start mb-1">
            <div class="d-flex align-items-center gap-2">
              <div :class="event.trigger.includes('Motion') ? 'bg-primary' : 'bg-warning'" class="rounded-circle" style="width: 6px; height: 6px;"></div>
              <span class="fw-bold text-slate-200" style="font-size: 0.8rem;">{{ event.trigger }}</span>
              <span v-if="event.humanPresence" class="badge bg-danger text-white border border-danger border-opacity-25 d-flex align-items-center gap-1 py-0 px-2" style="font-size: 0.6rem; letter-spacing: 0.5px;">
                <i class="bi bi-person-fill"></i> HUMAN
              </span>
            </div>
            
            <div class="d-flex align-items-center">
              <span class="text-secondary font-monospace text-nowrap" style="font-size: 0.65rem;">{{ formatEventTime(event.timestamp) }}</span>
              <button @click="emit('deleteSingle', event.timestamp)" class="btn btn-link text-danger p-0 ms-2 text-decoration-none" title="Hapus rekaman ini">
                <i class="bi bi-trash fs-6"></i>
              </button>
            </div>
          </div>

          <div class="d-flex align-items-center gap-1 text-secondary ps-3" style="font-size: 0.7rem;">
            <i class="bi bi-geo-alt-fill extra-small opacity-50"></i>
            <span class="text-truncate">{{ event.location }}</span>
          </div>
          <div v-if="event.imageUrl" class="mt-2 ps-3 pe-1 text-center">
            <img :src="getImageUrl(event.imageUrl)" @error="handleImageError" @click="openViewer(event)" class="img-fluid rounded border border-slate-700" style="height: auto; max-height: 350px; width: auto; cursor: pointer;" alt="Snapshot" loading="lazy" />
          </div>
        </div>
      </div>
      
      <div v-else class="h-100 d-flex flex-column align-items-center justify-content-center text-secondary opacity-25 py-5">
        <i class="bi bi-calendar-x fs-1 mb-2"></i>
        <div class="small fw-bold text-uppercase" style="letter-spacing: 2px;">No Events</div>
      </div>
    </div>

    <div v-else class="flex-grow-1 overflow-hidden">
      <PlaybackView :events="events" :backendUrl="backendUrl" />
    </div>
    
    <div v-if="windowWidth <= 1000 && activeTab === 'events'" class="bg-slate-800 p-2 border-top border-slate-700 d-flex justify-content-between align-items-center">
      <button @click="emit('prevPage')" :disabled="currentEventPage === 1" class="btn btn-sm btn-outline-secondary"><i class="bi bi-chevron-left"></i> Prev</button>
      <span class="text-secondary small">Page {{ currentEventPage }} of {{ totalPages }}</span>
      <button @click="emit('nextPage')" :disabled="currentEventPage === totalPages" class="btn btn-sm btn-outline-secondary">Next <i class="bi bi-chevron-right"></i></button>
    </div>

    <Teleport to="body">
      <ImageViewer 
        v-if="viewerOpen" 
        :events="events" 
        :initialIndex="viewerInitialIndex" 
        :backendUrl="backendUrl"
        @close="viewerOpen = false" 
      />
    </Teleport>
  </div>
</template>

<style scoped>
.hover-bg:hover { background-color: rgba(255, 255, 255, 0.3) !important; }
.extra-small { font-size: 0.7rem; }
.font-monospace { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }
.last-child-border-0:last-child { border-bottom: none !important; }

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

@media (min-width: 1001px) { .event-panel { height: 60%; } }
@media (max-width: 1000px) {
  .event-panel { max-height: none !important; height: auto !important; overflow: visible !important; }
  .event-panel .px-3 { padding-left: 1.25rem !important; padding-right: 1.25rem !important; }
  .custom-scrollbar { overflow-y: visible !important; }
}

.btn-tab { background: transparent; border-top: none; border-left: none; border-right: none; font-size: 0.75rem; letter-spacing: 0.5px; cursor: pointer; border-bottom: 2px solid transparent; }
.btn-tab:hover { color: #3b82f6 !important; }
.border-bottom-2 { border-bottom: 2px solid; }
.active-tab { border-color: #3b82f6 !important; }
</style>