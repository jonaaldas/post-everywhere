import { Octokit } from 'octokit'

import type { H3Event } from 'h3'

import { createPost } from '../../../src/db/posts/posts.js'
import { findWatchedRepoByName, getConnection } from '../../../src/db/github/github.js'
import { createWebhookLog } from '../../../src/db/webhook-logs/webhook-logs.js'
import { generatePostDrafts } from '../../../src/lib/ai/ai.js'
import { decrypt } from '../../../src/lib/crypto/crypto.js'
import { verifyWebhookSignature } from '../../../src/lib/webhook-verify/webhook-verify.js'

async function logAndRespond(
  event: H3Event,
  requestBody: string,
  headersObj: Record<string, string>,
  responseBody: Record<string, unknown>,
  statusCode: number,
) {
  try {
    await createWebhookLog({
      id: crypto.randomUUID(),
      eventType: headersObj['x-github-event'] ?? 'unknown',
      source: 'github',
      requestHeaders: JSON.stringify(headersObj),
      requestBody,
      responseBody: JSON.stringify(responseBody),
      statusCode,
    })
  } catch {
    // Ignore webhook logging failures.
  }

  setResponseStatus(event, statusCode)
  return responseBody
}

export default defineEventHandler(async (event) => {
  const body = (await readRawBody(event, 'utf8')) ?? ''
  const signature = getHeader(event, 'x-hub-signature-256') ?? ''
  const githubEvent = getHeader(event, 'x-github-event') ?? 'unknown'
  const headersObj: Record<string, string> = {}

  for (const [key, value] of Object.entries(getRequestHeaders(event))) {
    if (typeof value === 'string') headersObj[key] = value
  }

  if (!verifyWebhookSignature(body, signature)) {
    return logAndRespond(event, body, headersObj, { error: 'invalid signature' }, 401)
  }

  const payload = JSON.parse(body)
  if (githubEvent !== 'pull_request' || payload.action !== 'closed' || !payload.pull_request?.merged) {
    return logAndRespond(event, body, headersObj, { ok: true, skipped: true }, 200)
  }

  const pr = payload.pull_request
  const repoFullName = pr.base.repo.full_name
  const watched = await findWatchedRepoByName(repoFullName)

  if (!watched) {
    return logAndRespond(event, body, headersObj, { error: 'repo not watched' }, 404)
  }

  let diff = ''
  const connection = await getConnection(watched.userId)
  if (connection) {
    try {
      const [owner, repo] = repoFullName.split('/')
      const octokit = new Octokit({ auth: decrypt(connection.personalAccessToken) })
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pr.number,
        mediaType: { format: 'diff' },
      })
      diff = String(data)
    } catch {
      diff = ''
    }
  }

  const drafts = await generatePostDrafts(pr.title, pr.body || '', diff)

  for (const platform of ['twitter', 'linkedin'] as const) {
    await createPost({
      id: crypto.randomUUID(),
      userId: watched.userId,
      repoFullName,
      prNumber: pr.number,
      prTitle: pr.title,
      prDescription: pr.body || null,
      platform,
      content: drafts[platform],
      status: 'pending',
    })
  }

  return logAndRespond(event, body, headersObj, { ok: true, postsCreated: 2 }, 201)
})
