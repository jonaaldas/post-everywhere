import { Hono } from 'hono';
import { Octokit } from 'octokit';

import { verifyWebhookSignature } from '../../lib/webhook-verify/webhook-verify.js';
import { generatePostDrafts } from '../../lib/ai/ai.js';
import { decrypt } from '../../lib/crypto/crypto.js';
import { findWatchedRepoByName, getConnection } from '../../db/github/github.js';
import { createPost } from '../../db/posts/posts.js';

const webhooks = new Hono();

webhooks.post('/github', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('x-hub-signature-256') || '';

  if (!verifyWebhookSignature(body, signature)) {
    return c.json({ error: 'invalid signature' }, 401);
  }

  const event = c.req.header('x-github-event');
  const payload = JSON.parse(body);

  // Only handle merged PRs
  if (event !== 'pull_request' || payload.action !== 'closed' || !payload.pull_request?.merged) {
    return c.json({ ok: true, skipped: true });
  }

  const pr = payload.pull_request;
  const repoFullName = pr.base.repo.full_name;

  const watched = await findWatchedRepoByName(repoFullName);
  if (!watched) {
    return c.json({ error: 'repo not watched' }, 404);
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
    });
  }

  return c.json({ ok: true, postsCreated: 2 }, 201);
});

export { webhooks };
