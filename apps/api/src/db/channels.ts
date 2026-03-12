import { asc } from 'drizzle-orm';

import { db } from './client.js';
import { channels, type NewChannel } from './schema.js';

const defaultChannels: NewChannel[] = [
  { id: 'web', label: 'Web', reach: '18k readers', state: 'ready', sortOrder: 0 },
  { id: 'email', label: 'Email', reach: '6.4k subscribers', state: 'staged', sortOrder: 1 },
  { id: 'social', label: 'Social', reach: '42k followers', state: 'ready', sortOrder: 2 },
];

async function seedChannelsIfEmpty() {
  const existingChannels = await db.select({ id: channels.id }).from(channels).limit(1);

  if (existingChannels.length > 0) {
    return;
  }

  await db.insert(channels).values(defaultChannels).onConflictDoNothing();
}

export async function listChannels() {
  await seedChannelsIfEmpty();

  return db.select().from(channels).orderBy(asc(channels.sortOrder), asc(channels.label));
}
