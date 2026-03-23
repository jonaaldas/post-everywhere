import { addWatchedRepo, getConnection, getWatchedRepo, removeWatchedRepo } from '../../../../../../src/db/github/github.js'
import { decrypt } from '../../../../../../src/lib/crypto/crypto.js'
import { createWebhook, deleteWebhook } from '../../../../../../src/lib/github/github.js'
import { cacheDel } from '../../../../../../src/lib/redis/redis.js'
import { requireUser } from '../../../../../utils/auth.js'
import { jsonError } from '../../../../../utils/http.js'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const owner = getRouterParam(event, 'owner') ?? ''
  const repo = getRouterParam(event, 'repo') ?? ''
  const repoFullName = `${owner}/${repo}`
  const connection = await getConnection(user.sub)

  if (!connection) {
    return jsonError(event, 400, 'GitHub not connected')
  }

  if (event.method === 'POST') {
    const existing = await getWatchedRepo(user.sub, repoFullName)
    if (existing) {
      return jsonError(event, 409, 'already watching this repo')
    }

    const { webhookId } = await createWebhook(decrypt(connection.personalAccessToken), owner, repo)
    const watched = await addWatchedRepo(crypto.randomUUID(), user.sub, repoFullName, webhookId)
    await cacheDel(`github:repos:${user.sub}`).catch(() => {})
    setResponseStatus(event, 201)
    return watched
  }

  if (event.method === 'DELETE') {
    const watched = await getWatchedRepo(user.sub, repoFullName)
    if (!watched || !watched.webhookId) {
      return jsonError(event, 404, 'not watching this repo')
    }

    await deleteWebhook(decrypt(connection.personalAccessToken), owner, repo, watched.webhookId)
    await removeWatchedRepo(user.sub, repoFullName)
    await cacheDel(`github:repos:${user.sub}`).catch(() => {})
    return { removed: true }
  }

  return jsonError(event, 405, 'method not allowed')
})
