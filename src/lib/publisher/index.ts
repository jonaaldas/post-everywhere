import type { Publisher } from './types.js';
import { twitterPublisher } from './twitter.js';
import { linkedinPublisher } from './linkedin.js';

const publishers: Record<string, Publisher> = {
  twitter: twitterPublisher,
  linkedin: linkedinPublisher,
};

export function getPublisher(platform: string): Publisher {
  const publisher = publishers[platform];
  if (!publisher) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return publisher;
}

export type { Publisher, PublishResult } from './types.js';
