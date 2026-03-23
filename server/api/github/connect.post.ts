import { saveConnection } from '../../../src/db/github/github.js'
import { encrypt } from '../../../src/lib/crypto/crypto.js'
import { cacheDel } from '../../../src/lib/redis/redis.js'
import { verifyPat } from '../../../src/lib/github/github.js'
import { requireUser } from '../../utils/auth.js'
import { jsonError } from '../../utils/http.js'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ pat?: string }>(event)

  if (!body?.pat) {
    return jsonError(event, 400, 'pat is required')
  }

  try {
    const { login } = await verifyPat(body.pat)
    await saveConnection(crypto.randomUUID(), user.sub, encrypt(body.pat), login)
    await cacheDel(`github:repos:${user.sub}`).catch(() => {})
    return { connected: true, githubUsername: login }
  } catch {
    return jsonError(event, 401, 'invalid GitHub PAT')
  }
})
