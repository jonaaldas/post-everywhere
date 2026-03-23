interface OAuthState {
  userId: string
  codeVerifier: string
  ts: number
}

const TTL_MS = 10 * 60 * 1000

export const oauthStates = new Map<string, OAuthState>()

export function consumeOAuthState(state: string): OAuthState | undefined {
  const now = Date.now()

  for (const [key, value] of oauthStates) {
    if (now - value.ts > TTL_MS) {
      oauthStates.delete(key)
    }
  }

  const value = oauthStates.get(state)
  if (value) {
    oauthStates.delete(state)
  }

  return value
}
