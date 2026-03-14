<script setup lang="ts">
import { useQuery } from '@pinia/colada';
import { computed } from 'vue';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { fetchChannels, fetchStatus } from '@/lib/api';

const statusQuery = useQuery({
  key: ['status'],
  query: fetchStatus,
});

const channelsQuery = useQuery({
  key: ['channels'],
  query: fetchChannels,
});

const status = computed(() => statusQuery.state.value.data);
const statusLoading = computed(() => statusQuery.asyncStatus.value === 'loading');
const statusFailed = computed(() => statusQuery.state.value.status === 'error');
const statusErrorMessage = computed(() => statusQuery.error.value?.message ?? 'Unknown error');
const channels = computed(() => channelsQuery.state.value.data ?? []);
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <Card class="border-border/70 bg-card/85">
      <CardHeader>
        <CardTitle class="text-2xl tracking-tight">API Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="statusLoading" class="text-sm text-muted-foreground">Loading...</div>
        <div v-else-if="statusFailed" class="text-sm text-destructive">{{ statusErrorMessage }}</div>
        <div v-else class="space-y-2 text-sm">
          <p><span class="font-medium">Name:</span> {{ status?.name }}</p>
          <p><span class="font-medium">Version:</span> {{ status?.version }}</p>
          <p><span class="font-medium">Uptime:</span> {{ status?.uptimeSeconds }}s</p>
          <p><span class="font-medium">Routes:</span> {{ status?.routes.join(', ') }}</p>
        </div>
      </CardContent>
    </Card>

    <Card class="border-border/70 bg-card/85">
      <CardHeader>
        <CardTitle class="text-2xl tracking-tight">Channels</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <div
          v-for="channel in channels"
          :key="channel.id"
          class="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3"
        >
          <div>
            <p class="font-medium">{{ channel.label }}</p>
            <p class="text-sm text-muted-foreground">{{ channel.reach }}</p>
          </div>
          <Badge :variant="channel.state === 'ready' ? 'default' : 'secondary'" class="rounded-full capitalize">
            {{ channel.state }}
          </Badge>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
