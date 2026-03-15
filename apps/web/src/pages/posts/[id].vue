<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/composables/useApi'
import { useQueryCache } from '@pinia/colada'

interface Post {
  id: string
  repoFullName: string
  prNumber: number
  prTitle: string
  prDescription: string | null
  platform: 'twitter' | 'linkedin'
  content: string
  status: 'pending' | 'approved' | 'posted' | 'rejected' | 'archived'
  postedAt: string | null
  createdAt: string
}

const route = useRoute()
const router = useRouter()
const queryCache = useQueryCache()
const postId = computed(() => {
  const p = route.params
  if ('id' in p) return p.id as string
  return ''
})

const { data: post, refetch } = useQuery({
  key: () => ['posts', postId.value],
  query: () => api<Post>(`/posts/${postId.value}`),
})

const editContent = ref('')
const showPublishDialog = ref(false)
const actionLoading = ref(false)

watch(
  () => post.value,
  (p) => {
    if (p) editContent.value = p.content
  },
  { immediate: true },
)

const isEditable = computed(() => {
  const s = post.value?.status
  return s === 'pending' || s === 'approved'
})

const hasContentChanges = computed(() => {
  return post.value && editContent.value !== post.value.content
})

async function updatePost(updates: { content?: string; status?: string }) {
  actionLoading.value = true
  try {
    await api(`/posts/${postId.value}`, { method: 'PATCH', body: updates })
    await refetch()
    queryCache.invalidateQueries({ key: ['posts'] })
    toast.success('Post updated')
  } catch (e: any) {
    toast.error(e.data?.message || 'Failed to update')
  } finally {
    actionLoading.value = false
  }
}

async function saveContent() {
  await updatePost({ content: editContent.value })
}

async function approve() {
  await updatePost({ status: 'approved' })
}

async function reject() {
  await updatePost({ status: 'rejected' })
}

async function publish() {
  actionLoading.value = true
  showPublishDialog.value = false
  try {
    await api(`/posts/${postId.value}/publish`, { method: 'POST' })
    await refetch()
    queryCache.invalidateQueries({ key: ['posts'] })
    toast.success('Published successfully!')
  } catch (e: any) {
    const status = e.status || e.statusCode
    if (status === 401) {
      toast.error('Please reconnect your social account in Settings')
    } else if (status === 429) {
      toast.error('Rate limited. Please try again later.')
    } else {
      toast.error(e.data?.message || 'Failed to publish')
    }
  } finally {
    actionLoading.value = false
  }
}

async function archivePost() {
  actionLoading.value = true
  try {
    await api(`/posts/${postId.value}/archive`, { method: 'POST' })
    queryCache.invalidateQueries({ key: ['posts'] })
    toast.success('Post archived')
    router.push('/')
  } catch (e: any) {
    toast.error(e.data?.error || 'Failed to archive')
  } finally {
    actionLoading.value = false
  }
}

async function restorePost() {
  actionLoading.value = true
  try {
    await api(`/posts/${postId.value}/restore`, { method: 'POST' })
    await refetch()
    queryCache.invalidateQueries({ key: ['posts'] })
    toast.success('Post restored')
  } catch (e: any) {
    toast.error(e.data?.error || 'Failed to restore')
  } finally {
    actionLoading.value = false
  }
}

async function duplicatePost() {
  actionLoading.value = true
  try {
    const newPost = await api<Post>(`/posts/${postId.value}/duplicate`, { method: 'POST' })
    queryCache.invalidateQueries({ key: ['posts'] })
    toast.success('Post duplicated')
    router.push(`/posts/${newPost.id}`)
  } catch (e: any) {
    toast.error(e.data?.error || 'Failed to duplicate')
  } finally {
    actionLoading.value = false
  }
}

function platformName(platform: string) {
  return platform === 'twitter' ? 'X' : 'LinkedIn'
}

function statusVariant(status: string) {
  switch (status) {
    case 'posted': return 'default' as const
    case 'approved': return 'secondary' as const
    case 'rejected': return 'destructive' as const
    default: return 'outline' as const
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="space-y-6">
    <Button variant="ghost" size="sm" @click="router.push('/')">
      <ArrowLeft class="mr-1.5 size-4" />
      Back to posts
    </Button>

    <div v-if="!post" class="text-sm text-muted-foreground">Loading...</div>

    <template v-else>
      <Card class="border-border/70 bg-card/85">
        <CardHeader>
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <CardTitle class="text-xl">{{ post.prTitle }}</CardTitle>
              <p class="text-sm text-muted-foreground">
                {{ post.repoFullName }} · PR #{{ post.prNumber }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Badge
                variant="outline"
                :class="post.platform === 'twitter' ? 'border-black bg-black text-white' : 'border-[#0A66C2] bg-[#0A66C2] text-white'"
              >{{ post.platform === 'twitter' ? 'X' : 'LinkedIn' }}</Badge>
              <Badge :variant="statusVariant(post.status)" class="capitalize">{{ post.status }}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <label class="mb-2 block text-sm font-medium">Content</label>
            <Textarea
              v-if="isEditable"
              v-model="editContent"
              class="min-h-[150px]"
            />
            <div v-else class="whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/50 p-4 text-sm">
              {{ post.content }}
            </div>
          </div>

          <div class="text-xs text-muted-foreground">
            Created {{ formatDate(post.createdAt) }}
            <template v-if="post.postedAt"> · Posted {{ formatDate(post.postedAt) }}</template>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-2 border-t border-border/70 pt-4">
            <template v-if="post.status === 'pending'">
              <Button @click="approve" :disabled="actionLoading">Approve</Button>
              <Button variant="destructive" @click="reject" :disabled="actionLoading">Reject</Button>
              <Button variant="outline" @click="archivePost" :disabled="actionLoading">Archive</Button>
            </template>

            <template v-else-if="post.status === 'approved'">
              <Button
                v-if="hasContentChanges"
                variant="outline"
                @click="saveContent"
                :disabled="actionLoading"
              >
                Save changes
              </Button>
              <Button @click="showPublishDialog = true" :disabled="actionLoading">Publish</Button>
              <Button variant="destructive" @click="reject" :disabled="actionLoading">Reject</Button>
              <Button variant="outline" @click="archivePost" :disabled="actionLoading">Archive</Button>
            </template>

            <template v-else-if="post.status === 'rejected'">
              <Button variant="outline" @click="restorePost" :disabled="actionLoading">Restore</Button>
              <Button variant="outline" @click="archivePost" :disabled="actionLoading">Archive</Button>
            </template>

            <template v-else-if="post.status === 'archived'">
              <Button variant="outline" @click="restorePost" :disabled="actionLoading">Restore</Button>
            </template>

            <template v-else-if="post.status === 'posted'">
              <p class="text-sm text-muted-foreground">This post has been published.</p>
              <Button variant="outline" @click="duplicatePost" :disabled="actionLoading">Duplicate & edit</Button>
            </template>
          </div>
        </CardContent>
      </Card>
    </template>

    <!-- Publish confirmation dialog -->
    <Dialog v-model:open="showPublishDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish to {{ platformName(post?.platform ?? '') }}?</DialogTitle>
          <DialogDescription>
            This will post the content to your {{ platformName(post?.platform ?? '') }} account. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showPublishDialog = false">Cancel</Button>
          <Button @click="publish">Publish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
