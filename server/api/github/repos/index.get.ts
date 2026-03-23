import { getConnection, listWatchedRepos } from '../../../../src/db/github/github.js';
import { decrypt } from '../../../../src/lib/crypto/crypto.js';
import { listUserRepos } from '../../../../src/lib/github/github.js';
import { cacheGet, cacheSet } from '../../../../src/lib/redis/redis.js';
import { requireUser } from '../../../utils/auth.js';
import { jsonError } from '../../../utils/http.js';

type Repo = Awaited<ReturnType<typeof listUserRepos>>[number];

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const connection = await getConnection(user.sub);

  if (!connection) {
    return jsonError(event, 400, 'GitHub not connected');
  }

  const cacheKey = `github:repos:${user.sub}`;
  let repos = await cacheGet<Repo[]>(cacheKey).catch(() => null);

  if (!repos) {
    repos = await listUserRepos(decrypt(connection.personalAccessToken));
    await cacheSet(cacheKey, repos, 300).catch(() => {});
  }

  const watched = await listWatchedRepos(user.sub);
  const watchedSet = new Set(watched.map((repo) => repo.repoFullName));

  return repos.map((repo) => ({
    ...repo,
    watched: watchedSet.has(repo.fullName),
  }));
});
