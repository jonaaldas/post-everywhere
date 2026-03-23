import { getPost, updatePostStatus } from '../../../../src/db/posts/posts.js'
import { requireUser } from '../../../utils/auth.js'
import { jsonError } from '../../../utils/http.js'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const post = await getPost(getRouterParam(event, 'id') ?? '')

  if (!post) return jsonError(event, 404, 'post not found')
  if (post.userId !== user.sub) return jsonError(event, 403, 'forbidden')
  if (post.status !== 'archived' && post.status !== 'rejected') {
    return jsonError(event, 400, 'only archived or rejected posts can be restored')
  }

  return updatePostStatus(post.id, 'pending')
})
