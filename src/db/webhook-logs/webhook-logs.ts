import { desc } from 'drizzle-orm';

import { db } from '../client/client.js';
import { webhookLogs, type WebhookLog, type NewWebhookLog } from '../schema.js';

export async function createWebhookLog(data: NewWebhookLog): Promise<WebhookLog> {
  const [row] = await db.insert(webhookLogs).values(data).returning();
  return row;
}

export async function listWebhookLogs(limit = 100): Promise<WebhookLog[]> {
  return db.select().from(webhookLogs).orderBy(desc(webhookLogs.createdAt)).limit(limit).all();
}
