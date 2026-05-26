<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import TopNav from './dashboard/TopNav.vue'
import StreamView from './dashboard/StreamView.vue'
import DeviceList from './dashboard/DeviceList.vue'
import EventLogs from './dashboard/EventLogs.vue'

const currentTime = ref(new Date().toLocaleTimeString())
setInterval(() => {
  currentTime.value = new Date().toLocaleTimeString()
}, 1000)

const wsStatus = ref('Offline')
const aiConnected = ref(false)
const aiEnabled = ref(true)
let ws = null
let pendingActiveStreamId = null

const devices = ref([])
const liveImageSrc = ref('')
const liveBoxes = ref([])
const viewMode = ref('single')
let lastObjectUrl = null

const currentStreamIndex = ref(0)
const currentStream = computed(() => devices.value[currentStreamIndex.value] || { name: 'No Active Stream', ip: 'N/A', status: 'Offline' })
const aiDetecting = computed(() => liveBoxes.value.length > 0)
const visibleBoxes = computed(() => (aiConnected.value && aiEnabled.value) ? liveBoxes.value : [])

watch(aiConnected, (connected) => {
  if (!connected) {
    liveBoxes.value = []
  }
})

watch(aiEnabled, (enabled) => {
  if (!enabled) {
    liveBoxes.value = []
  }
})

const connectWS = () => {
  const backendUrl = `wss://${window.location.hostname}:3000`
  ws = new WebSocket(backendUrl)

  ws.onopen = () => {
    console.log('Connected to WebSocket server')
    wsStatus.value = 'Online'
    ws.send(JSON.stringify({ type: 'set_view_mode', mode: viewMode.value }))
    ws.send(JSON.stringify({ type: 'set_ai_enabled', enabled: aiEnabled.value }))
  }

  ws.onclose = () => {
    console.log('WebSocket connection closed')
    wsStatus.value = 'Offline'
    setTimeout(connectWS, 3000)
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    wsStatus.value = 'Offline'
  }

  ws.onmessage = (event) => {
    if (event.data instanceof Blob) {
      if (lastObjectUrl) {
        URL.revokeObjectURL(lastObjectUrl)
      }
      lastObjectUrl = URL.createObjectURL(event.data)
      liveImageSrc.value = lastObjectUrl
      return
    }

    try {
      const data = JSON.parse(event.data)
      if (data.type === 'active_stream_updated') {
        const index = devices.value.findIndex(d => d.id === data.deviceId)
        if (index !== -1) {
          if (currentStreamIndex.value !== index) {
            currentStreamIndex.value = index
          }
          pendingActiveStreamId = null
        } else {
          pendingActiveStreamId = data.deviceId
        }
      } else if (data.type === 'ai_status') {
        aiConnected.value = data.isConnected
      } else if (data.type === 'ai_enabled_updated') {
        aiEnabled.value = data.enabled
      } else if (data.type === 'device_list') {
        devices.value = data.devices
        if (pendingActiveStreamId) {
          const index = devices.value.findIndex(d => d.id === pendingActiveStreamId)
          if (index !== -1) {
            if (currentStreamIndex.value !== index) {
              currentStreamIndex.value = index
            }
            pendingActiveStreamId = null
          }
        }
      } else if (data.type === 'stream_boxes') {
        if (viewMode.value === 'multiple' && data.deviceId === 'multiple') {
          liveBoxes.value = data.boxes
        } else if (viewMode.value === 'single' && data.deviceId === currentStream.value.id) {
          liveBoxes.value = data.boxes
        }
      } else if (data.type === 'motion_event') {
        events.value.unshift({
          id: Date.now(),
          timestamp: data.timestamp,
          trigger: `Motion (${data.sensor.charAt(0).toUpperCase() + data.sensor.slice(1)})`,
          location: data.location,
          sensor: data.sensor,
          imageUrl: 'https://via.placeholder.com/640x360/1e293b/f8fafc?text=Capturing+Image...'
        })
      } else if (data.type === 'motion_image_update') {
        const eventIndex = events.value.findIndex(e => e.sensor === data.sensor);
        if (eventIndex !== -1) {
          events.value[eventIndex].imageUrl = data.imageUrl;
          events.value[eventIndex].humanPresence = data.humanPresence;
          events.value[eventIndex].aiDetails = data.aiDetails;
        }
      } else if (data.type === 'historical_logs') {
        events.value = data.logs.map((log, index) => {
          return {
            id: `hist_${Date.now()}_${index}`,
            timestamp: log.timestamp, // Keep ISO string
            trigger: log.sensor ? `Motion (${log.sensor.charAt(0).toUpperCase() + log.sensor.slice(1)})` : 'Motion',
            location: log.location || 'Unknown',
            sensor: log.sensor,
            imageUrl: log.imageUrl || 'https://via.placeholder.com/640x360/1e293b/f8fafc?text=Motion+Detected',
            humanPresence: log.humanPresence,
            aiDetails: log.aiDetails
          };
        }).reverse();
      } else if (data.type === 'servo_config_response') {
        window.dispatchEvent(new CustomEvent('servo_config_received', { detail: data }));
      } else if (data.type === 'save_servo_config_success') {
        alert('Servo Configuration Saved Successfully via WebSocket!');
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e)
    }
  }
}

const handleRequestServoConfig = (event) => {
  const { mac } = event.detail;
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'get_servo_config', mac }));
  }
};

onMounted(() => {
  connectWS()
  window.addEventListener('request_servo_config', handleRequestServoConfig);
})

onUnmounted(() => {
  window.removeEventListener('request_servo_config', handleRequestServoConfig);
})

const events = ref([])
const selectedDate = ref(new Date())

const filteredEvents = computed(() => {
  return events.value.filter(event => {
    if (!event.timestamp) return false;
    const eventDate = new Date(event.timestamp);
    return eventDate.toDateString() === selectedDate.value.toDateString();
  });
});

const handleDateSelected = (date) => {
  selectedDate.value = date
  currentEventPage.value = 1 // Reset pagination when date changes
}

const triggerCameraAction = async (direction) => {
  try {
    const response = await fetch(`https://${window.location.hostname}:3000/action?do=${direction}`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
  } catch (error) {
    console.error(`Failed to trigger camera action ${direction}:`, error)
  }
}

const triggerServoAction = (value) => {
  if (ws && ws.readyState === 1 && currentStream.value.id) {
    ws.send(JSON.stringify({ 
      type: 'servo_control', 
      deviceId: currentStream.value.id, 
      value: parseInt(value) 
    }));
  }
}

const handleSetViewMode = (mode) => {
  viewMode.value = mode
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'set_view_mode', mode }))
  }
}

const handleSetAiEnabled = (enabled) => {
  aiEnabled.value = enabled
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'set_ai_enabled', enabled }))
  }
}

const handleSaveServoConfig = (data) => {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ 
      type: 'save_servo_config', 
      mac: data.mac, 
      config: data.config 
    }));
  } else {
    console.error('WebSocket not connected. Cannot save config.')
  }
}

// Mobile Pagination Logic
const currentEventPage = ref(1)
const eventsPerPage = 10
const totalPages = computed(() => Math.ceil(filteredEvents.value.length / eventsPerPage) || 1)

const paginatedEvents = computed(() => {
  const start = (currentEventPage.value - 1) * eventsPerPage
  const end = start + eventsPerPage
  return filteredEvents.value.slice(start, end)
})

const nextPage = () => { if (currentEventPage.value < totalPages.value) currentEventPage.value++ }
const prevPage = () => { if (currentEventPage.value > 1) currentEventPage.value-- }

// Window width tracking
const windowWidth = ref(window.innerWidth)
window.addEventListener('resize', () => { windowWidth.value = window.innerWidth })
</script>

<template>
  <div class="main-wrapper d-flex flex-column" data-bs-theme="dark">
    <TopNav :currentTime="currentTime" :wsStatus="wsStatus" :aiConnected="aiConnected" :aiDetecting="aiDetecting" :aiEnabled="aiEnabled" />

    <main class="row g-0 flex-grow-1" id="main-layout">
      <StreamView 
        :currentStream="currentStream" 
        :liveImageSrc="liveImageSrc"
        :liveBoxes="visibleBoxes"
        :windowWidth="windowWidth"
        :viewMode="viewMode"
        :aiEnabled="aiEnabled"
        @triggerCameraAction="triggerCameraAction"
        @triggerServoAction="triggerServoAction"
        @saveServoConfig="handleSaveServoConfig"
        @setViewMode="handleSetViewMode"
        @setAiEnabled="handleSetAiEnabled"
      />

      <aside class="col-lg-2 sidebar-section d-flex flex-column bg-slate-900 border-start border-slate-700">
        <DeviceList :devices="devices" />
        <EventLogs 
          :events="filteredEvents" 
          :selectedDate="selectedDate"
          :paginatedEvents="paginatedEvents" 
          :currentEventPage="currentEventPage" 
          :totalPages="totalPages" 
          :windowWidth="windowWidth"
          @nextPage="nextPage"
          @prevPage="prevPage"
          @dateSelected="handleDateSelected"
        />      </aside>
    </main>
  </div>
</template>

<style scoped>
.main-wrapper {
  width: 100vw;
  background-color: #0f172a;
}

/* --- DESKTOP --- */
@media (min-width: 1001px) {
  .main-wrapper {
    height: 100vh;
    overflow: hidden;
  }
  #main-layout {
    height: calc(100vh - 45px);
    overflow: hidden;
  }
  .sidebar-section {
    height: 100%;
    overflow-y: auto;
  }
}

/* --- MOBILE --- */
@media (max-width: 1000px) {
  .main-wrapper {
    min-height: 100vh;
    height: auto !important;
    overflow-x: hidden;
  }
  #main-layout {
    flex-direction: column;
    height: auto !important;
  }
  .sidebar-section {
    width: 100% !important;
    border-start: none !important;
    border-top: 1px solid #1e293b;
    height: auto !important;
  }
}
</style>
