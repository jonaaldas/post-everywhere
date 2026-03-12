<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const navigation = [
  { label: 'Overview', to: '/' },
  { label: 'Insights', to: '/insights' },
]
</script>

<template>
  <div class="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_32%),linear-gradient(180deg,_var(--background),_color-mix(in_oklab,var(--background)_84%,white))] text-foreground">
    <div class="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-12 pt-6 sm:px-8 lg:px-10">
      <header class="mb-10 flex flex-col gap-4 rounded-[28px] border border-border/70 bg-card/80 p-4 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <RouterLink class="text-lg font-semibold tracking-[-0.03em] text-foreground" to="/">
            Post Everywhere
          </RouterLink>
          <p class="text-sm text-muted-foreground">
            Vue 3 + Hono starter with file-based routes, smart data fetching, and shadcn-vue primitives.
          </p>
        </div>

        <nav class="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 p-1">
          <RouterLink
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            :class="[
              'rounded-full px-4 py-2 text-sm font-medium transition',
              route.path === item.to
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            ]"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </header>

      <RouterView />
    </div>
  </div>
</template>
