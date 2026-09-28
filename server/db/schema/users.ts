import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').unique(),
  contactEmail: text('contact_email'),
  contactEmailVerifiedAt: integer('contact_email_verified_at', { mode: 'timestamp_ms' }),
  contactEmailVerifyToken: text('contact_email_verify_token').unique(),
  contactEmailVerifyExpiresAt: integer('contact_email_verify_expires_at', { mode: 'timestamp_ms' }),
  mailNotificationsEnabled: integer('mail_notifications_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  mailUnsubscribeToken: text('mail_unsubscribe_token').unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  isGlobalAdmin: integer('is_global_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
