import { randomUUID } from 'node:crypto'

import { env } from '../../../../src/env.js'
import { requireUser } from '../../../utils/auth.js'
import { jsonError } from '../../../utils/http.js'
import { oauthStates } from '../../../utils/social-oauth.js'

const PLATFORMS = ['twitter', 'linkedin'] as const
type Platform = (typeof PLATFORMS)[number]

function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value)
}

function getCallbackUrl(platform: Platform) {
  return `${env.appBaseUrl}/api/social/${platform}/callback`
}

export default defineEventHandler((event) => {
  const user = requireUser(event)
  const platform = getRouterParam(event, 'platform') ?? ''

  if (!isPlatform(platform)) {
    return jsonError(event, 400, 'unsupported platform')
  }

  const state = randomUUID()
  const codeVerifier = randomUUID()
  oauthStates.set(state, { userId: user.sub, codeVerifier, ts: Date.now() })

  if (platform === 'twitter') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.twitterClientId,
      redirect_uri: getCallbackUrl('twitter'),
      scope: 'tweet.read tweet.write users.read offline.access media.write',
      state,
      code_challenge: codeVerifier,
      code_challenge_method: 'plain',
    })

    return { authUrl: `https://x.com/i/oauth2/authorize?${params}` }
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.linkedinClientId,
    redirect_uri: getCallbackUrl('linkedin'),
    scope: 'profile openid w_member_social',
    state,
  })

  return { authUrl: `https://www.linkedin.com/oauth/v2/authorization?${params}` }
})
