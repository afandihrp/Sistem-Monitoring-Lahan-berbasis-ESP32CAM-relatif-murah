<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DateSorter from './DateSorter.vue'
import ImageViewer from './ImageViewer.vue'

const { locale } = useI18n()

const translateTrigger = (trigger) => {
  if (!trigger) return '';
  
  // Extract text inside "Motion (...)" if it exists
  let clean = trigger.replace(/^Motion \((.*)\)$/i, '$1');
  
  // Clean up the trigger text to only show the sensor name
  clean = clean
    .replace(/_/g, ' ')
    .replace(/Motion/ig, '')
    .replace(/Detection/ig, '')
    .trim();
    
  // Prepend PIR if it's a PIR sensor
  if (['Left', 'Right', 'Middle'].includes(clean)) {
    clean = 'PIR ' + clean;
  }
    
  if (locale.value === 'id') {
    return clean
      .replace('Left', 'Kiri')
      .replace('Middle', 'Tengah')
      .replace('Right', 'Kanan')
      .replace('Person', 'Orang');
  }
  return clean;
}

const activeTab = ref('events')
const displayMode = ref(localStorage.getItem('eventDisplayMode') || 'grid')
watch(displayMode, (newMode) => {
  localStorage.setItem('eventDisplayMode', newMode)
})

const props = defineProps({
  events: { type: Array, required: true },
  selectedDate: { type: Date, required: true },
  paginatedEvents: { type: Array, required: true },
  currentEventPage: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  windowWidth: { type: Number, required: true },
  backendUrl: { type: String, default: '' },
  eventsPerPage: { type: Number, default: 10 }
})

// Sudah ditambahkan deleteSingle dan deleteBatch
const emit = defineEmits(['loadMoreEvents', 'dateSelected', 'deleteSingle', 'deleteBatch', 'update:eventsPerPage'])

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
  
  if (isToday) return `${locale.value === 'id' ? 'Hari ini' : 'Today'}, ${timeStr}`;
  if (isYesterday) return `${locale.value === 'id' ? 'Kemarin' : 'Yesterday'}, ${timeStr}`;
  
  const dateStr = date.toLocaleDateString(locale.value === 'id' ? 'id-ID' : 'en-US', { month: 'short', day: 'numeric' });
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

const videoViewerOpen = ref(false)
const currentVideoUrl = ref('')

const openVideo = (event) => {
  if (event.videoUrl) {
    let url = event.videoUrl
    if (url.startsWith('http')) {
      url = url.replace('gateway.local', window.location.hostname)
    } else {
      const base = props.backendUrl || `http://${window.location.hostname}:3000`
      url = `${base}${url}`
    }
    currentVideoUrl.value = url
    videoViewerOpen.value = true
  }
}
</script>

<template>
  <div class="d-flex flex-column flex-grow-1 overflow-hidden event-panel">
    <div class="bg-slate-800 border-bottom border-slate-700 d-flex flex-column">
      <div class="px-3 py-2 d-flex justify-content-between align-items-center">
        <div class="d-flex flex-column">
          <span class="text-secondary extra-small font-bold text-uppercase tracking-wider">{{ $t('events.triggerLogs') }}</span>
          <span class="badge bg-slate-700 text-secondary border border-slate-600 extra-small mt-1" style="width: fit-content;">{{ events.length }} {{ $t('events.on') }} {{ selectedDate.toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', { month: 'short', day: 'numeric' }) }}</span>
        </div>
        
        <div class="d-flex align-items-center gap-2">
          <!-- View Style Toggle (Grid/List) -->
          <div v-if="windowWidth <= 1000" class="btn-group border border-slate-700 rounded overflow-hidden" style="padding: 1px; background-color: #0f172a;">
            <button @click="displayMode = 'grid'" :class="['btn btn-sm p-1 border-0 shadow-none d-flex align-items-center justify-content-center', displayMode === 'grid' ? 'btn-primary text-white' : 'text-slate-400 bg-transparent']" style="font-size: 0.7rem; height: 22px; width: 24px; cursor: pointer;" title="Grid View">
              <i class="bi bi-grid-fill"></i>
            </button>
            <button @click="displayMode = 'list'" :class="['btn btn-sm p-1 border-0 shadow-none d-flex align-items-center justify-content-center', displayMode === 'list' ? 'btn-primary text-white' : 'text-slate-400 bg-transparent']" style="font-size: 0.7rem; height: 22px; width: 24px; cursor: pointer;" title="List View">
              <i class="bi bi-list-ul"></i>
            </button>
          </div>

          <!-- Per Page Select Dropdown -->
          <div v-if="windowWidth <= 1000" class="d-flex align-items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 py-1">
            <span class="text-slate-500 font-monospace" style="font-size: 0.6rem;">LIMIT</span>
            <select :value="eventsPerPage" @change="emit('update:eventsPerPage', Number($event.target.value))" class="form-select form-select-sm bg-transparent border-0 text-primary py-0 ps-1 pe-4 fw-bold font-monospace" style="font-size: 0.65rem; height: 18px; outline: none; box-shadow: none; cursor: pointer; width: 62px;">
              <option value="10" class="bg-slate-900 text-white">10</option>
              <option value="20" class="bg-slate-900 text-white">20</option>
              <option value="50" class="bg-slate-900 text-white">50</option>
              <option value="100" class="bg-slate-900 text-white">100</option>
            </select>
          </div>

          <button v-if="events.length > 0" @click="emit('deleteBatch', getFormattedDateForBatch())" class="btn btn-outline-danger btn-sm py-1 px-2 d-flex align-items-center justify-content-center" style="font-size: 0.65rem; height: 28px;" :title="$t('events.clearDay')">
            <i class="bi bi-trash3-fill"></i>
          </button>
        </div>
      </div>
    </div>

    <DateSorter v-if="windowWidth <= 1000" :selectedDate="selectedDate" @dateSelected="(date) => emit('dateSelected', date)" />

    <div class="overflow-auto custom-scrollbar flex-grow-1 event-list-container" style="min-height: 300px;">
      <div v-if="events.length > 0">
        <!-- Grid View Mode -->
        <div v-if="displayMode === 'grid' || windowWidth > 1000" class="events-grid" :class="{ 'is-forced-mobile': windowWidth === 999 }">
          <div v-for="event in (windowWidth <= 1000 ? paginatedEvents : events.slice(0, 5))" :key="event.id" class="event-card transition-all hover-bg">
            
            <div v-if="event.imageUrl" class="event-image-wrapper">
              <img :src="getImageUrl(event.imageUrl)" @error="handleImageError" @click="openViewer(event)" class="event-image" alt="Snapshot" loading="lazy" />

              <div class="event-badges">
                <span v-if="event.humanPresence" class="badge bg-danger text-white border border-danger border-opacity-25 d-flex align-items-center py-0 px-1 overlay-badge">
                  <i class="bi bi-person-fill"></i>
                </span>
              </div>
              
              <button @click="emit('deleteSingle', event.timestamp)" class="btn btn-dark btn-sm text-danger delete-btn" title="Hapus rekaman ini">
                <i class="bi bi-trash"></i>
              </button>
            </div>

            <!-- Actions for non-image logs -->
            <div v-else class="d-flex justify-content-end p-2 pb-0">
              <button @click="emit('deleteSingle', event.timestamp)" class="btn btn-dark btn-sm text-danger" title="Hapus rekaman ini">
                <i class="bi bi-trash"></i>
              </button>
            </div>

            <div class="event-details mt-2 px-2 pb-2">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold text-slate-200 text-truncate trigger-text" :title="translateTrigger(event.trigger)">{{ translateTrigger(event.trigger) }}</span>
                <button v-if="event.videoUrl" @click="openVideo(event)" class="btn btn-sm btn-link text-primary p-0 d-flex align-items-center gap-1 text-decoration-none metadata-text" title="Play Video">
                  <i class="bi bi-play-circle-fill fs-5"></i>
                </button>
              </div>
              <div class="d-flex justify-content-between align-items-center text-secondary metadata-text">
                <span class="font-monospace text-nowrap time-text">{{ formatEventTime(event.timestamp) }}</span>
              </div>
            </div>
            
          </div>
        </div>

        <!-- List View Mode -->
        <div v-else class="events-list d-flex flex-column px-2 py-1 gap-1" :class="{ 'is-forced-mobile-list': windowWidth === 999 }">
          <div v-for="event in (windowWidth <= 1000 ? paginatedEvents : events.slice(0, 5))" :key="event.id" class="event-list-item d-flex align-items-center justify-content-between p-2 hover-bg border-bottom border-slate-800" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 0.375rem;">
            <div class="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
              <!-- Thumbnail -->
              <div v-if="event.imageUrl" class="position-relative flex-shrink-0" style="width: 144px; height: 81px; border-radius: 4px; overflow: hidden; background-color: #0f172a;">
                <img :src="getImageUrl(event.imageUrl)" @error="handleImageError" @click="openViewer(event)" class="w-100 h-100" style="object-fit: cover; cursor: pointer;" alt="Thumb" />
                <span v-if="event.humanPresence" class="position-absolute top-0 start-0 badge bg-danger p-1 rounded-0" style="font-size: 0.5rem; line-height: 1; border-bottom-right-radius: 4px !important;">
                  <i class="bi bi-person-fill"></i>
                </span>
              </div>
              <div v-else class="d-flex align-items-center justify-content-center bg-slate-900 rounded flex-shrink-0 text-slate-500 border border-slate-800" style="width: 144px; height: 81px;">
                <i class="bi bi-info-circle"></i>
              </div>
              
              <!-- Details -->
              <div class="d-flex flex-column overflow-hidden">
                <span class="fw-bold text-slate-200 text-truncate" style="font-size: 0.75rem;" :title="translateTrigger(event.trigger)">
                  {{ translateTrigger(event.trigger) }}
                </span>
                <span class="text-secondary font-monospace" style="font-size: 0.6rem;">
                  {{ formatEventTime(event.timestamp) }}
                </span>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
              <button v-if="event.videoUrl" @click="openVideo(event)" class="btn btn-sm btn-link text-primary p-0 d-flex align-items-center shadow-none border-0" title="Play Video">
                <i class="bi bi-play-circle-fill fs-5"></i>
              </button>
              <button @click="emit('deleteSingle', event.timestamp)" class="btn btn-link text-danger p-0 d-flex align-items-center shadow-none border-0" style="font-size: 0.95rem; cursor: pointer;" title="Hapus rekaman ini">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="h-100 d-flex flex-column align-items-center justify-content-center text-secondary opacity-25 py-5">
        <i class="bi bi-calendar-x fs-1 mb-2"></i>
        <div class="small fw-bold text-uppercase" style="letter-spacing: 2px;">{{ $t('events.noEvents') }}</div>
      </div>
    </div>
    
    <div v-if="windowWidth <= 1000" class="bg-slate-800 p-2 border-top border-slate-700 d-flex justify-content-center align-items-center">
      <button v-if="currentEventPage < totalPages" @click="emit('loadMoreEvents')" class="btn btn-sm btn-outline-primary w-100 fw-bold tracking-wider text-uppercase">
        Load More <i class="bi bi-chevron-down ms-1"></i>
      </button>
      <span v-else class="text-secondary small fw-bold text-uppercase tracking-wider">All events loaded</span>
    </div>

    <Teleport to="body">
      <ImageViewer 
        v-if="viewerOpen" 
        :events="events" 
        :initialIndex="viewerInitialIndex" 
        :backendUrl="backendUrl"
        @close="viewerOpen = false" 
      />
      
      <div v-if="videoViewerOpen" class="video-modal-backdrop" @click.self="videoViewerOpen = false">
        <div class="video-modal-content">
          <div class="d-flex justify-content-end p-2 position-absolute top-0 end-0 z-3">
            <button @click="videoViewerOpen = false" class="btn btn-dark btn-sm rounded-circle opacity-75 shadow hover-opacity-100">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <video :src="currentVideoUrl" controls autoplay class="w-100 bg-black"></video>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.hover-bg:hover { background-color: rgba(255, 255, 255, 0.05) !important; }
.extra-small { font-size: 0.7rem; }
.font-monospace { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }
.last-child-border-0:last-child { border-bottom: none !important; }

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

@media (min-width: 1001px) { .event-panel { height: 60%; } }
@media (max-width: 1000px) {
  .event-panel { max-height: none !important; height: auto !important; overflow: visible !important; }
  .custom-scrollbar { overflow-y: visible !important; }
}

.btn-tab { background: transparent; border-top: none; border-left: none; border-right: none; font-size: 0.75rem; letter-spacing: 0.5px; cursor: pointer; border-bottom: 2px solid transparent; }
.btn-tab:hover { color: #3b82f6 !important; }
.border-bottom-2 { border-bottom: 2px solid; }
.active-tab { border-color: #3b82f6 !important; }

/* Grid Gallery Styles */
.events-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.5rem;
}

@media (min-width: 1001px) {
  .events-grid {
    grid-template-columns: 1fr;
    padding: 1rem;
    gap: 1rem;
  }
  .events-grid.is-forced-mobile {
    grid-template-columns: repeat(6, 1fr);
  }
}

.event-card {
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: fit-content;
}

.event-image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: #0f172a;
}

.event-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s ease-in-out;
}

.event-image:hover {
  transform: scale(1.05);
}

.event-badges {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  pointer-events: none;
}

.trigger-dot {
  width: 8px;
  height: 8px;
  box-shadow: 0 0 4px rgba(0,0,0,0.5);
}

.overlay-badge {
  font-size: 0.65rem;
  backdrop-filter: blur(2px);
  background-color: rgba(220, 38, 38, 0.85) !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.delete-btn {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  padding: 0.15rem 0.35rem;
  font-size: 0.75rem;
  background-color: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(2px);
  border-radius: 0.25rem;
  z-index: 2;
}

.delete-btn:hover {
  background-color: rgba(220, 38, 38, 0.9);
  color: white !important;
}

.trigger-text {
  font-size: 0.75rem;
}

.metadata-text {
  font-size: 0.65rem;
}

.time-text {
  font-size: 0.6rem;
}



/* Video Modal */
.video-modal-backdrop {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(0, 0, 0, 0.9);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
}
.video-modal-content {
  position: relative;
  width: 90vw;
  max-width: 800px;
  background-color: black;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0,0,0,0.5);
}
.video-modal-content video {
  max-height: 85vh;
  object-fit: contain;
}
</style>