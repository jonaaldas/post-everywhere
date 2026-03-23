import { listPosts } from '../../../src/db/posts/posts.js'
import { requireUser } from '../../utils/auth.js'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : undefined
  const platform = typeof query.platform === 'string' ? query.platform : undefined

  return listPosts(user.sub, { status, platform })
})
