import { Hono } from 'hono';

import { encrypt, decrypt } from '../../lib/crypto/crypto.js';
import { verifyPat, listUserRepos, createWebhook, deleteWebhook } from '../../lib/github/github.js';
import { saveConnection, getConnection, addWatchedRepo, getWatchedRepo, removeWatchedRepo, listWatchedRepos } from '../../db/github/github.js';
import { cacheGet, cacheSet, cacheDel } from '../../lib/redis/redis.js';

const github = new Hono();

github.post('/connect', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const body = await c.req.json<{ pat?: string }>();

  if (!body.pat) {
    return c.json({ error: 'pat is required' }, 400);
  }

  try {
    const { login } = await verifyPat(body.pat);
    const encryptedPat = encrypt(body.pat);
    const id = crypto.randomUUID();
    await saveConnection(id, userId, encryptedPat, login);
    return c.json({ connected: true, githubUsername: login });
  } catch {
    return c.json({ error: 'invalid GitHub PAT' }, 401);
  }
});

github.get('/repos', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const connection = await getConnection(userId);

  if (!connection) {
    return c.json({ error: 'GitHub not connected' }, 400);
  }

  const cacheKey = `github:repos:${userId}`;
  type CachedRepo = ReturnType<typeof listUserRepos> extends Promise<(infer T)[]> ? T : never;
  let repos = await cacheGet<CachedRepo[]>(cacheKey);

  if (!repos) {
    const pat = decrypt(connection.personalAccessToken);
    repos = await listUserRepos(pat);
    await cacheSet(cacheKey, repos, 300); // 5 min TTL
  }

  const watched = await listWatchedRepos(userId);
  const watchedSet = new Set(watched.map((w) => w.repoFullName));

  return c.json(
    repos.map((r) => ({ ...r, watched: watchedSet.has(r.fullName) }))
  );
});

github.post('/repos/:owner/:repo/watch', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const repoFullName = `${c.req.param('owner')}/${c.req.param('repo')}`;
  const connection = await getConnection(userId);

  if (!connection) {
    return c.json({ error: 'GitHub not connected' }, 400);
  }

  const existing = await getWatchedRepo(userId, repoFullName);
  if (existing) {
    return c.json({ error: 'already watching this repo' }, 409);
  }

  const pat = decrypt(connection.personalAccessToken);
  const [owner, repo] = repoFullName.split('/');
  const { webhookId } = await createWebhook(pat, owner, repo);
  const id = crypto.randomUUID();
  const watched = await addWatchedRepo(id, userId, repoFullName, webhookId);

  return c.json(watched, 201);
});

github.delete('/repos/:owner/:repo/watch', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const repoFullName = `${c.req.param('owner')}/${c.req.param('repo')}`;
  const connection = await getConnection(userId);

  if (!connection) {
    return c.json({ error: 'GitHub not connected' }, 400);
  }

  const watched = await getWatchedRepo(userId, repoFullName);
  if (!watched || !watched.webhookId) {
    return c.json({ error: 'not watching this repo' }, 404);
  }

  const pat = decrypt(connection.personalAccessToken);
  const [owner, repo] = repoFullName.split('/');
  await deleteWebhook(pat, owner, repo, watched.webhookId);
  await removeWatchedRepo(userId, repoFullName);

  return c.json({ removed: true });
});

export { github };
