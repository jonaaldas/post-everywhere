<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { ArrowRight, Layers3, RadioTower, ServerCog } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { fetchChannels, fetchStatus } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'

const workspace = useWorkspaceStore()
const { draftSummary, draftTitle, previewCount, selectedChannel } = storeToRefs(workspace)

const statusQuery = useQuery({
  key: ['status'],
  query: fetchStatus,
})

const channelsQuery = useQuery({
  key: ['channels'],
  query: fetchChannels,
})

const status = computed(() => statusQuery.state.value.data)
const statusLoading = computed(() => statusQuery.asyncStatus.value === 'loading')
const statusFailed = computed(() => statusQuery.state.value.status === 'error')
const statusErrorMessage = computed(() => statusQuery.error.value?.message ?? 'Unknown error')
const channels = computed(() => channelsQuery.state.value.data ?? [])
const activeChannel = computed(() =>
  channels.value.find((channel) => channel.id === selectedChannel.value),
)
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
    <div class="space-y-6">
      <div class="overflow-hidden rounded-[32px] border border-border/70 bg-card/90 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)]">
        <div class="border-b border-border/60 px-6 py-8 sm:px-8">
          <div class="mb-4 flex items-center gap-3">
            <Badge class="rounded-full bg-accent px-3 py-1 text-accent-foreground">
              Frontend ready
            </Badge>
            <span class="text-sm text-muted-foreground">file-based routes + data cache</span>
          </div>

          <h1 class="max-w-xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            A clean Vue shell for shipping the same post across every channel.
          </h1>
          <p class="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            The frontend pairs Vue Router 5 file-based routing with Pinia stores, Pinia Colada
            queries, and shadcn-vue primitives so the product surface stays simple while the stack
            remains scalable.
          </p>
        </div>

        <div class="grid gap-4 px-6 py-6 sm:grid-cols-3 sm:px-8">
          <div class="rounded-2xl border border-border/70 bg-background/80 p-4">
            <div class="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ServerCog class="size-4" />
              API heartbeat
            </div>
            <p class="text-2xl font-semibold tracking-[-0.04em]">
              {{ status?.version ?? '...' }}
            </p>
            <p class="mt-2 text-sm text-muted-foreground">
              {{ status?.name ?? 'Waiting for /api/status' }}
            </p>
          </div>

          <div class="rounded-2xl border border-border/70 bg-background/80 p-4">
            <div class="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Layers3 class="size-4" />
              Preview sessions
            </div>
            <p class="text-2xl font-semibold tracking-[-0.04em]">{{ previewCount }}</p>
            <p class="mt-2 text-sm text-muted-foreground">Tracked in a Pinia store.</p>
          </div>

          <div class="rounded-2xl border border-border/70 bg-background/80 p-4">
            <div class="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <RadioTower class="size-4" />
              Connected channels
            </div>
            <p class="text-2xl font-semibold tracking-[-0.04em]">
              {{ channels.length }}
            </p>
            <p class="mt-2 text-sm text-muted-foreground">Fetched and cached with Colada.</p>
          </div>
        </div>
      </div>

      <Card class="border-border/70 bg-card/85 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.5)]">
        <CardHeader class="space-y-2">
          <CardTitle class="text-2xl tracking-[-0.04em]">Draft workspace</CardTitle>
          <CardDescription>
            Store-backed local state and component primitives in one place.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-5">
          <div class="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground" for="draft-title">Draft title</label>
              <Input
                id="draft-title"
                :model-value="draftTitle"
                placeholder="Write the headline for the next rollout"
                @update:model-value="workspace.setDraftTitle"
              />
            </div>

            <div class="space-y-2">
              <p class="text-sm font-medium text-foreground">Primary channel</p>
              <div class="flex flex-wrap gap-2">
                <Button
                  v-for="channel in channels"
                  :key="channel.id"
                  :variant="selectedChannel === channel.id ? 'default' : 'outline'"
                  class="rounded-full"
                  @click="workspace.selectChannel(channel.id)"
                >
                  {{ channel.label }}
                </Button>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-dashed border-border/80 bg-secondary/60 p-4">
            <p class="text-sm font-medium">Current plan</p>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">
              {{ draftSummary }}
              <span v-if="activeChannel">
                Estimated reach: {{ activeChannel.reach }} and status
                <span class="font-medium text-foreground">{{ activeChannel.state }}</span>.
              </span>
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <Button class="rounded-full px-5" @click="workspace.bumpPreviewCount()">
              Generate preview
              <ArrowRight class="size-4" />
            </Button>
            <Button as-child class="rounded-full px-5" variant="ghost">
              <RouterLink to="/insights">Open stack notes</RouterLink>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card class="border-border/70 bg-card/85 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.5)]">
      <CardHeader class="space-y-2">
        <CardTitle class="text-2xl tracking-[-0.04em]">Live API panel</CardTitle>
        <CardDescription>
          Backed by the Hono app in this workspace through the Vite `/api` proxy.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="rounded-2xl border border-border/70 bg-background/75 p-4">
          <p class="text-xs uppercase tracking-[0.24em] text-muted-foreground">Status</p>
          <p class="mt-3 text-sm leading-6 text-muted-foreground">
            <span v-if="statusLoading">Requesting server metadata...</span>
            <span v-else-if="statusFailed">
              {{ statusErrorMessage }}
            </span>
            <span v-else>
              Uptime {{ status?.uptimeSeconds ?? 0 }}s, routes
              {{ status?.routes.join(', ') }}, database
              {{ status?.database.connected ? 'connected' : 'unavailable' }}
              on {{ status?.database.provider }}.
            </span>
          </p>
        </div>

        <Separator />

        <div class="space-y-3">
          <div
            v-for="channel in channels"
            :key="channel.id"
            class="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
          >
            <div>
              <p class="font-medium">{{ channel.label }}</p>
              <p class="text-sm text-muted-foreground">{{ channel.reach }}</p>
            </div>
            <Badge
              :variant="channel.state === 'ready' ? 'default' : 'secondary'"
              class="rounded-full capitalize"
            >
              {{ channel.state }}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  </section>
</template>
