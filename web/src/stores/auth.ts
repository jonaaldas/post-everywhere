import { ofetch } from 'ofetch'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface User {
  id: string
  email: string
}

interface AuthResponse {
  user: User
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => !!user.value)

  async function login(email: string, password: string) {
    const data = await ofetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = data.user
  }

  async function register(email: string, password: string) {
    const data = await ofetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    })
    user.value = data.user
  }

  async function logout() {
    await ofetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  /** Check if session is still valid by hitting a protected endpoint. */
  async function check() {
    try {
      const data = await ofetch<AuthResponse>('/api/auth/me', { method: 'GET' })
      user.value = data.user
    } catch {
      user.value = null
    }
  }

  return { user, isAuthenticated, login, register, logout, check }
})
