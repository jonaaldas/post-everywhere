import { getPost, updatePostContent, updatePostMediaUrls, updatePostStatus } from '../../../src/db/posts/posts.js'
import { requireUser } from '../../utils/auth.js'
import { jsonError } from '../../utils/http.js'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = getRouterParam(event, 'id') ?? ''
  const post = await getPost(id)

  if (!post) {
    return jsonError(event, 404, 'post not found')
  }
  if (post.userId !== user.sub) {
    return jsonError(event, 403, 'forbidden')
  }

  if (event.method === 'GET') {
    return post
  }

  if (event.method !== 'PATCH') {
    return jsonError(event, 405, 'method not allowed')
  }

  const body = await readBody<{ content?: string; status?: string; mediaUrls?: string[] }>(event)
  if (!body?.content && !body?.status && !body?.mediaUrls) {
    return jsonError(event, 400, 'content, status, or mediaUrls is required')
  }

  let updated = post
  if (body.content) {
    updated = await updatePostContent(post.id, body.content)
  }
  if (body.mediaUrls !== undefined) {
    updated = await updatePostMediaUrls(post.id, body.mediaUrls)
  }
  if (body.status) {
    updated = await updatePostStatus(post.id, body.status as typeof post.status)
  }

  return updated
})
