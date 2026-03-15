<script setup lang="ts">
import { ScrollText } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
} from '@/components/ui/table'
import { api } from '@/composables/useApi'

interface WebhookLog {
  id: string
  eventType: string
  source: string
  requestHeaders: string
  requestBody: string
  responseBody: string
  statusCode: number
  createdAt: string
}

const { data: logs, isLoading } = useQuery({
  key: ['webhook-logs'],
  query: () => api<WebhookLog[]>('/webhook-logs'),
})

const dialogOpen = ref(false)
const dialogTitle = ref('')
const dialogContent = ref('')

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function showDetail(title: string, content: string) {
  dialogTitle.value = title
  dialogContent.value = formatJson(content)
  dialogOpen.value = true
}

function truncate(str: string, len = 60): string {
  return str.length > len ? str.slice(0, len) + '...' : str
}

function statusVariant(code: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (code >= 200 && code < 300) return 'default'
  if (code >= 400 && code < 500) return 'outline'
  return 'destructive'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div class="container mx-auto max-w-6xl py-8 px-4 space-y-6">
    <div class="flex items-center gap-3">
      <ScrollText class="h-6 w-6" />
      <h1 class="text-2xl font-bold">Webhook Logs</h1>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Recent Webhook Requests</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="isLoading" class="text-muted-foreground text-sm py-8 text-center">
          Loading...
        </div>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>Response</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableEmpty v-if="!logs?.length" :colspan="6">
              No webhook logs yet.
            </TableEmpty>
            <TableRow v-for="log in logs" :key="log.id">
              <TableCell class="whitespace-nowrap text-sm">
                {{ formatTime(log.createdAt) }}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{{ log.source }}</Badge>
              </TableCell>
              <TableCell class="text-sm">{{ log.eventType }}</TableCell>
              <TableCell>
                <Badge :variant="statusVariant(log.statusCode)">
                  {{ log.statusCode }}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  class="font-mono text-xs h-auto py-1"
                  @click="showDetail('Request Body', log.requestBody)"
                >
                  {{ truncate(log.requestBody) }}
                </Button>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  class="font-mono text-xs h-auto py-1"
                  @click="showDetail('Response Body', log.responseBody)"
                >
                  {{ truncate(log.responseBody) }}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{{ dialogTitle }}</DialogTitle>
          <DialogDescription>Full JSON payload</DialogDescription>
        </DialogHeader>
        <pre class="bg-muted rounded-md p-4 text-sm font-mono whitespace-pre-wrap break-all overflow-auto max-h-[60vh]">{{ dialogContent }}</pre>
      </DialogContent>
    </Dialog>
  </div>
</template>
