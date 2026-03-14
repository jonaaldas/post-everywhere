import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../../env.js';

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const expected = 'sha256=' + createHmac('sha256', env.githubWebhookSecret).update(payload).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
