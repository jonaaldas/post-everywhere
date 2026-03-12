<script setup lang="ts">
import { Braces, DatabaseZap, Route } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useWorkspaceStore } from '@/stores/workspace'

const workspace = useWorkspaceStore()
const { draftTitle, previewCount, selectedChannel } = storeToRefs(workspace)

const stackNotes = [
  {
    title: 'Routing',
    description: 'Vue Router 5 handles file-based pages from src/pages through the official Vite plugin.',
    icon: Route,
  },
  {
    title: 'State',
    description: 'Pinia owns local editing state while the route shell stays thin.',
    icon: Braces,
  },
  {
    title: 'Data',
    description: 'Pinia Colada caches API calls, deduplicates requests, and keeps refresh logic predictable.',
    icon: DatabaseZap,
  },
]
</script>

<template>
  <section class="space-y-6">
    <div class="rounded-[32px] border border-border/70 bg-card/90 p-6 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.5)] sm:p-8">
      <p class="text-sm uppercase tracking-[0.24em] text-muted-foreground">Stack notes</p>
      <h1 class="mt-4 text-4xl font-semibold tracking-[-0.05em]">What ships in this starter</h1>
      <p class="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        This view exists mostly to prove the file-based router and shared store are both working.
        Update the draft on the overview screen and the values below stay in sync.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <Card
        v-for="note in stackNotes"
        :key="note.title"
        class="border-border/70 bg-card/85 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.5)]"
      >
        <CardHeader>
          <div class="flex size-12 items-center justify-center rounded-2xl bg-accent/70 text-accent-foreground">
            <component :is="note.icon" class="size-5" />
          </div>
          <CardTitle class="pt-4 text-xl tracking-[-0.03em]">{{ note.title }}</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm leading-6 text-muted-foreground">{{ note.description }}</p>
        </CardContent>
      </Card>
    </div>

    <Card class="border-border/70 bg-card/85 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.5)]">
      <CardHeader>
        <CardTitle class="text-2xl tracking-[-0.04em]">Shared state snapshot</CardTitle>
        <CardDescription>These values come from the same Pinia store used on the overview route.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-border/70 bg-background/75 p-4">
          <p class="text-sm text-muted-foreground">Draft</p>
          <p class="mt-2 font-medium">{{ draftTitle }}</p>
        </div>
        <div class="rounded-2xl border border-border/70 bg-background/75 p-4">
          <p class="text-sm text-muted-foreground">Primary channel</p>
          <p class="mt-2 font-medium uppercase">{{ selectedChannel }}</p>
        </div>
        <div class="rounded-2xl border border-border/70 bg-background/75 p-4">
          <p class="text-sm text-muted-foreground">Preview count</p>
          <p class="mt-2 font-medium">{{ previewCount }}</p>
        </div>
      </CardContent>
    </Card>
  </section>
</template>
