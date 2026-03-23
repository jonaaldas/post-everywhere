import type { H3Event } from 'h3'
import { setResponseStatus } from 'h3'

export function jsonError(event: H3Event, statusCode: number, error: string, message?: string) {
  setResponseStatus(event, statusCode)
  return message ? { error, message } : { error }
}
