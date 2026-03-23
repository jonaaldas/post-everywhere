export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()
  await auth.ensureChecked()

  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }
})
