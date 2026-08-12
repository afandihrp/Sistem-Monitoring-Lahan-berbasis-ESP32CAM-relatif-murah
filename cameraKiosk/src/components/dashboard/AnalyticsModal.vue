<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const { locale } = useI18n()

const props = defineProps({
  analyticsData: {
    type: Object,
    default: null
  },
  selectedDate: {
    type: Date,
    required: true
  },
  devices: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close', 'fetchAnalytics'])

// Stats Scope: 'today' or 'all'
const statsScope = ref('today')

watch(statsScope, (newScope) => {
  emit('fetchAnalytics', newScope)
})

onMounted(() => {
  emit('fetchAnalytics', statsScope.value)
})

// KPI Metrics
const totalAlerts = computed(() => props.analyticsData?.totalAlerts || 0)
const humanAlerts = computed(() => props.analyticsData?.humanAlerts || 0)
const videoAlerts = computed(() => props.analyticsData?.videoAlerts || 0)

const humanSuccessRate = computed(() => {
  if (totalAlerts.value === 0) return 0
  return Math.round((humanAlerts.value / totalAlerts.value) * 100)
})

// Translate and clean trigger source names
const translateTrigger = (trigger) => {
  if (!trigger) return 'System';
  let clean = trigger
    .replace(/_ws$/i, '')
    .replace(/Detection/ig, '')
    .trim();
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

// Hourly Alert Distribution (0-23 hours)
const hourlyData = computed(() => {
  return props.analyticsData?.hourlyData || Array(24).fill(0)
})

const maxHourlyCount = computed(() => {
  const max = Math.max(...hourlyData.value)
  return max === 0 ? 1 : max
})

// Hourly labels helper
const getHourLabel = (hour) => {
  return `${String(hour).padStart(2, '0')}:00`
}

const activePieDataType = ref('location') // 'location' or 'sensor'

const pieBreakdown = computed(() => {
  if (!props.analyticsData || !props.analyticsData.breakdown) return []
  
  const rawBreakdown = activePieDataType.value === 'location' 
    ? props.analyticsData.breakdown.location 
    : props.analyticsData.breakdown.sensor;
  
  const breakdown = {};
  if (activePieDataType.value === 'sensor') {
    Object.entries(rawBreakdown).forEach(([trigger, count]) => {
      const name = translateTrigger(trigger);
      breakdown[name] = (breakdown[name] || 0) + count;
    });
  } else {
    Object.assign(breakdown, rawBreakdown);
  }
  
  const total = totalAlerts.value
  if (total === 0) return []
  
  // Convert to array of objects
  const list = Object.entries(breakdown).map(([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / total) * 100)
  }))
  
  // Sort descending
  list.sort((a, b) => b.count - a.count)
  
  return list.map((item, index) => {
    // Choose colors
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#eab308'
    ]
    const color = colors[index % colors.length]
    return { ...item, color }
  })
})

const chartCanvas = ref(null)
const barChartCanvas = ref(null)
let chartInstance = null
let barChartInstance = null

const renderChart = () => {
  if (!chartCanvas.value) return
  if (chartInstance) {
    chartInstance.destroy()
  }

  const labels = pieBreakdown.value.map(item => item.name)
  const data = pieBreakdown.value.map(item => item.count)
  const colors = pieBreakdown.value.map(item => item.color)

  // Inline plugin to draw count on each slice outside the pie
  const sliceLabelsPlugin = {
    id: 'sliceLabels',
    afterDraw(chart) {
      const ctx = chart.ctx
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex)
        meta.data.forEach((arc, index) => {
          const value = dataset.data[index]
          if (!value) return

          const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2
          const outerRadius = arc.outerRadius

          // Tick start: just outside the pie edge
          const tickStart = outerRadius + 4
          // Label position: further out
          const labelRadius = outerRadius + 18

          const cosA = Math.cos(midAngle)
          const sinA = Math.sin(midAngle)

          const x1 = arc.x + cosA * tickStart
          const y1 = arc.y + sinA * tickStart
          const x2 = arc.x + cosA * labelRadius
          const y2 = arc.y + sinA * labelRadius

          // Draw tick line
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.strokeStyle = 'rgba(148,163,184,0.5)'
          ctx.lineWidth = 1
          ctx.stroke()

          // Draw count number
          ctx.textAlign = cosA >= 0 ? 'left' : 'right'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 11px JetBrains Mono, monospace'
          ctx.shadowColor = 'rgba(0,0,0,0.8)'
          ctx.shadowBlur = 3
          ctx.fillText(String(value), x2 + (cosA >= 0 ? 2 : -2), y2)
          ctx.restore()
        })
      })
    }
  }

  chartInstance = new Chart(chartCanvas.value, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 28,
          bottom: 28,
          left: 28,
          right: 28
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          titleFont: {
            family: 'JetBrains Mono, monospace',
            size: 11
          },
          bodyFont: {
            family: 'JetBrains Mono, monospace',
            size: 11
          },
          callbacks: {
            label: (context) => {
              const val = context.raw || 0
              return ` ${val} ${locale.value === 'id' ? 'pemicu' : 'alerts'}`
            }
          }
        }
      }
    },
    plugins: [sliceLabelsPlugin]
  })
}

const renderBarChart = () => {
  if (!barChartCanvas.value) return
  if (barChartInstance) {
    barChartInstance.destroy()
  }

  const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
  const data = hourlyData.value

  barChartInstance = new Chart(barChartCanvas.value, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: locale.value === 'id' ? 'Pemicu' : 'Alerts',
        data: data,
        backgroundColor: '#3b82f6',
        borderRadius: 4,
        borderWidth: 0,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            color: '#94a3b8',
            font: {
              family: 'JetBrains Mono, monospace',
              size: 11
            },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          grid: {
            color: 'rgba(51, 65, 85, 0.3)',
            drawBorder: false
          },
          ticks: {
            color: '#94a3b8',
            font: {
              family: 'JetBrains Mono, monospace',
              size: 11
            },
            precision: 0
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          titleFont: {
            family: 'JetBrains Mono, monospace',
            size: 11
          },
          bodyFont: {
            family: 'JetBrains Mono, monospace',
            size: 11
          }
        }
      }
    }
  })
}

watch(pieBreakdown, async () => {
  await nextTick()
  renderChart()
}, { deep: true })

watch(hourlyData, async () => {
  await nextTick()
  renderBarChart()
}, { deep: true })

onMounted(async () => {
  await nextTick()
  renderChart()
  renderBarChart()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
  if (barChartInstance) {
    barChartInstance.destroy()
  }
})

</script>

<template>
  <div class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 modal-backdrop-overlay" style="background-color: rgba(0,0,0,0.65); z-index: 1050;" @click.self="emit('close')">
    <div class="bg-slate-900 border border-slate-700 rounded-3 shadow-lg p-0 overflow-hidden d-flex flex-column modal-card" style="max-width: 580px; width: 100%; max-height: 85vh;">
      
      <!-- Modal Header -->
      <div class="d-flex justify-content-between align-items-center p-3 border-bottom border-slate-700 bg-slate-800">
        <h6 class="text-white mb-0 fw-bold d-flex align-items-center gap-2">
          <i class="bi bi-graph-up-arrow text-info"></i>
          {{ $t('events.analytics') }}
        </h6>
        <button @click="emit('close')" class="btn-close btn-close-white shadow-none" style="cursor: pointer;"></button>
      </div>

      <!-- Scope Switcher Bar -->
      <div class="bg-slate-850 px-3 py-2 border-bottom border-slate-800 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span class="text-slate-400 font-monospace" style="font-size: 0.7rem; font-weight: bold; text-transform: uppercase;">
          {{ locale === 'id' ? 'Cakupan Analisis' : 'Analytics Scope' }}
        </span>
        <div class="btn-group border border-slate-700 rounded overflow-hidden" style="padding: 1px; background-color: #0f172a;">
          <button @click="statsScope = 'today'" :class="['btn btn-sm px-2 py-1 border-0 shadow-none', statsScope === 'today' ? 'btn-primary text-white' : 'text-slate-400 bg-transparent']" style="font-size: 0.65rem; cursor: pointer; font-weight: bold;">
            {{ locale === 'id' ? 'Hari' : 'Today' }}
          </button>
          <button @click="statsScope = 'month'" :class="['btn btn-sm px-2 py-1 border-0 shadow-none', statsScope === 'month' ? 'btn-primary text-white' : 'text-slate-400 bg-transparent']" style="font-size: 0.65rem; cursor: pointer; font-weight: bold;">
            {{ locale === 'id' ? 'Bulan' : 'Month' }}
          </button>
          <button @click="statsScope = 'year'" :class="['btn btn-sm px-2 py-1 border-0 shadow-none', statsScope === 'year' ? 'btn-primary text-white' : 'text-slate-400 bg-transparent']" style="font-size: 0.65rem; cursor: pointer; font-weight: bold;">
            {{ locale === 'id' ? 'Tahun' : 'Year' }}
          </button>
          <button @click="statsScope = 'all'" :class="['btn btn-sm px-2 py-1 border-0 shadow-none', statsScope === 'all' ? 'btn-primary text-white' : 'text-slate-400 bg-transparent']" style="font-size: 0.65rem; cursor: pointer; font-weight: bold;">
            {{ locale === 'id' ? 'Semua' : 'All' }}
          </button>
        </div>
      </div>

      <!-- Modal Body -->
      <div class="flex-grow-1 overflow-auto p-3 d-flex flex-column gap-3 scroll-container custom-scrollbar">
        
        <!-- KPI Cards Grid -->
        <div class="row g-2">
          <div class="col-4">
            <div class="p-2.5 rounded bg-slate-800 border border-slate-700 text-center">
              <span class="text-secondary extra-small font-bold text-uppercase d-block mb-1 tracking-wider">
                {{ locale === 'id' ? 'Total Pemicu' : 'Total Alerts' }}
              </span>
              <span class="fs-4 fw-extrabold text-white font-monospace d-block">{{ totalAlerts }}</span>
            </div>
          </div>
          <div class="col-4">
            <div class="p-2.5 rounded bg-slate-800 border border-slate-700 text-center">
              <span class="text-secondary extra-small font-bold text-uppercase d-block mb-1 tracking-wider">
                {{ locale === 'id' ? 'Deteksi Manusia' : 'Human Alerts' }}
              </span>
              <span class="fs-4 fw-extrabold text-danger font-monospace d-block">
                {{ humanAlerts }}
              </span>
            </div>
          </div>
          <div class="col-4">
            <div class="p-2.5 rounded bg-slate-800 border border-slate-700 text-center">
              <span class="text-secondary extra-small font-bold text-uppercase d-block mb-1 tracking-wider">
                {{ locale === 'id' ? 'Klip Video' : 'Video Clips' }}
              </span>
              <span class="fs-4 fw-extrabold text-info font-monospace d-block">{{ videoAlerts }}</span>
            </div>
          </div>
        </div>

        <div v-if="totalAlerts > 0" class="d-flex flex-column gap-3">
          
          <!-- Dual-Purpose Pie Chart (full width) -->
          <div class="p-3 bg-slate-800 rounded border border-slate-700">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-slate-400 small fw-bold text-uppercase">
                {{ activePieDataType === 'location' 
                  ? (locale === 'id' ? 'Distribusi Lokasi' : 'Location Distribution') 
                  : (locale === 'id' ? 'Distribusi Sensor' : 'Sensor Distribution') 
                }}
              </span>
              <!-- Toggle buttons -->
              <div class="btn-group border border-slate-700 rounded overflow-hidden" style="padding: 1px; background-color: #0f172a;">
                <button @click="activePieDataType = 'location'" :class="['btn btn-sm px-2 py-0.5 border-0 shadow-none', activePieDataType === 'location' ? 'btn-info text-dark' : 'text-slate-400 bg-transparent']" style="font-size: 0.6rem; cursor: pointer; font-weight: bold;">
                  {{ locale === 'id' ? 'Lokasi' : 'Location' }}
                </button>
                <button @click="activePieDataType = 'sensor'" :class="['btn btn-sm px-2 py-0.5 border-0 shadow-none', activePieDataType === 'sensor' ? 'btn-info text-dark' : 'text-slate-400 bg-transparent']" style="font-size: 0.6rem; cursor: pointer; font-weight: bold;">
                  {{ locale === 'id' ? 'Sensor' : 'Sensor' }}
                </button>
              </div>
            </div>
            <!-- Chart.js Canvas wrapper -->
            <div class="position-relative w-100" style="height: 30vh; min-height: 220px; max-height: 350px;">
              <canvas ref="chartCanvas"></canvas>
            </div>
            <!-- Custom Scrollable Legend -->
            <div class="d-flex flex-wrap justify-content-center gap-2 mt-3 w-100 overflow-auto scroll-container custom-scrollbar" style="font-size: 0.65rem; max-height: 70px;">
              <div v-for="slice in pieBreakdown" :key="slice.name" class="d-flex align-items-center gap-1.5 px-2 py-1 rounded border border-slate-700 bg-slate-900">
                <span class="rounded-circle animate-pulse" :style="{ backgroundColor: slice.color, width: '8px', height: '8px', display: 'inline-block' }"></span>
                <span class="text-slate-300 font-monospace text-truncate" style="max-width: 90px;" :title="slice.name">{{ slice.name }}</span>
                <span class="text-slate-400 font-monospace fw-bold">{{ slice.count }} ({{ slice.percentage }}%)</span>
              </div>
            </div>
          </div>

          <!-- Bottom Section: Hourly alert distribution -->
          <div class="p-3 bg-slate-800 rounded border border-slate-700">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-slate-400 small fw-bold text-uppercase">
                {{ locale === 'id' ? 'Tren Aktivitas Jam' : 'Hourly Activity Trend' }}
              </span>
              <span class="text-secondary font-monospace" style="font-size: 0.6rem;">24 Hours</span>
            </div>
            
            <!-- Chart.js Bar Chart -->
            <div class="position-relative w-100" style="height: 210px;">
              <canvas ref="barChartCanvas"></canvas>
            </div>
          </div>

        </div>

        <!-- No data view -->
        <div v-else class="h-100 py-5 d-flex flex-column align-items-center justify-content-center text-secondary opacity-30 text-center">
          <i class="bi bi-bar-chart-fill fs-1 mb-2"></i>
          <span class="small fw-bold text-uppercase" style="letter-spacing: 2px;">
            {{ locale === 'id' ? 'Tidak ada data untuk periode ini' : 'No analytics for this period' }}
          </span>
        </div>

      </div>

    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

.bg-slate-850 {
  background-color: #162032;
}

.extra-small {
  font-size: 0.625rem;
}

.font-monospace {
  font-family: 'JetBrains Mono', ui-monospace, monospace !important;
}

.modal-backdrop-overlay {
  backdrop-filter: blur(4px);
}
</style>
