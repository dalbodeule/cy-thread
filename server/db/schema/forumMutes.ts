import { sql } from 'drizzle-orm';
import { forums } from './forums';
import { users } from './users';
import { integer, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core';

export const forumMutes = sqliteTable(
  'forum_mutes',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    forumId: integer('forum_id')
      .notNull()
      .references(() => forums.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.forumId], name: 'forum_mutes_pk' }),
  })
);
