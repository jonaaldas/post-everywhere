<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

import { FileText, Image as ImageIcon } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/composables/useApi'

interface Post {
  id: string
  repoFullName: string
  prNumber: number
  prTitle: string
  platform: 'twitter' | 'linkedin'
  content: string
  status: 'pending' | 'approved' | 'posted' | 'rejected' | 'archived'
  mediaUrls: string | null
  postedAt: string | null
  createdAt: string
}

const router = useRouter()
const platformFilter = ref('')

const { data: posts, isLoading, refetch } = useQuery({
  key: () => ['posts', platformFilter.value],
  query: () => {
    const query: Record<string, string> = {}
    if (platformFilter.value) query.platform = platformFilter.value
    return api<Post[]>('/posts', { query })
  },
})

const { data: archivedPosts, refetch: refetchArchived } = useQuery({
  key: () => ['posts', 'archived', platformFilter.value],
  query: () => {
    const query: Record<string, string> = { status: 'archived' }
    if (platformFilter.value) query.platform = platformFilter.value
    return api<Post[]>('/posts', { query })
  },
})

const draftPosts = computed(() => posts.value?.filter((p) => p.status !== 'posted' && p.status !== 'rejected') ?? [])
const rejectedPosts = computed(() => posts.value?.filter((p) => p.status === 'rejected') ?? [])
const publishedPosts = computed(() => posts.value?.filter((p) => p.status === 'posted') ?? [])

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

function platformClass(platform: string) {
  return platform === 'twitter' ? 'border-black bg-black text-white' : 'border-[#0A66C2] bg-[#0A66C2] text-white'
}

function platformLabel(platform: string) {
  return platform === 'twitter' ? 'X' : 'LinkedIn'
}

function hasMedia(post: Post) {
  if (!post.mediaUrls) return false
  try {
    const urls = JSON.parse(post.mediaUrls)
    return Array.isArray(urls) && urls.length > 0
  } catch {
    return false
  }
}

async function archivePost(e: Event, postId: string) {
  e.stopPropagation()
  try {
    await api(`/posts/${postId}/archive`, { method: 'POST' })
    toast.success('Post archived')
    refetch()
    refetchArchived()
  } catch (err: any) {
    toast.error(err.data?.error || 'Failed to archive')
  }
}

async function restorePost(e: Event, postId: string) {
  e.stopPropagation()
  try {
    await api(`/posts/${postId}/restore`, { method: 'POST' })
    toast.success('Post restored')
    refetch()
    refetchArchived()
  } catch (err: any) {
    toast.error(err.data?.error || 'Failed to restore')
  }
}

async function duplicatePost(e: Event, postId: string) {
  e.stopPropagation()
  try {
    const newPost = await api<Post>(`/posts/${postId}/duplicate`, { method: 'POST' })
    toast.success('Post duplicated')
    refetch()
    router.push(`/posts/${newPost.id}`)
  } catch (err: any) {
    toast.error(err.data?.error || 'Failed to duplicate')
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-semibold tracking-tight">Posts</h1>
    </div>

    <div class="flex items-center gap-3">
      <select
        v-model="platformFilter"
        class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
      >
        <option value="">All platforms</option>
        <option v-for="p in platformOptions.slice(1)" :key="p" :value="p">
          {{ p === 'twitter' ? 'X' : 'LinkedIn' }}
        </option>
      </select>
    </div>

    <div v-if="isLoading" class="text-sm text-muted-foreground">Loading posts...</div>

    <div v-else-if="!posts?.length && !archivedPosts?.length" class="py-16 text-center">
      <FileText class="mx-auto size-12 text-muted-foreground/50" />
      <h2 class="mt-4 text-lg font-medium">No posts yet</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Connect GitHub and watch a repo in
        <RouterLink to="/settings" class="font-medium text-primary hover:underline">Settings</RouterLink>
        to get started.
      </p>
    </div>

    <Tabs v-else default-value="drafts">
      <TabsList>
        <TabsTrigger value="drafts">Drafts ({{ draftPosts.length }})</TabsTrigger>
        <TabsTrigger value="published">Published ({{ publishedPosts.length }})</TabsTrigger>
        <TabsTrigger value="rejected">Rejected ({{ rejectedPosts.length }})</TabsTrigger>
        <TabsTrigger value="archived">Archived ({{ archivedPosts?.length ?? 0 }})</TabsTrigger>
      </TabsList>

      <!-- Drafts tab -->
      <TabsContent value="drafts" class="space-y-3 pt-4">
        <div v-if="!draftPosts.length" class="py-8 text-center text-sm text-muted-foreground">
          No draft posts
        </div>
        <Card
          v-for="post in draftPosts"
          :key="post.id"
          class="cursor-pointer border-border/70 bg-card/85 transition hover:border-border hover:shadow-md"
          @click="router.push(`/posts/${post.id}`)"
        >
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between gap-3">
              <CardTitle class="text-base font-medium leading-snug">{{ post.prTitle }}</CardTitle>
              <div class="flex shrink-0 items-center gap-2">
                <ImageIcon v-if="hasMedia(post)" class="size-4 text-muted-foreground" />
                <Badge variant="outline" :class="platformClass(post.platform)">{{ platformLabel(post.platform) }}</Badge>
                <Badge :variant="statusVariant(post.status)" class="capitalize">{{ post.status }}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p class="line-clamp-2 text-sm text-muted-foreground">{{ post.content }}</p>
            <div class="mt-2 flex items-center justify-between">
              <p class="text-xs text-muted-foreground/70">
                {{ post.repoFullName }} · {{ formatDate(post.createdAt) }}
              </p>
              <Button variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="archivePost($event, post.id)">
                Archive
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Published tab -->
      <TabsContent value="published" class="space-y-3 pt-4">
        <div v-if="!publishedPosts.length" class="py-8 text-center text-sm text-muted-foreground">
          No published posts yet
        </div>
        <Card
          v-for="post in publishedPosts"
          :key="post.id"
          class="cursor-pointer border-border/70 bg-card/85 transition hover:border-border hover:shadow-md"
          @click="router.push(`/posts/${post.id}`)"
        >
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between gap-3">
              <CardTitle class="text-base font-medium leading-snug">{{ post.prTitle }}</CardTitle>
              <div class="flex shrink-0 items-center gap-2">
                <ImageIcon v-if="hasMedia(post)" class="size-4 text-muted-foreground" />
                <Badge variant="outline" :class="platformClass(post.platform)">{{ platformLabel(post.platform) }}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p class="line-clamp-2 text-sm text-muted-foreground">{{ post.content }}</p>
            <div class="mt-2 flex items-center justify-between">
              <p class="text-xs text-muted-foreground/70">
                {{ post.repoFullName }} · Published {{ formatDate(post.postedAt ?? post.createdAt) }}
              </p>
              <Button variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="duplicatePost($event, post.id)">
                Duplicate & edit
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Rejected tab -->
      <TabsContent value="rejected" class="space-y-3 pt-4">
        <div v-if="!rejectedPosts.length" class="py-8 text-center text-sm text-muted-foreground">
          No rejected posts
        </div>
        <Card
          v-for="post in rejectedPosts"
          :key="post.id"
          class="cursor-pointer border-border/70 bg-card/85 transition hover:border-border hover:shadow-md"
          @click="router.push(`/posts/${post.id}`)"
        >
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between gap-3">
              <CardTitle class="text-base font-medium leading-snug">{{ post.prTitle }}</CardTitle>
              <div class="flex shrink-0 items-center gap-2">
                <Badge variant="outline" :class="platformClass(post.platform)">{{ platformLabel(post.platform) }}</Badge>
                <Badge variant="destructive">Rejected</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p class="line-clamp-2 text-sm text-muted-foreground">{{ post.content }}</p>
            <div class="mt-2 flex items-center justify-between">
              <p class="text-xs text-muted-foreground/70">
                {{ post.repoFullName }} · {{ formatDate(post.createdAt) }}
              </p>
              <div class="flex gap-1">
                <Button variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="restorePost($event, post.id)">
                  Restore
                </Button>
                <Button variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="archivePost($event, post.id)">
                  Archive
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Archived tab -->
      <TabsContent value="archived" class="space-y-3 pt-4">
        <div v-if="!archivedPosts?.length" class="py-8 text-center text-sm text-muted-foreground">
          No archived posts
        </div>
        <Card
          v-for="post in archivedPosts"
          :key="post.id"
          class="cursor-pointer border-border/70 bg-card/85 transition hover:border-border hover:shadow-md"
          @click="router.push(`/posts/${post.id}`)"
        >
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between gap-3">
              <CardTitle class="text-base font-medium leading-snug">{{ post.prTitle }}</CardTitle>
              <div class="flex shrink-0 items-center gap-2">
                <ImageIcon v-if="hasMedia(post)" class="size-4 text-muted-foreground" />
                <Badge variant="outline" :class="platformClass(post.platform)">{{ platformLabel(post.platform) }}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p class="line-clamp-2 text-sm text-muted-foreground">{{ post.content }}</p>
            <div class="mt-2 flex items-center justify-between">
              <p class="text-xs text-muted-foreground/70">
                {{ post.repoFullName }} · {{ formatDate(post.createdAt) }}
              </p>
              <Button variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="restorePost($event, post.id)">
                Restore
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>
