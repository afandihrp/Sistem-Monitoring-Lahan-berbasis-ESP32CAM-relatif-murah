<script setup>
import { ref, onMounted, watch, nextTick, computed } from 'vue'

const props = defineProps({
  selectedDate: {
    type: Date,
    required: true
  }
})

const emit = defineEmits(['dateSelected'])

const dates = ref([])
const activeIndex = ref(0)
const scrollContainer = ref(null)
let isProgrammaticScroll = false
let isTouching = false

const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
}

const generateDatesForMonth = (date) => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  
  const dateList = []
  for (let i = 1; i <= daysInMonth; i++) {
    dateList.push(new Date(year, month, i))
  }
  dates.value = dateList
}

const handleScroll = () => {
  if (isProgrammaticScroll || !scrollContainer.value) return
  
  const scrollLeft = scrollContainer.value.scrollLeft
  const newIndex = Math.round(scrollLeft / 50)
  
  if (newIndex >= 0 && newIndex < dates.value.length && newIndex !== activeIndex.value) {
    activeIndex.value = newIndex
  }
}

const handleTouchStart = () => {
  isTouching = true
}

const handleTouchEnd = () => {
  if (!isTouching) return
  isTouching = false

  if (scrollContainer.value) {
    const scrollLeft = scrollContainer.value.scrollLeft
    const finalIndex = Math.round(scrollLeft / 50)
    const clampedIndex = Math.max(0, Math.min(dates.value.length - 1, finalIndex))

    activeIndex.value = clampedIndex
    emit('dateSelected', dates.value[clampedIndex])
    scrollToActive()
  }
}

const selectDate = (index) => {
  if (index < 0 || index >= dates.value.length) return
  activeIndex.value = index
  emit('dateSelected', dates.value[index])
  scrollToActive()
}

const scrollToActive = () => {
  if (!scrollContainer.value) return
  isProgrammaticScroll = true

  const targetLeft = activeIndex.value * 50

  scrollContainer.value.scrollTo({
    left: targetLeft,
    behavior: 'smooth'
  })

  setTimeout(() => {
    isProgrammaticScroll = false
  }, 500)
}

const shiftDate = (dir) => {
  const targetIndex = activeIndex.value + dir
  if (targetIndex < 0) {
    changeMonth(-1, 'last')
  } else if (targetIndex >= dates.value.length) {
    changeMonth(1, 'first')
  } else {
    selectDate(targetIndex)
  }
}

const changeMonth = (offset, selectDay = null) => {
  const newDate = new Date(props.selectedDate)
  newDate.setMonth(newDate.getMonth() + offset)
  
  if (selectDay === 'first') {
    newDate.setDate(1)
  } else if (selectDay === 'last') {
    const maxDays = getDaysInMonth(newDate.getFullYear(), newDate.getMonth())
    newDate.setDate(maxDays)
  } else {
    const originalDay = props.selectedDate.getDate()
    const maxDays = getDaysInMonth(newDate.getFullYear(), newDate.getMonth())
    if (originalDay > maxDays) {
      newDate.setDate(maxDays)
    } else {
      newDate.setDate(originalDay)
    }
  }
  
  emit('dateSelected', newDate)
}

const currentMonthYearLabel = computed(() => {
  return props.selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

onMounted(() => {
  generateDatesForMonth(props.selectedDate)
  nextTick(() => {
    scrollToActive()
  })
})

watch(() => props.selectedDate, (newDate) => {
  const currentFirstOf = dates.value.length > 0 ? dates.value[0] : null
  if (!currentFirstOf || 
      currentFirstOf.getFullYear() !== newDate.getFullYear() || 
      currentFirstOf.getMonth() !== newDate.getMonth()) {
    generateDatesForMonth(newDate)
  }
  
  const index = dates.value.findIndex(d => d.getDate() === newDate.getDate())
  if (index !== -1 && index !== activeIndex.value) {
    activeIndex.value = index
    nextTick(() => {
      scrollToActive()
    })
  }
}, { immediate: true })
</script>

<template>
  <div class="date-sorter bg-slate-900 border-bottom border-slate-700 py-2">
    <!-- Month and Year Switcher Above Tape -->
    <div class="d-flex align-items-center justify-content-center gap-3 mb-2">
      <button @click="changeMonth(-1)" class="btn btn-link text-primary p-1 shadow-none border-0">
        <i class="bi bi-chevron-left fs-5"></i>
      </button>
      <span class="text-white fw-bold text-uppercase font-monospace" style="font-size: 0.85rem; letter-spacing: 1px;">
        {{ currentMonthYearLabel }}
      </span>
      <button @click="changeMonth(1)" class="btn btn-link text-primary p-1 shadow-none border-0">
        <i class="bi bi-chevron-right fs-5"></i>
      </button>
    </div>

    <div class="d-flex align-items-center px-1">
      <!-- Left Arrow (Shifts Day / Month) -->
      <button @click="shiftDate(-1)" class="btn btn-link text-primary p-1 z-3 shadow-none border-0">
        <i class="bi bi-chevron-left fs-4"></i>
      </button>

      <!-- Wrapper for Centering Overlay correctly -->
      <div class="position-relative flex-grow-1 overflow-hidden" style="height: 60px;">
        <!-- Scroll Container -->
        <div 
          ref="scrollContainer"
          @scroll="handleScroll"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
          @mousedown="handleTouchStart"
          @mouseup="handleTouchEnd"
          @mouseleave="handleTouchEnd"
          class="date-scroll-container d-flex h-100 overflow-auto hide-scrollbar"
          style="-webkit-overflow-scrolling: touch; padding: 0 calc(50% - 25px);"
        >
          <div 
            v-for="(date, index) in dates" 
            :key="date.getDate()"
            @click="selectDate(index)"
            :class="['date-item', { 'active': index === activeIndex }]"
            class="d-flex flex-column align-items-center justify-content-center flex-shrink-0"
          >
            <span class="month-year text-uppercase font-monospace text-secondary" style="font-size: 0.6rem;">
              {{ date.toLocaleDateString('en-US', { weekday: 'short' }) }}
            </span>
            <span class="day-text fw-bold" :class="index === activeIndex ? 'text-primary' : 'text-slate-400'">
              {{ date.getDate() }}
            </span>
          </div>
        </div>

        <!-- Selection Box Overlay (Middle of Wrapper) -->
        <div class="selection-box-overlay position-absolute top-50 start-50 translate-middle border border-primary border-opacity-50 border-2 rounded pe-none" style="width: 52px; height: 58px; z-index: 0; pointer-events: none;"></div>
      </div>

      <!-- Right Arrow (Shifts Day / Month) -->
      <button @click="shiftDate(1)" class="btn btn-link text-primary p-1 z-3 shadow-none border-0">
        <i class="bi bi-chevron-right fs-4"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.date-sorter {
  user-select: none;
  background-color: #0f172a; 
}
.date-scroll-container {
  scroll-behavior: smooth;
  gap: 0; /* Remove gap to make padding calculation precise */
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.date-item {
  width: 50px;
  min-width: 50px;
  height: 100%;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
  opacity: 0.5;
}
.date-item.active {
  transform: scale(1.1);
  opacity: 1;
}
.day-text {
  font-size: 1.3rem;
  line-height: 1;
}
.month-year {
  margin-bottom: 2px;
  font-weight: 500;
}
.selection-box-overlay {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.02) 100%);
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.15);
}
</style>
