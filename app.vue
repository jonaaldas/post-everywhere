<script setup lang="ts">
import { LogOut, Send } from 'lucide-vue-next'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const navigation = [
  { label: 'Posts', to: '/' },
  { label: 'Webhook Logs', to: '/webhook-logs' },
  { label: 'Settings', to: '/settings' },
]

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <Toaster />
  <div class="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_32%),linear-gradient(180deg,_var(--background),_color-mix(in_oklab,var(--background)_84%,white))] text-foreground">
    <div class="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-12 pt-6 sm:px-8 lg:px-10">
      <header
        v-if="auth.isAuthenticated"
        class="mb-10 flex items-center justify-between rounded-[28px] border border-border/70 bg-card/80 p-4 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur sm:px-6"
      >
        <div class="flex items-center gap-6">
          <NuxtLink class="flex items-center gap-2 text-lg font-semibold tracking-[-0.03em] text-foreground" to="/">
            <Send class="size-5" />
            Post Everywhere
          </NuxtLink>

          <nav class="flex items-center gap-1 rounded-full border border-border/70 bg-background/80 p-1">
            <NuxtLink
              v-for="item in navigation"
              :key="item.to"
              :to="item.to"
              :class="[
                'rounded-full px-4 py-1.5 text-sm font-medium transition',
                route.path === item.to
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              ]"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="relative size-9 rounded-full">
              <Avatar class="size-9">
                <AvatarFallback>{{ auth.user?.email?.charAt(0).toUpperCase() }}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <div class="px-2 py-1.5 text-sm text-muted-foreground">
              {{ auth.user?.email }}
            </div>
            <DropdownMenuItem @click="handleLogout">
              <LogOut class="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <NuxtPage />
    </div>
  </div>
</template>
