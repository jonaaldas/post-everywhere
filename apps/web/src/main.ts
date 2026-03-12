import { createApp } from 'vue'
import { PiniaColada } from '@pinia/colada'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './styles/globals.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(PiniaColada, {
  queryOptions: {
    staleTime: 30_000,
    gcTime: 300_000,
  },
})
app.use(router)

app.mount('#app')
