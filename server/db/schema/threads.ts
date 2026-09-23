import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { forums } from './forums';
import { categories } from './categories';
import { users } from './users';

export const threads = sqliteTable(
  'threads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    forumId: integer('forum_id')
      .notNull()
      .references(() => forums.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    authorUserId: integer('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
    lastPostAt: integer('last_post_at', { mode: 'timestamp_ms' }),
    isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => ({
    forumActivity: index('threads_forum_activity_idx').on(table.forumId, table.lastPostAt),
    categoryActivity: index('threads_category_activity_idx').on(table.categoryId, table.lastPostAt),
  })
);
