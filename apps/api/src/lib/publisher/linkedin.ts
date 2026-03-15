import type { Publisher, PublishResult } from './types.js';

const LINKEDIN_API = 'https://api.linkedin.com';

async function getPersonUrn(accessToken: string): Promise<string> {
  const res = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
    throw new Error(`Failed to get LinkedIn profile: ${res.status}`);
  }

  const data = await res.json() as { sub: string };
  return `urn:li:person:${data.sub}`;
}

export const linkedinPublisher: Publisher = {
  async publish(content: string, accessToken: string): Promise<PublishResult> {
    try {
      const authorUrn = await getPersonUrn(accessToken);

      const res = await fetch(`${LINKEDIN_API}/v2/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202401',
        },
        body: JSON.stringify({
          author: authorUrn,
          commentary: content,
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED' },
          lifecycleState: 'PUBLISHED',
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          return { success: false, error: 'Rate limit exceeded — try again later' };
        }
        if (res.status === 401) {
          return { success: false, error: 'Invalid or expired token — please reconnect' };
        }
        const body = await res.json().catch(() => ({})) as { message?: string };
        return { success: false, error: body.message ?? `LinkedIn API error: ${res.status}` };
      }

      const body = await res.json().catch(() => ({})) as { id?: string };
      const postId = body.id ?? res.headers.get('x-restli-id') ?? undefined;
      return { success: true, platformPostId: postId };
    } catch (err: any) {
      if (err.status === 401) {
        return { success: false, error: 'Invalid or expired token — please reconnect' };
      }
      return { success: false, error: err.message ?? 'Unknown LinkedIn error' };
    }
  },
};
