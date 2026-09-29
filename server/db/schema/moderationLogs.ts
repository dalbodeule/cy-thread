import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { forums } from './forums';
import { users } from './users';

export const moderationLogs = sqliteTable(
  'moderation_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    forumId: integer('forum_id')
      .notNull()
      .references(() => forums.id, { onDelete: 'cascade' }),
    actorUserId: integer('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: integer('target_id'),
    action: text('action').notNull(),
    reason: text('reason'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    forumCreated: index('moderation_logs_forum_created_idx').on(table.forumId, table.createdAt),
  })
);
