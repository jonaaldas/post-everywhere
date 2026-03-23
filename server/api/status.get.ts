import { pingDatabase } from '../../src/db/client/client.js'

export default defineEventHandler(async () => {
  const database = await pingDatabase()

  return {
    name: 'Post Everywhere API',
    version: '0.3.0',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    routes: ['/api/status', '/api/channels', '/api/auth/register', '/api/auth/login', '/api/webhook-logs', '/api/media/upload'],
    database,
  }
})
