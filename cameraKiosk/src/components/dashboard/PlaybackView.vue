<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  events: {
    type: Array,
    default: () => []
  }
})

const isPlaying = ref(false)
const playbackSpeed = ref('1x')
const scrubTime = ref('12:00:00')

// Ref for the scrollable timeline container
const timelineRef = ref(null)

const isDragging = ref(false)
let startX = 0
let scrollLeftStart = 0
let hasMoved = false

const startDrag = (e) => {
  if (e.button !== 0) return
  isDragging.value = true
  startX = e.pageX - timelineRef.value.offsetLeft
  scrollLeftStart = timelineRef.value.scrollLeft
  hasMoved = false
}

const onDrag = (e) => {
  if (!isDragging.value) return
  e.preventDefault()
  const x = e.pageX - timelineRef.value.offsetLeft
  const walk = (x - startX) * 1.5
  timelineRef.value.scrollLeft = scrollLeftStart - walk
  if (Math.abs(x - startX) > 5) {
    hasMoved = true
  }
}

const endDrag = () => {
  isDragging.value = false
}

const handleClipClick = (e, decHour) => {
  if (hasMoved) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
  seekToClip(decHour)
}

// Mock list of clip segments with highlighted timestamps (in hour decimal format, e.g. 10.25 = 10:15)
const mockClips = ref([
  { id: 1, label: 'Motion (Left)', time: '09:42:15', decHour: 9.70, duration: '10s' },
  { id: 2, label: 'Motion (Middle)', time: '12:04:15', decHour: 12.07, duration: '10s' },
  { id: 3, label: 'Motion (Right)', time: '15:10:30', decHour: 15.17, duration: '10s' },
  { id: 4, label: 'On-Demand Rec', time: '17:35:00', decHour: 17.58, duration: '30s' }
])

// Calculate time string based on timeline scroll position
const handleScroll = (e) => {
  const el = e.target
  const scrollPct = el.scrollLeft / (el.scrollWidth - el.clientWidth)
  // Map scroll percentage to 24-hour day (0 to 24 hours)
  const totalSeconds = Math.floor(scrollPct * 24 * 3600)
  
  const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
  const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
  const secs = (totalSeconds % 60).toString().padStart(2, '0')
  
  scrubTime.value = `${hrs}:${mins}:${secs}`
}

// Center the scrollbar initially to ~12:00:00
onMounted(() => {
  if (timelineRef.value) {
    const el = timelineRef.value
    // Scroll to middle (12:00)
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }
})

const seekToClip = (decHour) => {
  if (timelineRef.value) {
    const el = timelineRef.value
    const scrollRange = el.scrollWidth - el.clientWidth
    el.scrollTo({
      left: (decHour / 24) * scrollRange,
      behavior: 'smooth'
    })
  }
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
}

const changeSpeed = () => {
  const speeds = ['1x', '2x', '4x', '16x']
  const nextIdx = (speeds.indexOf(playbackSpeed.value) + 1) % speeds.length
  playbackSpeed.value = speeds[nextIdx]
}

const triggerScreenshot = () => {
  alert('Screenshot saved to Kiosk Library!')
}
</script>

<template>
  <div class="playback-container d-flex flex-column h-100 bg-slate-950 text-slate-200">
    <!-- 1. CCTV Video Feed Viewport -->
    <div class="video-viewport position-relative aspect-ratio-16-9 bg-black overflow-hidden border-bottom border-slate-800">
      <!-- Grid guide lines (classic CCTV feel) -->
      <div class="cctv-grid-overlay w-100 h-100 position-absolute pointer-events-none"></div>

      <!-- CCTV Status Overlays -->
      <div class="position-absolute top-0 start-0 w-100 p-2 d-flex justify-content-between align-items-start z-3 small font-monospace pointer-events-none">
        <div class="d-flex flex-column gap-1">
          <span class="badge rounded bg-danger text-white border border-danger border-opacity-25 px-2 py-0.5 d-flex align-items-center gap-1 font-bold tracking-wider">
            <span class="pulse-dot"></span> {{ isPlaying ? 'PLAYBACK' : 'PAUSED' }}
          </span>
          <span class="text-white opacity-75 extra-small">CAM_01 PLAYBACK</span>
        </div>
        <div class="d-flex flex-column align-items-end gap-1 text-white opacity-75 extra-small">
          <span>{{ scrubTime }}</span>
        </div>
      </div>

      <!-- Playback screen visual content (mock image representation) -->
      <div class="w-100 h-100 d-flex align-items-center justify-content-center cctv-background position-relative">
        <div class="text-center z-2 text-slate-400 p-4">
          <i class="bi bi-camera-video fs-1 mb-2 text-info opacity-75"></i>
          <p class="small font-monospace mb-0">PLAYBACK RESOLVED</p>
          <span class="extra-small opacity-50 font-monospace">TIME: {{ scrubTime }}</span>
        </div>
        <!-- Shadow gradients -->
        <div class="position-absolute bottom-0 start-0 w-100 h-25 bg-gradient-to-t z-1"></div>
      </div>
    </div>

    <!-- 2. Playback Control Bar -->
    <div class="controls-bar d-flex justify-content-between align-items-center px-3 py-2 bg-slate-900 border-bottom border-slate-800">
      <div class="d-flex align-items-center gap-3">
        <!-- Play / Pause -->
        <button @click="togglePlay" class="btn btn-ctrl hover-info" :title="isPlaying ? 'Pause' : 'Play'">
          <i :class="isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill'" class="fs-5"></i>
        </button>
        <!-- Speed -->
        <button @click="changeSpeed" class="btn btn-ctrl text-uppercase font-monospace small px-2 py-0.5 border border-slate-700 rounded hover-info" title="Playback Speed">
          {{ playbackSpeed }}
        </button>
      </div>

      <div class="d-flex align-items-center gap-3">
        <!-- Camera Screenshot -->
        <button @click="triggerScreenshot" class="btn btn-ctrl hover-info" title="Take Screenshot">
          <i class="bi bi-camera-fill fs-6"></i>
        </button>
      </div>
    </div>

    <!-- 3. Xiaomi-Style Horizontal Scrubbing Timeline Tape -->
    <div class="timeline-wrapper bg-slate-950 py-3 border-bottom border-slate-900 position-relative select-none">
      <!-- Digital Clock display above center line -->
      <div class="text-center mb-1">
        <span class="badge bg-slate-900 text-info border border-info border-opacity-25 font-monospace fs-6 px-3 py-1">
          {{ scrubTime }}
        </span>
      </div>

      <!-- Ruler scale container -->
      <div class="position-relative overflow-hidden w-100">
        <!-- Center reference mark line (red scrub pointer) -->
        <div class="timeline-center-cursor position-absolute top-0 start-50 translate-middle-x w-0 h-100 border-start border-danger z-3" style="border-width: 2px;"></div>

        <!-- Hourly Timeline Tape Ruler -->
        <div ref="timelineRef" 
             @scroll="handleScroll" 
             @mousedown="startDrag"
             @mousemove="onDrag"
             @mouseup="endDrag"
             @mouseleave="endDrag"
             class="timeline-scroll-tape d-flex overflow-x-auto overflow-y-hidden custom-scrollbar px-5" 
             :style="{ cursor: isDragging ? 'grabbing' : 'grab', 'user-select': 'none' }">
          <div class="timeline-ruler position-relative d-flex align-items-end pb-1" style="width: 2400px; height: 45px;">
            <!-- Render scale ticks & marks (00:00 to 24:00) -->
            <div v-for="hour in 25" :key="hour" 
                 class="position-absolute d-flex flex-column align-items-center tick-mark" 
                 :style="{ left: ((hour - 1) * 100) + 'px' }">
              <span class="hour-label font-monospace extra-small opacity-50 mb-1">
                {{ (hour - 1).toString().padStart(2, '0') }}:00
              </span>
              <div class="tick-line bg-slate-700" :class="{ 'tick-major': (hour - 1) % 4 === 0 }"></div>
            </div>

            <!-- Highlight strips on the timeline representing motion events -->
            <div v-for="clip in mockClips" :key="clip.id"
                 class="position-absolute motion-highlight-strip"
                 :style="{ left: (clip.decHour * 100) + 'px', width: '25px' }"
                 @click="handleClipClick($event, clip.decHour)">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Recordings Index Selector List -->
    <div class="flex-grow-1 overflow-auto bg-slate-900 custom-scrollbar p-3">
      <h6 class="extra-small text-secondary text-uppercase fw-bold mb-2 tracking-wider">
        <i class="bi bi-clock-history"></i> Today's Recordings Index
      </h6>
      <div class="d-flex flex-column gap-2">
        <div v-for="clip in mockClips" :key="clip.id"
             @click="seekToClip(clip.decHour)"
             class="clip-card d-flex justify-content-between align-items-center p-2 rounded border border-slate-800 hover-bg transition-all pointer">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-play-circle-fill text-warning"></i>
            <div class="d-flex flex-column">
              <span class="small fw-bold">{{ clip.label }}</span>
              <span class="extra-small text-secondary">{{ clip.time }} ({{ clip.duration }})</span>
            </div>
          </div>
          <i class="bi bi-chevron-right text-secondary small"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playback-container {
  height: 100%;
  overflow: hidden;
}

.aspect-ratio-16-9 {
  aspect-ratio: 16 / 9;
}

.extra-small {
  font-size: 0.65rem;
}

.cctv-grid-overlay {
  background-image: 
    linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 25% 25%;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background-color: #ef4444;
  border-radius: 50%;
  display: inline-block;
  animation: pulse 1s infinite alternate;
}

@keyframes pulse {
  0% { opacity: 0.3; }
  100% { opacity: 1; }
}

.cctv-background {
  background-color: #0d1117;
  background-image: radial-gradient(circle, #1a202c 0%, #020617 100%);
}

.bg-gradient-to-t {
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
}

.btn-ctrl {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-ctrl:hover {
  color: #3b82f6;
  transform: scale(1.1);
}

.btn-ctrl:active {
  transform: scale(0.95);
}

.timeline-scroll-tape {
  padding-top: 10px;
  padding-bottom: 10px;
  background: rgba(15, 23, 42, 0.85);
  border-top: 1px solid rgba(59, 130, 246, 0.4);
  border-bottom: 1px solid rgba(59, 130, 246, 0.4);
  box-shadow: inset 0 0 25px rgba(59, 130, 246, 0.12);
  -webkit-mask-image: linear-gradient(to right, transparent, white 15%, white 85%, transparent);
  mask-image: linear-gradient(to right, transparent, white 15%, white 85%, transparent);
}

.timeline-scroll-tape::-webkit-scrollbar {
  height: 4px;
}

.timeline-scroll-tape::-webkit-scrollbar-thumb {
  background-color: rgba(59, 130, 246, 0.5);
  border-radius: 10px;
}

.timeline-ruler {
  border-bottom: 2px solid rgba(148, 163, 184, 0.25);
}

.timeline-center-cursor {
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
  pointer-events: none;
}

.tick-mark {
  bottom: 0;
  transform: translateX(-50%);
  transition: all 0.2s ease;
}

.tick-line {
  width: 1px;
  height: 10px;
  background-color: rgba(148, 163, 184, 0.4) !important;
}

.tick-major {
  width: 2px;
  height: 18px;
  background-color: #3b82f6 !important;
}

.hour-label {
  color: #94a3b8;
  font-weight: 500;
  font-size: 0.65rem;
}

.motion-highlight-strip {
  bottom: 0;
  height: 18px;
  background: linear-gradient(to top, rgba(245, 158, 11, 0.95), rgba(245, 158, 11, 0.5));
  border-left: 1px solid #f59e0b;
  border-right: 1px solid #f59e0b;
  border-radius: 2px;
  box-shadow: 0 0 15px rgba(245, 158, 11, 0.7);
  cursor: pointer;
  z-index: 2;
}

.clip-card {
  background-color: #0f172a;
}

.clip-card:hover {
  background-color: rgba(59, 130, 246, 0.08) !important;
  border-color: #3b82f6 !important;
  transform: translateX(2px);
}

.hover-bg:hover {
  background-color: rgba(255, 255, 255, 0.03) !important;
}

.pointer {
  cursor: pointer;
}

/* Custom scrollbars */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
</style>
