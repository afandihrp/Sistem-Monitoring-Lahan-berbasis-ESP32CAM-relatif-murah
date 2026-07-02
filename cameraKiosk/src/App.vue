<script setup>
<<<<<<< HEAD
// router-view handles the routing of views
</script>

<template>
  <router-view />
=======
import KioskDashboard from './components/KioskDashboard.vue'
</script>

<template>
  <KioskDashboard />
>>>>>>> 9b317bb0485fb444aef9470b6e89e26b4278c804
</template>

<style>
/* Reset Global untuk memastikan Edge-to-Edge benar-benar mentok ke monitor */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: #0f172a; /* Warna slate-900 untuk dasar OS */
}

#app {
  width: 100%;
  height: 100%;
}
</style>