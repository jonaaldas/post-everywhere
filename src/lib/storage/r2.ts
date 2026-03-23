import { AwsClient } from 'aws4fetch';

import { env } from '../../env.js';

let r2Client: AwsClient | null = null;

function getClient(): AwsClient {
  if (!r2Client) {
    if (!env.r2AccessKeyId || !env.r2SecretAccessKey) {
      throw new Error('R2 credentials not configured');
    }
    r2Client = new AwsClient({
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    });
  }
  return r2Client;
}

export function isR2Configured(): boolean {
  return !!(env.r2AccountId && env.r2AccessKeyId && env.r2SecretAccessKey && env.r2BucketName && env.r2PublicUrl);
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  const client = getClient();
  const url = `https://${env.r2AccountId}.r2.cloudflarestorage.com/${env.r2BucketName}/${key}`;

  const res = await client.fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });

  if (!res.ok) {
    throw new Error(`R2 upload failed: ${res.status}`);
  }

  return `${env.r2PublicUrl}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient();
  const url = `https://${env.r2AccountId}.r2.cloudflarestorage.com/${env.r2BucketName}/${key}`;

  await client.fetch(url, { method: 'DELETE' });
}
