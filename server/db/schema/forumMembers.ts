import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { forums } from './forums';
import { users } from './users';

export const forumMembers = sqliteTable(
  'forum_members',
  {
    forumId: integer('forum_id')
      .notNull()
      .references(() => forums.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'), // pending | approved | rejected
    answersJson: text('answers_json'),
    reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.forumId, table.userId], name: 'forum_members_pk' }),
    userLookup: index('forum_members_user_idx').on(table.userId, table.status),
    statusLookup: index('forum_members_status_idx').on(table.forumId, table.status),
  })
);
