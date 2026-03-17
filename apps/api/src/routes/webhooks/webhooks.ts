import { Hono } from 'hono';
import { Octokit } from 'octokit';

import { verifyWebhookSignature } from '../../lib/webhook-verify/webhook-verify.js';
import { generatePostDrafts } from '../../lib/ai/ai.js';
import { decrypt } from '../../lib/crypto/crypto.js';
import { findWatchedRepoByName, getConnection } from '../../db/github/github.js';
import { createPost } from '../../db/posts/posts.js';
import { createWebhookLog } from '../../db/webhook-logs/webhook-logs.js';

const webhooks = new Hono();

webhooks.post('/github', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('x-hub-signature-256') || '';
  const event = c.req.header('x-github-event') || 'unknown';

  const headersObj: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  const logAndRespond = async (responseBody: Record<string, unknown>, statusCode: number) => {
    try {
      await createWebhookLog({
        id: crypto.randomUUID(),
        eventType: event,
        source: 'github',
        requestHeaders: JSON.stringify(headersObj),
        requestBody: body,
        responseBody: JSON.stringify(responseBody),
        statusCode,
      });
    } catch {
      // Non-critical — don't fail the webhook response if logging fails
    }
    return c.json(responseBody, statusCode as 200);
  };

  if (!verifyWebhookSignature(body, signature)) {
    return logAndRespond({ error: 'invalid signature' }, 401);
  }

  const payload = JSON.parse(body);

  // Only handle merged PRs
  if (event !== 'pull_request' || payload.action !== 'closed' || !payload.pull_request?.merged) {
    return logAndRespond({ ok: true, skipped: true }, 200);
  }

  const pr = payload.pull_request;
  const repoFullName = pr.base.repo.full_name;

  const watched = await findWatchedRepoByName(repoFullName);
  if (!watched) {
    return logAndRespond({ error: 'repo not watched' }, 404);
  }

  // Fetch diff via Octokit
  const connection = await getConnection(watched.userId);
  let diff = '';
  if (connection) {
    const pat = decrypt(connection.personalAccessToken);
    const octokit = new Octokit({ auth: pat });
    try {
      const [owner, repo] = repoFullName.split('/');
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pr.number,
        mediaType: { format: 'diff' },
      });
      diff = String(data);
    } catch {
      // Non-critical — proceed without diff
    }
  }

  // Generate AI drafts
  const drafts = await generatePostDrafts(pr.title, pr.body || '', diff);

  // Create pending posts for each platform
  for (const platform of ['twitter', 'linkedin', 'tiktok'] as const) {
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
    });
  }

  return logAndRespond({ ok: true, postsCreated: 3 }, 201);
});

export { webhooks };
