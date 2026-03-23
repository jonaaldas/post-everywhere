import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import { useAuthStore } from './stores/auth'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

const publicRoutes = ['/login', '/register']

let checkedSession = false

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // On first navigation, check if the cookie session is still valid
  if (!checkedSession) {
    checkedSession = true
    await auth.check()
  }

  if (!auth.isAuthenticated && !publicRoutes.includes(to.path)) {
    return '/login'
  }
  if (auth.isAuthenticated && publicRoutes.includes(to.path)) {
    return '/'
  }
})
