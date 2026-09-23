import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { posts } from './posts';
import { users } from './users';
import { forums } from './forums';

export const attachments = sqliteTable('attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  forumId: integer('forum_id')
    .notNull()
    .references(() => forums.id, { onDelete: 'cascade' }),
  postId: integer('post_id').references(() => posts.id, { onDelete: 'set null' }),
  authorUserId: integer('author_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  r2Key: text('r2_key').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});
