<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

// Available system settings presets that can be selected to override
const presets = [
  { key: 'pirEnabled', value: true, labelKey: 'pirEnabled_true', icon: 'bi-broadcast', color: 'success' },
  { key: 'pirEnabled', value: false, labelKey: 'pirEnabled_false', icon: 'bi-broadcast-pin', color: 'danger' },
  { key: 'cameraDetectionEnabled', value: true, labelKey: 'cameraDetectionEnabled_true', icon: 'bi-cpu', color: 'info' },
  { key: 'cameraDetectionEnabled', value: false, labelKey: 'cameraDetectionEnabled_false', icon: 'bi-cpu-fill', color: 'danger' },
  { key: 'telegramAlertPir', value: true, labelKey: 'telegramAlertPir_true', icon: 'bi-telegram', color: 'indigo' },
  { key: 'telegramAlertPir', value: false, labelKey: 'telegramAlertPir_false', icon: 'bi-telegram', color: 'danger' },
  { key: 'telegramAlertAi', value: true, labelKey: 'telegramAlertAi_true', icon: 'bi-telegram', color: 'indigo' },
  { key: 'telegramAlertAi', value: false, labelKey: 'telegramAlertAi_false', icon: 'bi-telegram', color: 'danger' },
  { key: 'telegramAlertMotion', value: true, labelKey: 'telegramAlertMotion_true', icon: 'bi-telegram', color: 'indigo' },
  { key: 'telegramAlertMotion', value: false, labelKey: 'telegramAlertMotion_false', icon: 'bi-telegram', color: 'danger' },
  { key: 'udpStreamEnabled', value: true, labelKey: 'udpStreamEnabled_true', icon: 'bi-speedometer2', color: 'warning' },
  { key: 'udpStreamEnabled', value: false, labelKey: 'udpStreamEnabled_false', icon: 'bi-speedometer', color: 'danger' },
  { key: 'webSoundEnabled', value: true, labelKey: 'webSoundEnabled_true', icon: 'bi-volume-up', color: 'success' },
  { key: 'webSoundEnabled', value: false, labelKey: 'webSoundEnabled_false', icon: 'bi-volume-mute', color: 'danger' }
]

const localSchedules = ref([])

// Sync props to local state safely
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    if (JSON.stringify(localSchedules.value) !== JSON.stringify(newVal)) {
      localSchedules.value = JSON.parse(JSON.stringify(newVal))
    }
  } else {
    localSchedules.value = []
  }
}, { immediate: true, deep: true })

const activeDropdownBlockId = ref(null)

// --- SCHEDULER ACTIONS ---
const addScheduleBlock = () => {
  const newBlock = {
    id: 'schedule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name: 'New Schedule ' + (localSchedules.value.length + 1),
    executeTime: '08:00',
    enabled: true,
    settings: {}
  }
  localSchedules.value.push(newBlock)
  triggerUpdate()
}

const removeScheduleBlock = (id) => {
  localSchedules.value = localSchedules.value.filter(s => s.id !== id)
  triggerUpdate()
}

const addSettingOverride = (block, preset) => {
  if (!block.settings) {
    block.settings = {}
  }
  block.settings[preset.key] = preset.value
  activeDropdownBlockId.value = null
  triggerUpdate()
}

const removeSetting = (block, key) => {
  delete block.settings[key]
  triggerUpdate()
}

const triggerUpdate = () => {
  emit('update:modelValue', JSON.parse(JSON.stringify(localSchedules.value)))
}

const updateExecuteHour = (block, hourStr) => {
  const parts = (block.executeTime || '00:00').split(':')
  block.executeTime = `${hourStr.padStart(2, '0')}:${parts[1] || '00'}`
  triggerUpdate()
}

const updateExecuteMinute = (block, minStr) => {
  const parts = (block.executeTime || '00:00').split(':')
  block.executeTime = `${parts[0] || '00'}:${minStr.padStart(2, '0')}`
  triggerUpdate()
}

// Helpers to render active overrides inside block
const getPresetBadgeClass = (key, val) => {
  const preset = presets.find(p => p.key === key && p.value === val)
  if (!preset) return 'bg-secondary text-white'
  
  if (preset.color === 'danger') return 'border-danger bg-danger bg-opacity-10 text-danger'
  if (preset.color === 'success') return 'border-success bg-success bg-opacity-10 text-success'
  if (preset.color === 'info') return 'border-info bg-info bg-opacity-10 text-info'
  if (preset.color === 'warning') return 'border-warning bg-warning bg-opacity-10 text-warning'
  if (preset.color === 'indigo') return 'border-indigo bg-indigo bg-opacity-10 text-indigo'
  return 'border-secondary text-slate-300 bg-slate-800'
}

const getPresetIcon = (key, val) => {
  const preset = presets.find(p => p.key === key && p.value === val)
  return preset ? preset.icon : 'bi-gear'
}

const getPresetTextColorClass = (color) => {
  if (color === 'danger') return 'text-danger'
  if (color === 'success') return 'text-success'
  if (color === 'info') return 'text-info'
  if (color === 'warning') return 'text-warning'
  if (color === 'indigo') return 'text-indigo'
  return 'text-slate-300'
}
</script>

<template>
  <div class="scheduler-layout bg-slate-800 border border-slate-700 rounded p-3 d-flex flex-column w-100">
    <div class="d-flex justify-content-between align-items-center border-bottom border-slate-700 pb-2 mb-3">
      <h6 class="text-white small fw-bold text-uppercase m-0">
        <i class="bi bi-calendar-range me-1 text-info"></i>{{ $t('settings.scheduler.title') }}
      </h6>
      <button 
        type="button" 
        @click="addScheduleBlock" 
        class="btn btn-sm btn-info text-dark fw-bold d-flex align-items-center gap-1"
        style="font-size: 0.65rem;"
      >
        <i class="bi bi-plus-circle-fill"></i>{{ $t('settings.scheduler.addBlock') }}
      </button>
    </div>

    <!-- Schedules List -->
    <div class="schedules-list pe-1 d-flex flex-column gap-3">
      <div v-if="localSchedules.length === 0" class="text-slate-500 text-center py-5">
        <i class="bi bi-calendar-x d-block fs-3 mb-2"></i>
        <span class="small">{{ $t('settings.scheduler.noSchedules') }}</span>
      </div>

      <div 
        v-for="block in localSchedules" 
        :key="block.id"
        class="schedule-card border rounded-3 p-3 bg-slate-900 transition-all position-relative border-slate-700"
      >

        <!-- Card Header / Name -->
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <div class="d-flex align-items-center gap-2 flex-grow-1">
            <span class="text-slate-500" style="font-size: 0.8rem;">
              <i class="bi bi-calendar-event"></i>
            </span>
            <input 
              type="text" 
              v-model="block.name" 
              @input="triggerUpdate"
              class="form-control form-control-sm bg-transparent border-0 text-white fw-bold p-0 shadow-none" 
              style="font-size: 0.8rem; outline: none; border-bottom: 1px dashed rgba(255,255,255,0.15) !important;"
              :placeholder="$t('settings.scheduler.blockName')"
            />
          </div>
          
          <div class="d-flex align-items-center gap-2">
            <div class="form-check form-switch p-0 m-0 d-flex align-items-center">
              <input 
                class="form-check-input custom-switch m-0" 
                style="width: 2.2em; height: 1.1em;" 
                type="checkbox" 
                role="switch" 
                v-model="block.enabled" 
                @change="triggerUpdate"
              />
            </div>
            <button 
              type="button" 
              @click="removeScheduleBlock(block.id)" 
              class="btn btn-link text-danger p-0 shadow-none"
            >
              <i class="bi bi-trash-fill"></i>
            </button>
          </div>
        </div>

        <!-- Card Body: Execution Time -->
        <div class="row g-2 align-items-center mb-3">
          <!-- Execute Time -->
          <div class="col-12 col-sm-6">
            <label class="text-slate-500 text-uppercase fw-bold mb-1" style="font-size: 0.6rem;">{{ $t('settings.scheduler.executeTime') }}</label>
            
            <!-- Mobile: Native Input -->
            <div class="d-sm-none">
              <input 
                type="time" 
                v-model="block.executeTime" 
                @change="triggerUpdate"
                class="form-control form-control-sm bg-slate-800 border-slate-700 text-white text-center font-monospace w-100"
              />
            </div>

            <!-- PC/Tablet: Custom Dropdowns -->
            <div class="d-none d-sm-flex align-items-center gap-1">
              <select 
                class="form-select form-select-sm bg-slate-800 border-slate-700 text-white font-monospace w-auto flex-grow-1"
                :value="(block.executeTime || '00:00').split(':')[0]"
                @change="e => updateExecuteHour(block, e.target.value)"
                style="cursor: pointer;"
              >
                <option v-for="h in 24" :key="'h'+(h-1)" :value="String(h-1).padStart(2, '0')">{{ String(h-1).padStart(2, '0') }}</option>
              </select>
              <span class="text-white fw-bold mx-1">:</span>
              <select 
                class="form-select form-select-sm bg-slate-800 border-slate-700 text-white font-monospace w-auto flex-grow-1"
                :value="(block.executeTime || '00:00').split(':')[1]"
                @change="e => updateExecuteMinute(block, e.target.value)"
                style="cursor: pointer;"
              >
                <option v-for="m in 60" :key="'m'+(m-1)" :value="String(m-1).padStart(2, '0')">{{ String(m-1).padStart(2, '0') }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Settings Overrides Box -->
        <div>
          <div class="d-flex justify-content-between align-items-center mb-1 position-relative">
            <label class="text-slate-500 text-uppercase fw-bold m-0" style="font-size: 0.6rem;">{{ $t('settings.scheduler.settingsOverrides') }}</label>
            
            <!-- Custom Vue Dropdown Selector -->
            <div>
              <button 
                type="button" 
                class="btn btn-link text-info p-0 shadow-none d-flex align-items-center gap-1 text-decoration-none fw-bold" 
                style="font-size: 0.62rem;"
                @click="activeDropdownBlockId = activeDropdownBlockId === block.id ? null : block.id"
              >
                <i class="bi bi-plus-circle-fill"></i>{{ $t('settings.scheduler.addOverride') }}
              </button>
              
              <div 
                v-if="activeDropdownBlockId === block.id"
                class="custom-dropdown-menu position-absolute end-0 bg-slate-900 border border-slate-700 rounded shadow-lg p-1 z-3"
                style="min-width: 200px; max-height: 250px; overflow-y: auto; top: 1.25rem;"
              >
                <button 
                  v-for="preset in presets" 
                  :key="preset.labelKey"
                  class="dropdown-item-custom w-100 text-start border-0 bg-transparent text-slate-300 d-flex align-items-center gap-2 py-1.5 px-2.5 rounded transition-all"
                  type="button" 
                  @click="addSettingOverride(block, preset)"
                >
                  <i class="bi" :class="[preset.icon, getPresetTextColorClass(preset.color)]"></i>
                  <span style="font-size: 0.7rem;">{{ $t(`settings.scheduler.presets.${preset.labelKey}`) }}</span>
                </button>
              </div>
            </div>
          </div>

          <div 
            class="overrides-box p-2 bg-slate-800 border border-slate-700 rounded d-flex flex-wrap gap-1.5 align-items-center position-relative min-height-48"
          >
            <div v-if="!block.settings || Object.keys(block.settings).length === 0" class="text-slate-600 w-100 text-center py-2" style="font-size: 0.65rem;">
              <i class="bi bi-plus-square me-1"></i>No overrides configured. Click "+" above to add overrides.
            </div>
            <div 
              v-for="(val, key) in block.settings" 
              :key="key"
              :class="['badge border d-inline-flex align-items-center gap-1 py-1.5 px-2.5 rounded-2 text-capitalize shadow-sm', getPresetBadgeClass(key, val)]"
              style="font-size: 0.68rem; font-weight: 600;"
            >
              <i :class="['bi', getPresetIcon(key, val)]"></i>
              <span>{{ $t(`settings.scheduler.presets.${key}_${val}`) }}</span>
              <button 
                type="button" 
                @click="removeSetting(block, key)" 
                class="btn-close btn-close-white p-0 ms-1" 
                style="font-size: 0.45rem; width: 0.45rem; height: 0.45rem; opacity: 0.7;"
              ></button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.day-btn {
  border-radius: 50%;
}
.day-btn:hover {
  opacity: 0.85;
}

.overrides-box {
  min-height: 48px;
}

.border-indigo {
  border-color: #6366f1 !important;
}
.bg-indigo {
  background-color: #6366f1 !important;
}
.text-indigo {
  color: #a5b4fc !important;
}
.border-indigo-subtle {
  border-color: #818cf8 !important;
}
.bg-indigo-subtle {
  background-color: #4f46e5 !important;
}



/* Custom time input appearance to match theme */
input[type="time"]::-webkit-calendar-picker-indicator {
  filter: invert(0.8) sepia(1) saturate(5) hue-rotate(150deg);
  cursor: pointer;
}

.custom-dropdown-menu {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5);
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
  z-index: 1050;
}
.custom-dropdown-menu::-webkit-scrollbar {
  width: 4px;
}
.custom-dropdown-menu::-webkit-scrollbar-thumb {
  background-color: #334155;
  border-radius: 2px;
}
.dropdown-item-custom:hover {
  background-color: #1e293b !important;
  color: #22d3ee !important;
}
</style>
