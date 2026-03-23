import { getSocialConnection } from '../../../src/db/social/social.js'
import { requireUser } from '../../utils/auth.js'

const PLATFORMS = ['twitter', 'linkedin'] as const

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  return Promise.all(
    PLATFORMS.map(async (platform) => {
      const conn = await getSocialConnection(user.sub, platform)
      return {
        platform,
        username: conn?.platformUsername ?? null,
        connected: !!conn,
      }
    }),
  )
})
