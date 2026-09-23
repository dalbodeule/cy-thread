import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { forums } from './forums';
import { posts } from './posts';
import { threads } from './threads';
import { users } from './users';

export const reports = sqliteTable(
  'reports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    forumId: integer('forum_id')
      .notNull()
      .references(() => forums.id, { onDelete: 'cascade' }),
    reporterUserId: integer('reporter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    threadId: integer('thread_id').references(() => threads.id, { onDelete: 'cascade' }),
    postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    details: text('details'),
    status: text('status').notNull().default('open'),
    reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    forumStatusCreated: index('reports_forum_status_created_idx').on(
      table.forumId,
      table.status,
      table.createdAt
    ),
  })
);
