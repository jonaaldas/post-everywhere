import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env
vi.mock('../env.js', () => ({
  env: {
    appBaseUrl: 'https://app.test.com',
    githubWebhookSecret: 'whsec_test123',
  },
}));

// Mock Octokit as a class
const mockGetAuthenticated = vi.fn();
const mockListForAuthenticatedUser = vi.fn();
const mockCreateWebhookApi = vi.fn();
const mockDeleteWebhookApi = vi.fn();
const mockPaginate = vi.fn();

vi.mock('octokit', () => ({
  Octokit: class {
    rest = {
      users: { getAuthenticated: mockGetAuthenticated },
      repos: {
        listForAuthenticatedUser: mockListForAuthenticatedUser,
        createWebhook: mockCreateWebhookApi,
        deleteWebhook: mockDeleteWebhookApi,
      },
    };
    paginate = mockPaginate;
  },
}));

import { createOctokit, verifyPat, listUserRepos, createWebhook, deleteWebhook } from './github.js';

describe('lib/github', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createOctokit', () => {
    it('returns an Octokit instance', () => {
      const octokit = createOctokit('ghp_test');
      expect(octokit).toBeDefined();
      expect(octokit.rest).toBeDefined();
    });
  });

  describe('verifyPat', () => {
    it('returns the GitHub login', async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: 'octocat' } });
      const result = await verifyPat('ghp_valid');
      expect(result).toEqual({ login: 'octocat' });
    });

    it('throws when PAT is invalid', async () => {
      mockGetAuthenticated.mockRejectedValue(new Error('Bad credentials'));
      await expect(verifyPat('ghp_bad')).rejects.toThrow('Bad credentials');
    });
  });

  describe('listUserRepos', () => {
    it('maps repos to the expected shape', async () => {
      mockPaginate.mockResolvedValue([
        { full_name: 'user/repo-a', name: 'repo-a', private: false, description: 'A desc', updated_at: '2024-01-01' },
        { full_name: 'user/repo-b', name: 'repo-b', private: true, description: null, updated_at: null },
      ]);
      const repos = await listUserRepos('ghp_test');
      expect(repos).toEqual([
        { fullName: 'user/repo-a', name: 'repo-a', private: false, description: 'A desc', updatedAt: '2024-01-01' },
        { fullName: 'user/repo-b', name: 'repo-b', private: true, description: null, updatedAt: null },
      ]);
    });

    it('returns empty array when no repos', async () => {
      mockPaginate.mockResolvedValue([]);
      const repos = await listUserRepos('ghp_test');
      expect(repos).toEqual([]);
    });
  });

  describe('createWebhook', () => {
    it('creates a webhook and returns the id as string', async () => {
      mockCreateWebhookApi.mockResolvedValue({ data: { id: 12345 } });
      const result = await createWebhook('ghp_test', 'user', 'repo');
      expect(result).toEqual({ webhookId: '12345' });
      expect(mockCreateWebhookApi).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        config: {
          url: 'https://app.test.com/api/webhooks/github',
          content_type: 'json',
          secret: 'whsec_test123',
        },
        events: ['pull_request'],
        active: true,
      });
    });
  });

  describe('deleteWebhook', () => {
    it('calls deleteWebhook with numeric hook_id', async () => {
      mockDeleteWebhookApi.mockResolvedValue({});
      await deleteWebhook('ghp_test', 'user', 'repo', '12345');
      expect(mockDeleteWebhookApi).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        hook_id: 12345,
      });
    });
  });
});
