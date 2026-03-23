import type { H3Event } from 'h3'
import { createError, deleteCookie, getCookie, setCookie } from 'h3'
import jwt from 'jsonwebtoken'

import { env } from '../../src/env.js'

const COOKIE_NAME = 'pe_token'
const THIRTY_DAYS = 60 * 60 * 24 * 30

export interface AuthPayload {
  sub: string
  email: string
}

export function signJwt(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { algorithm: 'HS256' })
}

export function verifyJwt(token: string): AuthPayload {
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as AuthPayload
}

export function setAuthCookie(event: H3Event, token: string) {
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS,
  })
}

export function clearAuthCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}

export function optionalUser(event: H3Event): AuthPayload | null {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return null

  try {
    return verifyJwt(token)
  } catch {
    return null
  }
}

export function requireUser(event: H3Event): AuthPayload {
  const user = optionalUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: { error: 'unauthorized' },
    })
  }

  return user
}
