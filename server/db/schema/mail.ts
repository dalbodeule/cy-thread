import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { forums } from './forums';

export const mailCampaigns = sqliteTable(
  'mail_campaigns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    forumId: integer('forum_id').references(() => forums.id, { onDelete: 'set null' }),
    audience: text('audience').notNull(),
    selectedIdsJson: text('selected_ids_json'),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('queued'),
    cursorUserId: integer('cursor_user_id').notNull().default(0),
    queuedCount: integer('queued_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({ pending: index('mail_campaigns_pending_idx').on(table.status, table.id) })
);

export const mailOutbox = sqliteTable(
  'mail_outbox',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    campaignId: integer('campaign_id').references(() => mailCampaigns.id, { onDelete: 'cascade' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    recipientEmail: text('recipient_email').notNull(),
    kind: text('kind').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: integer('next_attempt_at').notNull().default(0),
    claimedAt: integer('claimed_at', { mode: 'timestamp_ms' }),
    messageId: text('message_id'),
    lastError: text('last_error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    campaignUser: uniqueIndex('mail_outbox_campaign_user_unique').on(
      table.campaignId,
      table.userId
    ),
    pending: index('mail_outbox_pending_idx').on(table.status, table.nextAttemptAt, table.id),
  })
);
