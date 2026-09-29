import { sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const userBlocks = sqliteTable(
  'user_blocks',
  {
    blockerUserId: integer('blocker_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedUserId: integer('blocked_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.blockerUserId, table.blockedUserId], name: 'user_blocks_pk' }),
  })
);
