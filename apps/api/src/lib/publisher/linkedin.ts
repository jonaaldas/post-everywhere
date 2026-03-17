import type { Publisher, PublishResult, MediaItem } from './types.js';

const LINKEDIN_API = 'https://api.linkedin.com';

async function getPersonUrn(accessToken: string): Promise<string> {
  const res = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
    throw new Error(`Failed to get LinkedIn profile: ${res.status}`);
  }

  const data = (await res.json()) as { sub: string };
  return `urn:li:person:${data.sub}`;
}

async function uploadImageToLinkedIn(
  accessToken: string,
  personUrn: string,
  item: MediaItem
): Promise<string> {
  // Step 1: Initialize upload
  const initRes = await fetch(`${LINKEDIN_API}/rest/images?action=initializeUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202601',
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
      },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.text().catch(() => '');
    throw new Error(`LinkedIn image init failed: ${initRes.status} ${err}`);
  }

  const initData = (await initRes.json()) as {
    value: { uploadUrl: string; image: string };
  };
  const { uploadUrl, image: imageUrn } = initData.value;

  // Step 2: Upload binary
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': item.mimeType,
    },
    body: item.buffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`LinkedIn image upload failed: ${uploadRes.status}`);
  }

  return imageUrn;
}

export const linkedinPublisher: Publisher = {
  async publish({ content, accessToken, media }: { content: string; accessToken: string; media?: MediaItem[] }): Promise<PublishResult> {
    try {
      const authorUrn = await getPersonUrn(accessToken);

      // Upload images if present
      const images = media?.filter((m) => m.type === 'image') ?? [];
      let postBody: Record<string, unknown>;

      if (images.length === 1) {
        // Single image post
        const imageUrn = await uploadImageToLinkedIn(accessToken, authorUrn, images[0]);
        postBody = {
          author: authorUrn,
          commentary: content,
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED' },
          lifecycleState: 'PUBLISHED',
          content: {
            media: { title: 'Image', id: imageUrn },
          },
        };
      } else if (images.length > 1) {
        // Multi-image post (2-20 images)
        const imageUrns: string[] = [];
        for (const img of images.slice(0, 20)) {
          const urn = await uploadImageToLinkedIn(accessToken, authorUrn, img);
          imageUrns.push(urn);
        }
        postBody = {
          author: authorUrn,
          commentary: content,
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED' },
          lifecycleState: 'PUBLISHED',
          content: {
            multiImage: {
              images: imageUrns.map((id) => ({ id, altText: '' })),
            },
          },
        };
      } else {
        // Text-only post
        postBody = {
          author: authorUrn,
          commentary: content,
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED' },
          lifecycleState: 'PUBLISHED',
        };
      }

      const res = await fetch(`${LINKEDIN_API}/v2/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202601',
        },
        body: JSON.stringify(postBody),
      });

      if (!res.ok) {
        if (res.status === 429) {
          return { success: false, error: 'Rate limit exceeded — try again later' };
        }
        if (res.status === 401) {
          return { success: false, error: 'Invalid or expired token — please reconnect' };
        }
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        return { success: false, error: body.message ?? `LinkedIn API error: ${res.status}` };
      }

      const body = (await res.json().catch(() => ({}))) as { id?: string };
      const postId = body.id ?? res.headers.get('x-restli-id') ?? undefined;
      return { success: true, state: 'posted', platformPostId: postId };
    } catch (err: any) {
      if (err.status === 401) {
        return { success: false, error: 'Invalid or expired token — please reconnect' };
      }
      return { success: false, error: err.message ?? 'Unknown LinkedIn error' };
    }
  },
};
