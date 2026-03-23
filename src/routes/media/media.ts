import { Hono } from 'hono';

import { isR2Configured, uploadToR2 } from '../../lib/storage/r2.js';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

const media = new Hono();

media.post('/upload', async (c) => {
  if (!isR2Configured()) {
    return c.json({ error: 'Media uploads not configured' }, 503);
  }

  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400);
  }

  const contentType = file.type;
  const isImage = ALLOWED_IMAGE_TYPES.includes(contentType);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);

  if (!isImage && !isVideo) {
    return c.json({ error: 'Unsupported file type. Allowed: jpg, png, gif, mp4' }, 400);
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024);
    return c.json({ error: `File too large. Max ${limitMB}MB for ${isImage ? 'images' : 'videos'}` }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop() ?? (isImage ? 'jpg' : 'mp4');
  const key = `media/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const url = await uploadToR2(key, buffer, contentType);
  return c.json({ url });
});

export { media };
