<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  deviceId: {
    type: String,
    required: true
  },
  imageSrc: {
    type: String,
    default: ''
  },
  boxes: {
    type: Array,
    default: () => []
  },
  aiEnabled: {
    type: Boolean,
    default: true
  },
  detectionMode: {
    type: String,
    default: 'AI'
  }
})

const streamImg = ref(null)
const overlayCanvas = ref(null)

// FPS Counter State
const fps = ref(0)
let frameTimes = []
let fpsInterval = null

const drawBoxes = () => {
  const canvas = overlayCanvas.value
  const img = streamImg.value
  if (!canvas || !img) return

  const ctx = canvas.getContext('2d')
  
  canvas.width = img.clientWidth
  canvas.height = img.clientHeight

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (!props.aiEnabled || !props.boxes || props.boxes.length === 0) return

  // Calculate the exact displayed bounds of the image inside the <img> element
  const getDisplayImageRect = () => {
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const clientWidth = img.clientWidth;
    const clientHeight = img.clientHeight;

    if (!naturalWidth || !naturalHeight || !clientWidth || !clientHeight) {
      return { left: 0, top: 0, width: clientWidth, height: clientHeight };
    }

    const imageRatio = naturalWidth / naturalHeight;
    const elementRatio = clientWidth / clientHeight;

    let width, height, left, top;

    if (elementRatio > imageRatio) {
      // The element is wider than the image: height matches element, width is scaled
      height = clientHeight;
      width = height * imageRatio;
      top = 0;
      left = (clientWidth - width) / 2;
    } else {
      // The element is taller than the image: width matches element, height is scaled
      width = clientWidth;
      height = width / imageRatio;
      left = 0;
      top = (clientHeight - height) / 2;
    }

    return { left, top, width, height };
  }

  const rect = getDisplayImageRect();

  props.boxes.forEach(box => {
    const [x1_norm, y1_norm, x2_norm, y2_norm] = box.posisi
    const conf = box.confidence

    // Scale and shift coordinates relative to the actual displayed camera feed
    const bx1 = rect.left + x1_norm * rect.width
    const by1 = rect.top + y1_norm * rect.height
    const bw = (x2_norm - x1_norm) * rect.width
    const bh = (y2_norm - y1_norm) * rect.height

    // Draw Box
    ctx.strokeStyle = '#ff0000'
    ctx.lineWidth = 2
    ctx.strokeRect(bx1, by1, bw, bh)

    // Draw Label
    const label = props.detectionMode === 'Pixel'
      ? 'Motion'
      : `Person ${Math.round(conf * 100)}%`
    ctx.font = 'bold 11px Arial'
    const textMetrics = ctx.measureText(label)
    const textHeight = 14
    
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(bx1, by1 - textHeight, textMetrics.width + 6, textHeight)
    
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, bx1 + 3, by1 - 4)
  })
}

watch(() => props.boxes, drawBoxes, { deep: true })
watch(() => props.imageSrc, () => {
  // Track new frame timestamp for FPS calculation
  frameTimes.push(performance.now())

  // Wait slightly for the image source change to trigger rendering/layout updates
  setTimeout(drawBoxes, 30)
})

const handleResize = () => {
  drawBoxes()
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  // Initial draw attempt in case image is already cached/loaded
  setTimeout(drawBoxes, 50)

  // Update FPS every 500ms based on frames received in the last 1000ms
  fpsInterval = setInterval(() => {
    const now = performance.now()
    frameTimes = frameTimes.filter(t => now - t < 1000)
    fps.value = frameTimes.length
  }, 500)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (fpsInterval) {
    clearInterval(fpsInterval)
  }
})
</script>

<template>
  <div class="w-100 h-100 position-relative d-flex align-items-center justify-content-center">
    <img :src="imageSrc || `https://via.placeholder.com/640x360/000000/3b82f6?text=WAITING+FOR+STREAM`" 
         class="w-100 h-100 object-fit-contain" 
         ref="streamImg"
         alt="Camera Feed" />
    <canvas ref="overlayCanvas" 
            class="position-absolute pointer-events-none"
            style="pointer-events: none; z-index: 10;">
    </canvas>

    <!-- FPS Meter Badge Overlay -->
    <div v-if="imageSrc" class="fps-meter">
      <span class="fps-dot"></span>
      <span>{{ fps }} FPS</span>
    </div>
  </div>
</template>

<style scoped>
.object-fit-contain { object-fit: contain; }

.fps-meter {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  z-index: 20;
  background-color: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(51, 65, 85, 0.8);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.75rem;
  color: #10b981;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  pointer-events: none;
}

.fps-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: pulse 1.5s infinite alternate;
}

@keyframes pulse {
  0% { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(1.2); opacity: 1; }
}
</style>
