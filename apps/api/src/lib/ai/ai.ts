import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function generatePostDrafts(
  prTitle: string,
  prDescription: string,
  diff: string
): Promise<{ twitter: string; linkedin: string }> {
  const truncatedDiff = diff.slice(0, 4000);

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: `You are a developer advocate writing social media posts about a merged pull request.

PR Title: ${prTitle}
PR Description: ${prDescription}
Diff (truncated):
${truncatedDiff}

Generate two posts:
1. A Twitter post (max 280 chars, casual, engaging, can use hashtags)
2. A LinkedIn post (2-4 sentences, professional but approachable)

Respond ONLY with valid JSON in this exact format, no markdown:
{"twitter": "...", "linkedin": "..."}`,
  });

  return JSON.parse(text);
}
