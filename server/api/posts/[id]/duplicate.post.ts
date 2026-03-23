import { duplicatePost, getPost } from '../../../../src/db/posts/posts.js'
import { requireUser } from '../../../utils/auth.js'
import { jsonError } from '../../../utils/http.js'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const post = await getPost(getRouterParam(event, 'id') ?? '')

  if (!post) return jsonError(event, 404, 'post not found')
  if (post.userId !== user.sub) return jsonError(event, 403, 'forbidden')

  setResponseStatus(event, 201)
  return duplicatePost(post.id)
})
