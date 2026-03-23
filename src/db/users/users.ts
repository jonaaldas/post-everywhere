import { eq } from 'drizzle-orm';

import { db } from '../client/client.js';
import { users, type User } from '../schema.js';

export async function createUser(id: string, email: string, passwordHash: string): Promise<User> {
  const [user] = await db.insert(users).values({ id, email, passwordHash }).returning();
  return user;
}

export async function findByEmail(email: string): Promise<User | undefined> {
  return db.select().from(users).where(eq(users.email, email)).get();
}

export async function countUsers(): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length;
}
