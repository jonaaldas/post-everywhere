import { Octokit } from 'octokit';

import { env } from '../../env.js';

export function createOctokit(pat: string) {
  return new Octokit({ auth: pat });
}

export async function verifyPat(pat: string) {
  const octokit = createOctokit(pat);
  const { data } = await octokit.rest.users.getAuthenticated();
  return { login: data.login };
}

export async function listUserRepos(pat: string) {
  const octokit = createOctokit(pat);
  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    sort: 'updated',
    per_page: 100,
  });
  return repos.map((r) => ({
    fullName: r.full_name,
    name: r.name,
    private: r.private,
    description: r.description,
    updatedAt: r.updated_at,
  }));
}

export async function createWebhook(pat: string, owner: string, repo: string) {
  const octokit = createOctokit(pat);
  const { data } = await octokit.rest.repos.createWebhook({
    owner,
    repo,
    config: {
      url: `${env.appBaseUrl}/api/webhooks/github`,
      content_type: 'json',
      secret: env.githubWebhookSecret,
    },
    events: ['pull_request'],
    active: true,
  });
  return { webhookId: String(data.id) };
}

export async function deleteWebhook(pat: string, owner: string, repo: string, webhookId: string) {
  const octokit = createOctokit(pat);
  await octokit.rest.repos.deleteWebhook({
    owner,
    repo,
    hook_id: Number(webhookId),
  });
}
