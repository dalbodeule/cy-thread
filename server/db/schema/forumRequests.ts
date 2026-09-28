import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const forumRequests = sqliteTable(
  'forum_requests',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    requesterUserId: integer('requester_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('pending'),
    reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    reapplyBlockedUntil: integer('reapply_blocked_until', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    pendingSlug: uniqueIndex('forum_requests_pending_slug_idx')
      .on(table.slug)
      .where(sql`${table.status} = 'pending'`),
    statusCreated: index('forum_requests_status_created_idx').on(table.status, table.createdAt),
    requesterBlocked: index('forum_requests_requester_blocked_idx').on(
      table.requesterUserId,
      table.reapplyBlockedUntil
    ),
  })
);
