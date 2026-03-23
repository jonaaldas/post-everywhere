import { listWebhookLogs } from '../../../src/db/webhook-logs/webhook-logs.js'
import { requireUser } from '../../utils/auth.js'

export default defineEventHandler(async (event) => {
  requireUser(event)
  const query = getQuery(event)
  const limitValue = typeof query.limit === 'string' ? Number(query.limit) : undefined
  const limit = limitValue ? Math.min(limitValue, 500) : 100

  return listWebhookLogs(limit)
})
