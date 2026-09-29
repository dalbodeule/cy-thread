import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { posts } from './posts';
import { threads } from './threads';
import { users } from './users';

export const reactions = sqliteTable(
  'reactions',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    threadId: integer('thread_id').references(() => threads.id, { onDelete: 'cascade' }),
    postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('like'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.threadId, table.postId, table.kind],
      name: 'reactions_pk',
    }),
    threadLookup: index('reactions_thread_idx').on(table.threadId, table.kind),
    postLookup: index('reactions_post_idx').on(table.postId, table.kind),
  })
);
