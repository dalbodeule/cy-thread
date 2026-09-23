import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // nanoid
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
});
