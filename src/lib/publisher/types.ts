export interface MediaItem {
  url: string;
  buffer: Buffer;
  mimeType: string;
  type: 'image' | 'video';
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

export interface Publisher {
  publish(content: string, accessToken: string, media?: MediaItem[]): Promise<PublishResult>;
}
