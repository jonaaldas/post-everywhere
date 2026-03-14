import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('../../env.js', () => ({
  env: { githubWebhookSecret: 'test-webhook-secret' },
}));

import { verifyWebhookSignature } from './webhook-verify.js';

function sign(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return 'sha256=' + hmac.digest('hex');
}

describe('lib/webhook-verify', () => {
  const payload = JSON.stringify({ action: 'closed' });

  it('returns true for valid signature', () => {
    const sig = sign(payload, 'test-webhook-secret');
    expect(verifyWebhookSignature(payload, sig)).toBe(true);
  });

  it('returns false for invalid signature', () => {
    expect(verifyWebhookSignature(payload, 'sha256=bad')).toBe(false);
  });

  it('returns false for empty signature', () => {
    expect(verifyWebhookSignature(payload, '')).toBe(false);
  });

  it('returns false for missing sha256= prefix', () => {
    const hmac = createHmac('sha256', 'test-webhook-secret');
    hmac.update(payload);
    const rawHex = hmac.digest('hex');
    expect(verifyWebhookSignature(payload, rawHex)).toBe(false);
  });
});
