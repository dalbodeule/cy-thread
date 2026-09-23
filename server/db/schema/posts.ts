import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { threads } from './threads';
import { users } from './users';

export const posts = sqliteTable(
  'posts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    threadId: integer('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    authorUserId: integer('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    markdown: text('markdown').notNull(),
    htmlSanitized: text('html_sanitized').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => ({
    threadCreated: index('posts_thread_created_idx').on(table.threadId, table.createdAt),
  })
);
