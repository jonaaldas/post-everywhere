import type { Publisher } from './types.js';
import { twitterPublisher } from './twitter.js';
import { linkedinPublisher } from './linkedin.js';
import { tiktokPublisher } from './tiktok.js';

const publishers: Record<string, Publisher> = {
  twitter: twitterPublisher,
  linkedin: linkedinPublisher,
  tiktok: tiktokPublisher,
};

export function getPublisher(platform: string): Publisher {
  const publisher = publishers[platform];
  if (!publisher) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return publisher;
}

export type { Publisher, PublishResult } from './types.js';
