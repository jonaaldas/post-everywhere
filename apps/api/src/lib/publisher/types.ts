import type { TiktokSettings, TiktokState } from '../tiktok/types.js';

export interface MediaItem {
  url: string;
  buffer: Buffer;
  mimeType: string;
  type: 'image' | 'video';
}

export interface PublishContext {
  content: string;
  accessToken: string;
  postId: string;
  media?: MediaItem[];
  platformContext?: {
    sessionId?: string;
    tiktokSettings?: TiktokSettings;
    tiktokState?: TiktokState | null;
  };
}

export interface SyncStatusContext {
  accessToken: string;
  platformPublishId: string;
  platformContext?: {
    sessionId?: string;
  };
}

export interface PublishResult {
  success: boolean;
  state?: 'posted' | 'publishing' | 'rejected';
  platformPostId?: string;
  platformPublishId?: string;
  platformStatus?: string;
  tiktokState?: TiktokState;
  error?: string;
}

export interface Publisher {
  publish(context: PublishContext): Promise<PublishResult>;
  syncStatus?(context: SyncStatusContext): Promise<PublishResult>;
}
