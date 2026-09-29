import { sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';
import { threads } from './threads';
import { users } from './users';

export const threadReads = sqliteTable(
  'thread_reads',
  {
    threadId: integer('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadPostId: integer('last_read_post_id'),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.threadId, table.userId], name: 'thread_reads_pk' }),
  })
);
