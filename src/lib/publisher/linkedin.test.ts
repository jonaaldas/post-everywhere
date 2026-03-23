import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { linkedinPublisher } from './linkedin.js';

function mockJsonResponse(body: unknown, init: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function mockUserInfo() {
  mockFetch.mockResolvedValueOnce(mockJsonResponse({ sub: 'abc123' }));
}

describe('linkedinPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes a text-only post successfully', async () => {
    mockUserInfo();
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ id: 'urn:li:share:456' }, { status: 201, headers: { 'x-restli-id': 'urn:li:share:456' } })
    );

    const result = await linkedinPublisher.publish('Hello LinkedIn', 'access-token');

    expect(result).toEqual({ success: true, platformPostId: 'urn:li:share:456' });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.linkedin.com/rest/posts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'LinkedIn-Version': '202601',
          'X-Restli-Protocol-Version': '2.0.0',
        }),
      })
    );
  });

  it('publishes a single image post successfully', async () => {
    mockUserInfo();
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        value: {
          uploadUrl: 'https://upload.linkedin.test/image',
          image: 'urn:li:image:123',
        },
      })
    );
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, { status: 201 }));
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ id: 'urn:li:share:img' }, { status: 201, headers: { 'x-restli-id': 'urn:li:share:img' } })
    );

    const result = await linkedinPublisher.publish('Hello', 'token', [
      {
        url: 'https://cdn.test/image.jpg',
        buffer: Buffer.from('image'),
        mimeType: 'image/jpeg',
        type: 'image',
      },
    ]);

    expect(result).toEqual({ success: true, platformPostId: 'urn:li:share:img' });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.linkedin.com/rest/images?action=initializeUpload',
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      4,
      'https://api.linkedin.com/rest/posts',
      expect.objectContaining({
        body: JSON.stringify({
          author: 'urn:li:person:abc123',
          commentary: 'Hello',
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED' },
          lifecycleState: 'PUBLISHED',
          content: {
            media: { title: 'Image', id: 'urn:li:image:123' },
          },
        }),
      })
    );
  });

  it('publishes a multi-image post successfully', async () => {
    mockUserInfo();
    mockFetch
      .mockResolvedValueOnce(
        mockJsonResponse({
          value: { uploadUrl: 'https://upload.linkedin.test/image-1', image: 'urn:li:image:1' },
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({}, { status: 201 }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          value: { uploadUrl: 'https://upload.linkedin.test/image-2', image: 'urn:li:image:2' },
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({}, { status: 201 }))
      .mockResolvedValueOnce(
        mockJsonResponse({ id: 'urn:li:share:gallery' }, { status: 201, headers: { 'x-restli-id': 'urn:li:share:gallery' } })
      );

    const result = await linkedinPublisher.publish('Gallery', 'token', [
      { url: 'https://cdn.test/1.jpg', buffer: Buffer.from('1'), mimeType: 'image/jpeg', type: 'image' },
      { url: 'https://cdn.test/2.png', buffer: Buffer.from('2'), mimeType: 'image/png', type: 'image' },
    ]);

    expect(result).toEqual({ success: true, platformPostId: 'urn:li:share:gallery' });
    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://api.linkedin.com/rest/posts',
      expect.objectContaining({
        body: JSON.stringify({
          author: 'urn:li:person:abc123',
          commentary: 'Gallery',
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED' },
          lifecycleState: 'PUBLISHED',
          content: {
            multiImage: {
              images: [
                { id: 'urn:li:image:1', altText: '' },
                { id: 'urn:li:image:2', altText: '' },
              ],
            },
          },
        }),
      })
    );
  });

  it('publishes a single video post successfully', async () => {
    mockUserInfo();
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        value: {
          video: 'urn:li:video:123',
          uploadToken: 'upload-token',
          uploadInstructions: [
            {
              uploadUrl: 'https://upload.linkedin.test/video-part-1',
              firstByte: 0,
              lastByte: 4,
            },
          ],
        },
      })
    );
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, { status: 201, headers: { etag: '"part-1"' } }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, { status: 200 }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ status: 'AVAILABLE' }));
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ id: 'urn:li:share:video' }, { status: 201, headers: { 'x-restli-id': 'urn:li:share:video' } })
    );

    const result = await linkedinPublisher.publish('Video time', 'token', [
      {
        url: 'https://cdn.test/video.mp4',
        filename: 'launch.mp4',
        buffer: Buffer.from('video'),
        mimeType: 'video/mp4',
        type: 'video',
      },
    ]);

    expect(result).toEqual({ success: true, platformPostId: 'urn:li:share:video' });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.linkedin.com/rest/videos?action=initializeUpload',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      4,
      'https://api.linkedin.com/rest/videos?action=finalizeUpload',
      expect.objectContaining({
        body: JSON.stringify({
          finalizeUploadRequest: {
            video: 'urn:li:video:123',
            uploadedPartIds: ['part-1'],
            uploadToken: 'upload-token',
          },
        }),
      })
    );
    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://api.linkedin.com/rest/posts',
      expect.objectContaining({
        body: JSON.stringify({
          author: 'urn:li:person:abc123',
          commentary: 'Video time',
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED' },
          lifecycleState: 'PUBLISHED',
          content: {
            media: { title: 'launch.mp4', id: 'urn:li:video:123' },
          },
        }),
      })
    );
  });

  it('includes uploadToken in finalize even when LinkedIn returns an empty string', async () => {
    mockUserInfo();
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        value: {
          video: 'urn:li:video:123',
          uploadToken: '',
          uploadInstructions: [
            {
              uploadUrl: 'https://upload.linkedin.test/video-part-1',
              firstByte: 0,
              lastByte: 4,
            },
          ],
        },
      })
    );
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, { status: 201, headers: { etag: '"part-1"' } }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, { status: 200 }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ status: 'AVAILABLE' }));
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ id: 'urn:li:share:video' }, { status: 201, headers: { 'x-restli-id': 'urn:li:share:video' } })
    );

    const result = await linkedinPublisher.publish('Video time', 'token', [
      {
        url: 'https://cdn.test/video.mp4',
        buffer: Buffer.from('video'),
        mimeType: 'video/mp4',
        type: 'video',
      },
    ]);

    expect(result).toEqual({ success: true, platformPostId: 'urn:li:share:video' });
    expect(mockFetch).toHaveBeenNthCalledWith(
      4,
      'https://api.linkedin.com/rest/videos?action=finalizeUpload',
      expect.objectContaining({
        body: JSON.stringify({
          finalizeUploadRequest: {
            video: 'urn:li:video:123',
            uploadedPartIds: ['part-1'],
            uploadToken: '',
          },
        }),
      })
    );
  });

  it('rejects mixed image and video media', async () => {
    const result = await linkedinPublisher.publish('Nope', 'token', [
      { url: 'https://cdn.test/image.jpg', buffer: Buffer.from('1'), mimeType: 'image/jpeg', type: 'image' },
      { url: 'https://cdn.test/video.mp4', buffer: Buffer.from('2'), mimeType: 'video/mp4', type: 'video' },
    ]);

    expect(result).toEqual({
      success: false,
      error: 'LinkedIn posts cannot mix images and videos',
      statusCode: 400,
      retryable: false,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects multiple videos', async () => {
    const result = await linkedinPublisher.publish('Too many videos', 'token', [
      { url: 'https://cdn.test/1.mp4', buffer: Buffer.from('1'), mimeType: 'video/mp4', type: 'video' },
      { url: 'https://cdn.test/2.mp4', buffer: Buffer.from('2'), mimeType: 'video/mp4', type: 'video' },
    ]);

    expect(result).toEqual({
      success: false,
      error: 'LinkedIn posts support exactly one video',
      statusCode: 400,
      retryable: false,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns a readable error when video processing fails', async () => {
    mockUserInfo();
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        value: {
          video: 'urn:li:video:123',
          uploadToken: 'upload-token',
          uploadInstructions: [
            {
              uploadUrl: 'https://upload.linkedin.test/video-part-1',
              firstByte: 0,
              lastByte: 4,
            },
          ],
        },
      })
    );
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, { status: 201, headers: { etag: '"part-1"' } }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, { status: 200 }));
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ status: 'PROCESSING_FAILED', processingFailureReason: 'Unsupported codec' })
    );

    const result = await linkedinPublisher.publish('Video time', 'token', [
      {
        url: 'https://cdn.test/video.mp4',
        buffer: Buffer.from('video'),
        mimeType: 'video/mp4',
        type: 'video',
      },
    ]);

    expect(result).toEqual({
      success: false,
      error: 'LinkedIn video processing failed: Unsupported codec',
      statusCode: 500,
      retryable: false,
    });
  });

  it('returns retryable 409 when video processing does not finish in time', async () => {
    vi.useFakeTimers();

    mockUserInfo();
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        value: {
          video: 'urn:li:video:123',
          uploadInstructions: [
            {
              uploadUrl: 'https://upload.linkedin.test/video-part-1',
              firstByte: 0,
              lastByte: 4,
            },
          ],
        },
      })
    );
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, { status: 201, headers: { etag: '"part-1"' } }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, { status: 200 }));
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/rest/videos/urn%3Ali%3Avideo%3A123')) {
        return Promise.resolve(mockJsonResponse({ status: 'PROCESSING' }));
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const publishPromise = linkedinPublisher.publish('Video time', 'token', [
      {
        url: 'https://cdn.test/video.mp4',
        buffer: Buffer.from('video'),
        mimeType: 'video/mp4',
        type: 'video',
      },
    ]);

    await vi.advanceTimersByTimeAsync(120_000);
    const result = await publishPromise;

    expect(result).toEqual({
      success: false,
      error: 'LinkedIn accepted the upload but is still processing the video; try publishing again shortly.',
      statusCode: 409,
      retryable: true,
    });
  });

  it('detects rate limit errors', async () => {
    mockUserInfo();
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ message: 'Rate limited' }, { ok: false, status: 429 }));

    const result = await linkedinPublisher.publish('Hello', 'token');

    expect(result).toEqual({
      success: false,
      error: 'Rate limit exceeded — try again later',
      statusCode: 429,
      retryable: true,
    });
  });

  it('detects expired token errors', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ message: 'Unauthorized' }, { ok: false, status: 401 }));

    const result = await linkedinPublisher.publish('Hello', 'token');

    expect(result).toEqual({
      success: false,
      error: 'Invalid or expired token — please reconnect',
      statusCode: 401,
      retryable: false,
    });
  });
});
