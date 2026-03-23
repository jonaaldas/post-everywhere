import { deleteSocialConnection, getSocialConnection } from '../../../src/db/social/social.js'
import { requireUser } from '../../utils/auth.js'
import { jsonError } from '../../utils/http.js'

const PLATFORMS = ['twitter', 'linkedin'] as const

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const platform = getRouterParam(event, 'platform') ?? ''

  if (!(PLATFORMS as readonly string[]).includes(platform)) {
    return jsonError(event, 400, 'unsupported platform')
  }

  if (event.method !== 'DELETE') {
    return jsonError(event, 405, 'method not allowed')
  }

  const connection = await getSocialConnection(user.sub, platform as 'twitter' | 'linkedin')
  if (!connection) {
    return jsonError(event, 404, 'not connected')
  }

  await deleteSocialConnection(user.sub, platform as 'twitter' | 'linkedin')
  return { disconnected: true }
})
