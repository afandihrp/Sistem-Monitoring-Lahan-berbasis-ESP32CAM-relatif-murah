<script setup>
defineProps({
  currentTime: {
    type: String,
    required: true
  },
  wsStatus: {
    type: String,
    required: true
  }
})
</script>

<template>
  <nav class="navbar bg-slate-800 px-3 py-0 border-bottom border-slate-700 z-3" style="min-height: 45px;">
    <div class="container-fluid p-0">
      <a class="navbar-brand fw-bold d-flex align-items-center gap-2 m-0" href="#" style="font-size: 1.1rem;">
        <i class="bi bi-shield-lock-fill text-primary fs-5"></i>
        Gateway_OS
      </a>
      <div class="d-flex align-items-center gap-3">
        <div class="d-flex align-items-center gap-2 border-end pe-2 pe-sm-3 border-slate-700">
          <div class="fw-bold font-monospace lh-1" style="font-size: 0.85rem;">{{ currentTime }}</div>
          <div class="text-secondary" style="font-size: 0.65rem;">
            {{ new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }}
          </div>
        </div>
        <div class="d-flex gap-2 text-secondary" style="font-size: 0.8rem;">
          <span class="d-flex align-items-center gap-1">
            <span :class="wsStatus === 'Online' ? 'text-success' : 'text-danger'" class="fw-bold d-flex align-items-center gap-1">
              <i :class="wsStatus === 'Online' ? 'bi-broadcast text-success' : 'bi-broadcast-pin text-danger'"></i>
              <span class="d-none d-sm-inline">WS:</span> {{ wsStatus }}
            </span>
          </span>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.font-monospace { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }
.bi-shield-lock-fill { filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5)); }

@media (max-width: 480px) {
  .navbar-brand {
    font-size: 0.85rem !important;
  }
  .navbar-brand i {
    font-size: 1rem !important;
  }
  .container-fluid {
    padding-left: 0.4rem !important;
    padding-right: 0.4rem !important;
  }
  .gap-3 {
    gap: 0.5rem !important;
  }
}
</style>
