import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { forums } from './forums';
import { users } from './users';

export const forumFollowers = sqliteTable(
  'forum_followers',
  {
    forumId: integer('forum_id')
      .notNull()
      .references(() => forums.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('internal'), // internal | provider
    provider: text('provider'),
    providerUserId: text('provider_user_id'),
    verifiedAt: integer('verified_at', { mode: 'timestamp_ms' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.forumId, t.userId], name: 'forum_followers_pk' }),
    userLookup: index('forum_followers_user_idx').on(t.userId),
  })
);
