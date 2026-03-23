import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-03-23',
  devtools: { enabled: false },
  ssr: false,
  components: false,
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/globals.css'],
  imports: {
    imports: [
      { from: '@pinia/colada', name: 'useQuery' },
      { from: '@pinia/colada', name: 'useMutation' },
      { from: '@pinia/colada', name: 'useQueryCache' },
    ],
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
