import type { H3Event } from 'h3'
import { setResponseStatus } from 'h3'

export function jsonError(
  event: H3Event,
  statusCode: number,
  error: string,
  details?: string | Record<string, unknown>
) {
  setResponseStatus(event, statusCode)
  if (typeof details === 'string') {
    return { error, message: details }
  }
  if (details) {
    return { error, ...details }
  }
  return { error }
}
