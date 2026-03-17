import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../env.js', () => ({
  env: { openaiApiKey: 'test-key' },
}));

const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockReturnValue('mock-model'),
}));

import { generatePostDrafts } from './ai.js';

describe('lib/ai', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns twitter, linkedin, and tiktok drafts', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        twitter: 'Just shipped feature X! #dev',
        linkedin: 'Excited to announce we just shipped feature X. Here is what it does...',
        tiktok: 'New build just landed. Watch it in action.',
      }),
    });

    const result = await generatePostDrafts('Add feature X', 'Implements feature X with tests', 'diff content');
    expect(result.twitter).toBe('Just shipped feature X! #dev');
    expect(result.linkedin).toContain('feature X');
    expect(result.tiktok).toContain('Watch it');
  });

  it('calls generateText with the PR context', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({ twitter: 'tweet', linkedin: 'post', tiktok: 'caption' }),
    });

    await generatePostDrafts('Fix bug', 'Fixed a critical bug', 'diff');
    expect(mockGenerateText).toHaveBeenCalledOnce();
    const call = mockGenerateText.mock.calls[0][0];
    expect(call.prompt).toContain('Fix bug');
    expect(call.prompt).toContain('Fixed a critical bug');
  });

  it('throws when AI returns invalid JSON', async () => {
    mockGenerateText.mockResolvedValue({ text: 'not json' });
    await expect(generatePostDrafts('title', 'desc', 'diff')).rejects.toThrow();
  });
});
