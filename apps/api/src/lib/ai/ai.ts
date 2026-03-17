import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function generatePostDrafts(
  prTitle: string,
  prDescription: string,
  diff: string
): Promise<{ twitter: string; linkedin: string; tiktok: string }> {
  const truncatedDiff = diff.slice(0, 4000);

  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt: `You are a developer advocate writing social media posts about a merged pull request.

PR Title: ${prTitle}
PR Description: ${prDescription}
Diff (truncated):
${truncatedDiff}

Generate two posts:
1. A Twitter post (max 280 chars, casual, engaging, can use hashtags)
2. A LinkedIn post (2-4 sentences, professional but approachable)
3. A TikTok caption (1-2 short sentences, punchy, creator-style, can use 2-4 hashtags, should imply there is a demo video)

Respond ONLY with valid JSON in this exact format, no markdown:
{"twitter": "...", "linkedin": "...", "tiktok": "..."}`,
  });

  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return JSON.parse(cleaned);
}
