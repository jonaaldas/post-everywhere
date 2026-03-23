export interface MediaItem {
  url: string;
  buffer: Buffer;
  mimeType: string;
  type: 'image' | 'video';
  filename?: string;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  statusCode?: number;
  retryable?: boolean;
}

export interface Publisher {
  publish(content: string, accessToken: string, media?: MediaItem[]): Promise<PublishResult>;
}
