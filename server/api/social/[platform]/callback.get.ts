import { Buffer } from 'node:buffer'

import { env } from '../../../../src/env.js'
import { saveSocialConnection } from '../../../../src/db/social/social.js'
import { encrypt } from '../../../../src/lib/crypto/crypto.js'
import { consumeOAuthState } from '../../../utils/social-oauth.js'
import { jsonError } from '../../../utils/http.js'

const PLATFORMS = ['twitter', 'linkedin'] as const
type Platform = (typeof PLATFORMS)[number]

function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value)
}

function getCallbackUrl(platform: Platform) {
  return `${env.appBaseUrl}/api/social/${platform}/callback`
}

export default defineEventHandler(async (event) => {
  const platform = getRouterParam(event, 'platform') ?? ''
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : undefined
  const state = typeof query.state === 'string' ? query.state : undefined

  if (!code) return jsonError(event, 400, 'missing code')
  if (!state) return jsonError(event, 400, 'missing state')
  if (!isPlatform(platform)) return jsonError(event, 400, 'unsupported platform')

  const oauthState = consumeOAuthState(state)
  if (!oauthState) {
    return jsonError(event, 400, 'invalid or expired state')
  }

  try {
    let accessToken: string
    let refreshToken: string | null = null
    let platformUserId: string
    let platformUsername: string
    let tokenExpiresAt: string | null = null

    if (platform === 'twitter') {
      const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${env.twitterClientId}:${env.twitterClientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          redirect_uri: getCallbackUrl('twitter'),
          code_verifier: oauthState.codeVerifier,
        }),
      })

      if (!tokenRes.ok) {
        return jsonError(event, 400, `Twitter token exchange failed: ${await tokenRes.text()}`)
      }

      const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in?: number }
      accessToken = tokens.access_token
      refreshToken = tokens.refresh_token ?? null
      if (tokens.expires_in) {
        tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      }

      const meRes = await fetch('https://api.x.com/2/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!meRes.ok) {
        return jsonError(event, 400, `Twitter user lookup failed: ${await meRes.text()}`)
      }
      const me = await meRes.json() as { data: { id: string; username: string } }
      platformUserId = me.data.id
      platformUsername = me.data.username
    } else {
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: getCallbackUrl('linkedin'),
          client_id: env.linkedinClientId,
          client_secret: env.linkedinClientSecret,
        }),
      })

      if (!tokenRes.ok) {
        return jsonError(event, 400, `LinkedIn token exchange failed: ${await tokenRes.text()}`)
      }

      const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in?: number }
      accessToken = tokens.access_token
      refreshToken = tokens.refresh_token ?? null
      if (tokens.expires_in) {
        tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      }

      const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!meRes.ok) {
        return jsonError(event, 400, `LinkedIn user lookup failed: ${await meRes.text()}`)
      }
      const me = await meRes.json() as { sub: string; name: string }
      platformUserId = me.sub
      platformUsername = me.name
    }

    await saveSocialConnection({
      userId: oauthState.userId,
      platform,
      accessToken: encrypt(accessToken),
      refreshToken: refreshToken ? encrypt(refreshToken) : null,
      platformUserId,
      platformUsername,
      tokenExpiresAt,
    })

    return sendRedirect(event, `${env.appBaseUrl}/settings?connected=${platform}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth callback failed'
    return jsonError(event, 500, message)
  }
})
