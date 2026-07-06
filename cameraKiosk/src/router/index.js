import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import KioskDashboard from '../components/KioskDashboard.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/',
      name: 'kiosk',
      component: KioskDashboard,
      meta: { requiresAuth: true }
    }
  ]
})

router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth) {
    if (localStorage.getItem('isLoggedIn') === 'true') {
      next()
    } else {
      next('/login')
    }
  } else {
    next()
  }
})

export default router
