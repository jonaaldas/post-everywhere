import { listChannels } from '../../src/db/channels/channels.js'
import { jsonError } from '../utils/http.js'

export default defineEventHandler(async (event) => {
  try {
    return await listChannels()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    return jsonError(event, 503, 'DatabaseUnavailable', message)
  }
})
