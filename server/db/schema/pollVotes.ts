import { sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';
import { threads } from './threads';
import { users } from './users';

export const pollVotes = sqliteTable(
  'poll_votes',
  {
    threadId: integer('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    optionIndex: integer('option_index').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.threadId, table.userId], name: 'poll_votes_pk' }),
  })
);
