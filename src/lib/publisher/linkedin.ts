import type { Publisher, PublishResult, MediaItem } from './types.js';

const LINKEDIN_API = 'https://api.linkedin.com';
const LINKEDIN_VERSION = '202601';
const LINKEDIN_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif']);
const LINKEDIN_VIDEO_TYPES = new Set(['video/mp4']);
const VIDEO_POLL_INTERVAL_MS = 3_000;
const VIDEO_POLL_TIMEOUT_MS = 120_000;

interface LinkedInVideoUploadInstruction {
  uploadUrl: string;
  firstByte: number;
  lastByte: number;
}

interface LinkedInVideoInitializeResponse {
  value?: {
    video?: string;
    uploadToken?: string;
    uploadInstructions?: LinkedInVideoUploadInstruction[];
  };
  video?: string;
  uploadToken?: string;
  uploadInstructions?: LinkedInVideoUploadInstruction[];
}

function createLinkedInHeaders(accessToken: string, contentType = 'application/json'): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': contentType,
    'LinkedIn-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

function createErrorResult(error: string, statusCode = 500, retryable = false): PublishResult {
  return { success: false, error, statusCode, retryable };
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';', 1)[0].trim().toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizePartId(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/^"+|"+$/g, '');
}

function getFilename(item: MediaItem, fallback: string): string {
  if (item.filename?.trim()) return item.filename.trim();
  try {
    const pathname = new URL(item.url).pathname;
    const basename = pathname.split('/').pop();
    if (basename) return decodeURIComponent(basename);
  } catch {
    // Ignore invalid URLs and use the fallback below.
  }
  return fallback;
}

function parseLinkedInVideoStatus(body: Record<string, unknown>): string | null {
  const direct = body.status;
  if (typeof direct === 'string') return direct;

  const value = body.value;
  if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).status === 'string') {
    return (value as Record<string, string>).status;
  }

  return null;
}

function parseLinkedInVideoFailureReason(body: Record<string, unknown>): string | null {
  const fields = ['processingFailureReason', 'failureReason', 'message'] as const;
  for (const key of fields) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  const value = body.value;
  if (value && typeof value === 'object') {
    for (const key of fields) {
      const nested = (value as Record<string, unknown>)[key];
      if (typeof nested === 'string' && nested.trim()) return nested;
    }
  }

  return null;
}

function validateLinkedInMedia(media?: MediaItem[]): PublishResult | null {
  if (!media?.length) return null;

  const images = media.filter((item) => item.type === 'image');
  const videos = media.filter((item) => item.type === 'video');

  if (images.some((item) => !LINKEDIN_IMAGE_TYPES.has(normalizeMimeType(item.mimeType)))) {
    return createErrorResult('LinkedIn only supports JPEG, PNG, or GIF images', 400);
  }
  if (videos.some((item) => !LINKEDIN_VIDEO_TYPES.has(normalizeMimeType(item.mimeType)))) {
    return createErrorResult('LinkedIn only supports MP4 videos', 400);
  }
  if (images.length && videos.length) {
    return createErrorResult('LinkedIn posts cannot mix images and videos', 400);
  }
  if (videos.length > 1) {
    return createErrorResult('LinkedIn posts support exactly one video', 400);
  }
  if (images.length > 20) {
    return createErrorResult('LinkedIn posts support up to 20 images', 400);
  }

  return null;
}

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
  const initRes = await fetch(`${LINKEDIN_API}/rest/images?action=initializeUpload`, {
    method: 'POST',
    headers: createLinkedInHeaders(accessToken),
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

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': item.mimeType,
    },
    body: new Uint8Array(item.buffer),
  });

  if (!uploadRes.ok) {
    throw new Error(`LinkedIn image upload failed: ${uploadRes.status}`);
  }

  return imageUrn;
}

async function initializeVideoUpload(
  accessToken: string,
  ownerUrn: string,
  fileSizeBytes: number
): Promise<{ videoUrn: string; uploadToken: string | null; uploadInstructions: LinkedInVideoUploadInstruction[] }> {
  const res = await fetch(`${LINKEDIN_API}/rest/videos?action=initializeUpload`, {
    method: 'POST',
    headers: createLinkedInHeaders(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: ownerUrn,
        fileSizeBytes,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`LinkedIn video init failed: ${res.status} ${err}`);
  }

  const body = (await res.json()) as LinkedInVideoInitializeResponse;
  const source = body.value ?? body;
  const videoUrn = source.video;
  const uploadInstructions = source.uploadInstructions ?? [];

  if (!videoUrn || !uploadInstructions.length) {
    throw new Error('LinkedIn video init failed: missing upload instructions');
  }

  return {
    videoUrn,
    uploadToken: source.uploadToken ?? null,
    uploadInstructions,
  };
}

async function uploadVideoParts(
  uploadInstructions: LinkedInVideoUploadInstruction[],
  item: MediaItem
): Promise<string[]> {
  const uploadedPartIds: string[] = [];

  for (const instruction of uploadInstructions) {
    const chunk = item.buffer.subarray(instruction.firstByte, instruction.lastByte + 1);
    const uploadRes = await fetch(instruction.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(chunk),
    });

    if (!uploadRes.ok) {
      throw new Error(`LinkedIn video upload failed: ${uploadRes.status}`);
    }

    const partId =
      sanitizePartId(uploadRes.headers.get('etag')) ??
      sanitizePartId(uploadRes.headers.get('ETag')) ??
      sanitizePartId(uploadRes.headers.get('x-amz-etag'));

    if (!partId) {
      throw new Error('LinkedIn video upload failed: missing uploaded part id');
    }

    uploadedPartIds.push(partId);
  }

  return uploadedPartIds;
}

async function finalizeVideoUpload(
  accessToken: string,
  videoUrn: string,
  uploadToken: string | null,
  uploadedPartIds: string[]
): Promise<void> {
  const body: Record<string, unknown> = {
    finalizeUploadRequest: {
      video: videoUrn,
      uploadedPartIds,
    },
  };

  if (uploadToken !== null) {
    (body.finalizeUploadRequest as Record<string, unknown>).uploadToken = uploadToken;
  }

  const res = await fetch(`${LINKEDIN_API}/rest/videos?action=finalizeUpload`, {
    method: 'POST',
    headers: createLinkedInHeaders(accessToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`LinkedIn video finalize failed: ${res.status} ${err}`);
  }
}

async function waitForVideoAvailable(accessToken: string, videoUrn: string): Promise<PublishResult | null> {
  const startedAt = Date.now();

  while (true) {
    const res = await fetch(`${LINKEDIN_API}/rest/videos/${encodeURIComponent(videoUrn)}`, {
      headers: createLinkedInHeaders(accessToken),
    });

    if (!res.ok) {
      if (res.status === 401) {
        return createErrorResult('Invalid or expired token — please reconnect', 401);
      }
      const err = await res.text().catch(() => '');
      return createErrorResult(`LinkedIn video status lookup failed: ${res.status} ${err}`);
    }

    const body = (await res.json()) as Record<string, unknown>;
    const status = parseLinkedInVideoStatus(body);

    if (status === 'AVAILABLE') {
      return null;
    }

    if (status === 'PROCESSING_FAILED') {
      const failureReason = parseLinkedInVideoFailureReason(body);
      return createErrorResult(
        failureReason ? `LinkedIn video processing failed: ${failureReason}` : 'LinkedIn video processing failed'
      );
    }

    if (Date.now() - startedAt >= VIDEO_POLL_TIMEOUT_MS) {
      return createErrorResult(
        'LinkedIn accepted the upload but is still processing the video; try publishing again shortly.',
        409,
        true
      );
    }

    await sleep(VIDEO_POLL_INTERVAL_MS);
  }
}

export const linkedinPublisher: Publisher = {
  async publish(content: string, accessToken: string, media?: MediaItem[]): Promise<PublishResult> {
    try {
      const mediaValidation = validateLinkedInMedia(media);
      if (mediaValidation) {
        return mediaValidation;
      }

      const authorUrn = await getPersonUrn(accessToken);
      const images = media?.filter((m) => m.type === 'image') ?? [];
      const video = media?.find((m) => m.type === 'video');
      let postBody: Record<string, unknown>;

      if (video) {
        const { videoUrn, uploadToken, uploadInstructions } = await initializeVideoUpload(
          accessToken,
          authorUrn,
          video.buffer.length
        );
        const uploadedPartIds = await uploadVideoParts(uploadInstructions, video);
        await finalizeVideoUpload(accessToken, videoUrn, uploadToken, uploadedPartIds);

        const availabilityResult = await waitForVideoAvailable(accessToken, videoUrn);
        if (availabilityResult) {
          return availabilityResult;
        }

        postBody = {
          author: authorUrn,
          commentary: content,
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED' },
          lifecycleState: 'PUBLISHED',
          content: {
            media: { title: getFilename(video, 'Video'), id: videoUrn },
          },
        };
      } else if (images.length === 1) {
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
        postBody = {
          author: authorUrn,
          commentary: content,
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED' },
          lifecycleState: 'PUBLISHED',
        };
      }

      const res = await fetch(`${LINKEDIN_API}/rest/posts`, {
        method: 'POST',
        headers: createLinkedInHeaders(accessToken),
        body: JSON.stringify(postBody),
      });

      if (!res.ok) {
        if (res.status === 429) {
          return createErrorResult('Rate limit exceeded — try again later', 429, true);
        }
        if (res.status === 401) {
          return createErrorResult('Invalid or expired token — please reconnect', 401);
        }
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        return createErrorResult(body.message ?? `LinkedIn API error: ${res.status}`, res.status);
      }

      const body = (await res.json().catch(() => ({}))) as { id?: string };
      const postId = body.id ?? res.headers.get('x-restli-id') ?? undefined;
      return { success: true, platformPostId: postId };
    } catch (err: any) {
      if (err.status === 401) {
        return createErrorResult('Invalid or expired token — please reconnect', 401);
      }
      return createErrorResult(err.message ?? 'Unknown LinkedIn error');
    }
  },
};
