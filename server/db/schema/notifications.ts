import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { forums } from './forums';
import { threads } from './threads';
import { posts } from './posts';

export const notifications = sqliteTable(
  'notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    forumId: integer('forum_id').references(() => forums.id, { onDelete: 'cascade' }),
    threadId: integer('thread_id').references(() => threads.id, { onDelete: 'cascade' }),
    postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    message: text('message').notNull(),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    userCreated: index('notifications_user_created_idx').on(table.userId, table.createdAt),
    userUnread: index('notifications_user_unread_idx').on(table.userId, table.readAt),
  })
);
