import type { MediaItem } from '../../../../src/lib/publisher/types.js'

import { getPost, updatePostStatus } from '../../../../src/db/posts/posts.js'
import { getSocialConnection, updateSocialTokens } from '../../../../src/db/social/social.js'
import { decrypt, encrypt } from '../../../../src/lib/crypto/crypto.js'
import { getPublisher } from '../../../../src/lib/publisher/index.js'
import { refreshAccessToken } from '../../../../src/lib/publisher/refresh.js'
import { requireUser } from '../../../utils/auth.js'
import { jsonError } from '../../../utils/http.js'

function getFilenameFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').pop()
    return filename ? decodeURIComponent(filename) : undefined
  } catch {
    return undefined
  }
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const post = await getPost(getRouterParam(event, 'id') ?? '')

  if (!post) return jsonError(event, 404, 'post not found')
  if (post.userId !== user.sub) return jsonError(event, 403, 'forbidden')
  if (post.status !== 'approved') return jsonError(event, 400, 'post must be approved before publishing')

  const connection = await getSocialConnection(user.sub, post.platform)
  if (!connection) return jsonError(event, 400, `${post.platform} not connected`)

  let accessToken = decrypt(connection.accessToken)
  const publisher = getPublisher(post.platform)

  const refreshAndSave = async () => {
    const refreshToken = connection.refreshToken ? decrypt(connection.refreshToken) : null
    const refreshed = await refreshAccessToken(post.platform, refreshToken)
    accessToken = refreshed.accessToken
    await updateSocialTokens(user.sub, post.platform, {
      accessToken: encrypt(refreshed.accessToken),
      refreshToken: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : undefined,
      tokenExpiresAt: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() : null,
    })
  }

  const REFRESH_BUFFER_MS = 5 * 60 * 1000
  if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt).getTime() < Date.now() + REFRESH_BUFFER_MS) {
    try {
      await refreshAndSave()
    } catch {
      return jsonError(event, 401, `${post.platform} token expired — please reconnect`)
    }
  }

  let mediaItems: MediaItem[] | undefined
  if (post.mediaUrls) {
    try {
      const urls = JSON.parse(post.mediaUrls) as string[]
      if (urls.length) {
        mediaItems = []
        for (const url of urls) {
          const res = await fetch(url)
          if (!res.ok) continue
          const buffer = Buffer.from(await res.arrayBuffer())
          const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
          const type = mimeType.startsWith('video/') ? 'video' : 'image'
          mediaItems.push({ url, buffer, mimeType, type, filename: getFilenameFromUrl(url) })
        }
      }
    } catch {
      mediaItems = undefined
    }
  }

  let result = await publisher.publish(post.content, accessToken, mediaItems)

  if (!result.success && (result.error?.toLowerCase().includes('expired') || result.error?.toLowerCase().includes('reconnect'))) {
    try {
      await refreshAndSave()
      result = await publisher.publish(post.content, accessToken, mediaItems)
    } catch {
      return jsonError(event, 401, `${post.platform} token expired — please reconnect`)
    }
  }

  if (!result.success) {
    if (result.statusCode) {
      return jsonError(event, result.statusCode, result.error ?? 'Publishing failed', {
        retryable: result.retryable ?? false,
      })
    }
    if (result.error?.toLowerCase().includes('rate limit')) {
      return jsonError(event, 429, result.error)
    }
    if (result.error?.toLowerCase().includes('expired') || result.error?.toLowerCase().includes('reconnect')) {
      return jsonError(event, 401, result.error ?? `${post.platform} token expired — please reconnect`)
    }
    return jsonError(event, 500, result.error ?? 'Publishing failed')
  }

  return updatePostStatus(post.id, 'posted')
})
