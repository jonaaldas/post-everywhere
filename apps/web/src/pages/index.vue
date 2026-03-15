<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/composables/useApi'

interface Post {
  id: string
  repoFullName: string
  prNumber: number
  prTitle: string
  platform: 'twitter' | 'linkedin'
  content: string
  status: 'pending' | 'approved' | 'posted' | 'rejected'
  postedAt: string | null
  createdAt: string
}

const router = useRouter()
const statusFilter = ref('')
const platformFilter = ref('')

const { data: posts, isLoading } = useQuery({
  key: () => ['posts', statusFilter.value, platformFilter.value],
  query: () => {
    const query: Record<string, string> = {}
    if (statusFilter.value) query.status = statusFilter.value
    if (platformFilter.value) query.platform = platformFilter.value
    return api<Post[]>('/posts', { query })
  },
})

const statusOptions = ['', 'pending', 'approved', 'posted', 'rejected']
const platformOptions = ['', 'twitter', 'linkedin']

function statusVariant(status: string) {
  switch (status) {
    case 'posted': return 'default'
    case 'approved': return 'secondary'
    case 'rejected': return 'destructive'
    default: return 'outline'
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-semibold tracking-tight">Posts</h1>
    </div>

    <div class="flex items-center gap-3">
      <select
        v-model="statusFilter"
        class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
      >
        <option value="">All statuses</option>
        <option v-for="s in statusOptions.slice(1)" :key="s" :value="s" class="capitalize">
          {{ s }}
        </option>
      </select>
      <select
        v-model="platformFilter"
        class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
      >
        <option value="">All platforms</option>
        <option v-for="p in platformOptions.slice(1)" :key="p" :value="p" class="capitalize">
          {{ p }}
        </option>
      </select>
    </div>

    <div v-if="isLoading" class="text-sm text-muted-foreground">Loading posts...</div>

    <div v-else-if="!posts?.length" class="py-16 text-center">
      <FileText class="mx-auto size-12 text-muted-foreground/50" />
      <h2 class="mt-4 text-lg font-medium">No posts yet</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Connect GitHub and watch a repo in
        <RouterLink to="/settings" class="font-medium text-primary hover:underline">Settings</RouterLink>
        to get started.
      </p>
    </div>

    <div v-else class="space-y-3">
      <Card
        v-for="post in posts"
        :key="post.id"
        class="cursor-pointer border-border/70 bg-card/85 transition hover:border-border hover:shadow-md"
        @click="router.push(`/posts/${post.id}`)"
      >
        <CardHeader class="pb-2">
          <div class="flex items-start justify-between gap-3">
            <CardTitle class="text-base font-medium leading-snug">{{ post.prTitle }}</CardTitle>
            <div class="flex shrink-0 items-center gap-2">
              <Badge variant="outline" class="capitalize">{{ post.platform }}</Badge>
              <Badge :variant="statusVariant(post.status)" class="capitalize">{{ post.status }}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p class="line-clamp-2 text-sm text-muted-foreground">{{ post.content }}</p>
          <p class="mt-2 text-xs text-muted-foreground/70">
            {{ post.repoFullName }} · {{ formatDate(post.createdAt) }}
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
