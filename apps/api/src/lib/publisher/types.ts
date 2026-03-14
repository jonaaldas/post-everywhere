export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

export interface Publisher {
  publish(content: string, accessToken: string): Promise<PublishResult>;
}
