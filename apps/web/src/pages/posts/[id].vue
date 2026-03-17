<script setup lang="ts">
import { ArrowLeft, ExternalLink, Upload, X } from 'lucide-vue-next'
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
  mediaUrls: string | null
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
const uploadLoading = ref(false)

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

const mediaUrls = computed<string[]>(() => {
  if (!post.value?.mediaUrls) return []
  try {
    return JSON.parse(post.value.mediaUrls)
  } catch {
    return []
  }
})

function isVideo(url: string) {
  return url.match(/\.mp4$/i)
}

const isLinkedInPost = computed(() => post.value?.platform === 'linkedin')
const hasVideoMedia = computed(() => mediaUrls.value.some((url) => isVideo(url)))
const hasImageMedia = computed(() => mediaUrls.value.some((url) => !isVideo(url)))

function getLinkedInUploadError(file: File) {
  if (!isLinkedInPost.value) return null

  const isVideoFile = file.type === 'video/mp4'
  const isImageFile = ['image/jpeg', 'image/png', 'image/gif'].includes(file.type)

  if (!isVideoFile && !isImageFile) {
    return 'LinkedIn supports JPG, PNG, GIF, or MP4 uploads'
  }
  if (isVideoFile && hasVideoMedia.value) {
    return 'LinkedIn posts support exactly one video'
  }
  if (isVideoFile && hasImageMedia.value) {
    return 'LinkedIn posts cannot mix images and videos'
  }
  if (isImageFile && hasVideoMedia.value) {
    return 'Remove the video before adding LinkedIn images'
  }
  if (isImageFile && mediaUrls.value.length >= 20) {
    return 'LinkedIn posts support up to 20 images'
  }

  return null
}

async function updatePost(updates: { content?: string; status?: string; mediaUrls?: string[] }) {
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

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const linkedInUploadError = getLinkedInUploadError(file)
  if (linkedInUploadError) {
    toast.error(linkedInUploadError)
    input.value = ''
    return
  }

  uploadLoading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const result = await api<{ url: string }>('/media/upload', {
      method: 'POST',
      body: formData,
    })
    const updated = [...mediaUrls.value, result.url]
    await api(`/posts/${postId.value}`, { method: 'PATCH', body: { mediaUrls: updated } })
    await refetch()
    queryCache.invalidateQueries({ key: ['posts'] })
    toast.success('Media uploaded')
  } catch (e: any) {
    toast.error(e.data?.error || 'Upload failed')
  } finally {
    uploadLoading.value = false
    input.value = ''
  }
}

async function removeMedia(url: string) {
  const updated = mediaUrls.value.filter((u) => u !== url)
  await updatePost({ mediaUrls: updated })
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
    } else if (status === 409) {
      toast.error(e.data?.error || 'LinkedIn is still processing the video. Try again shortly.')
    } else if (status === 429) {
      toast.error('Rate limited. Please try again later.')
    } else {
      toast.error(e.data?.error || e.data?.message || 'Failed to publish')
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

const includeMediaInTweet = ref(false)

function openXComposer() {
  if (!post.value) return
  let text = editContent.value || post.value.content
  if (includeMediaInTweet.value && mediaUrls.value.length) {
    text += '\n\n' + mediaUrls.value.join('\n')
  }
  window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
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

          <!-- Save button for pending posts -->
          <div v-if="post.status === 'pending' && hasContentChanges">
            <Button variant="outline" size="sm" @click="saveContent" :disabled="actionLoading">
              Save changes
            </Button>
          </div>

          <!-- Media section -->
          <div v-if="isEditable || mediaUrls.length" class="space-y-3">
            <label class="block text-sm font-medium">Media</label>

            <!-- Media previews -->
            <div v-if="mediaUrls.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div v-for="url in mediaUrls" :key="url" class="group relative overflow-hidden rounded-lg border border-border/70">
                <video v-if="isVideo(url)" :src="url" controls class="aspect-video w-full object-cover" />
                <img v-else :src="url" class="aspect-video w-full object-cover" />
                <button
                  v-if="isEditable"
                  class="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                  @click="removeMedia(url)"
                >
                  <X class="size-3.5" />
                </button>
              </div>
            </div>

            <!-- Upload zone -->
            <div v-if="isEditable" class="relative">
              <label
                class="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground transition hover:border-border hover:bg-muted/30"
                :class="{ 'pointer-events-none opacity-50': uploadLoading }"
              >
                <Upload v-if="!uploadLoading" class="size-4" />
                <span v-if="uploadLoading">Uploading...</span>
                <span v-else>Upload image or video</span>
                <input
                  type="file"
                  class="hidden"
                  accept="image/jpeg,image/png,image/gif,video/mp4"
                  @change="handleFileUpload"
                  :disabled="uploadLoading"
                />
              </label>
              <p class="mt-1 text-xs text-muted-foreground/70">
                JPG, PNG, GIF (max 5MB) or MP4 (max 100MB)
              </p>
              <p v-if="post.platform === 'linkedin'" class="text-xs text-muted-foreground/70">
                LinkedIn supports up to 20 images or exactly 1 MP4 video. Mixed image and video posts are not allowed.
              </p>
            </div>
          </div>

          <div class="text-xs text-muted-foreground">
            Created {{ formatDate(post.createdAt) }}
            <template v-if="post.postedAt"> · Posted {{ formatDate(post.postedAt) }}</template>
          </div>

          <!-- Include media URLs checkbox (for X web composer) -->
          <label v-if="post.platform === 'twitter' && mediaUrls.length" class="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" v-model="includeMediaInTweet" class="size-4 rounded border-border" />
            Include image URLs in tweet
          </label>

          <!-- Action buttons -->
          <div class="flex items-center gap-2 border-t border-border/70 pt-4">
            <template v-if="post.status === 'pending'">
              <Button @click="approve" :disabled="actionLoading">Approve</Button>
              <Button v-if="post.platform === 'twitter'" variant="outline" @click="openXComposer">
                <ExternalLink class="mr-1.5 size-3.5" />
                Post on X
              </Button>
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
              <Button @click="showPublishDialog = true" :disabled="actionLoading">Publish via API</Button>
              <Button v-if="post.platform === 'twitter'" variant="outline" @click="openXComposer">
                <ExternalLink class="mr-1.5 size-3.5" />
                Post on X
              </Button>
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
        <div v-if="mediaUrls.length" class="flex gap-2 overflow-x-auto py-2">
          <div v-for="url in mediaUrls" :key="url" class="shrink-0">
            <video v-if="isVideo(url)" :src="url" class="h-20 rounded" />
            <img v-else :src="url" class="h-20 rounded" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showPublishDialog = false">Cancel</Button>
          <Button @click="publish">Publish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
