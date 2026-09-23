import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, index, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { threads } from './threads';
import { users } from './users';

export const posts = sqliteTable(
  'posts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    threadId: integer('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    parentPostId: integer('parent_post_id').references((): AnySQLiteColumn => posts.id, {
      onDelete: 'cascade',
    }),
    depth: integer('depth').notNull().default(0),
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
    parentCreated: index('posts_parent_created_idx').on(table.parentPostId, table.createdAt),
  })
);
