import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const userSuspensions = sqliteTable(
  'user_suspensions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorUserId: integer('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reason: text('reason').notNull(),
    duration: text('duration').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    revokedByUserId: integer('revoked_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    userActive: index('user_suspensions_user_active_idx').on(
      table.userId,
      table.revokedAt,
      table.expiresAt
    ),
  })
);
