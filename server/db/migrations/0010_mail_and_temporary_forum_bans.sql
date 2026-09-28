ALTER TABLE `forum_bans` ADD COLUMN `duration` text NOT NULL DEFAULT 'permanent';
--> statement-breakpoint
ALTER TABLE `forum_bans` ADD COLUMN `expires_at` integer;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `mail_notifications_enabled` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `mail_unsubscribe_token` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_mail_unsubscribe_token_unique` ON `users` (`mail_unsubscribe_token`);
--> statement-breakpoint
CREATE TABLE `mail_campaigns` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_by_user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `forum_id` integer REFERENCES `forums`(`id`) ON DELETE SET NULL,
  `audience` text NOT NULL,
  `selected_ids_json` text,
  `subject` text NOT NULL,
  `body` text NOT NULL,
  `status` text NOT NULL DEFAULT 'queued',
  `cursor_user_id` integer NOT NULL DEFAULT 0,
  `queued_count` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `finished_at` integer
);
--> statement-breakpoint
CREATE TABLE `mail_outbox` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `campaign_id` integer REFERENCES `mail_campaigns`(`id`) ON DELETE CASCADE,
  `user_id` integer REFERENCES `users`(`id`) ON DELETE SET NULL,
  `recipient_email` text NOT NULL,
  `kind` text NOT NULL,
  `subject` text NOT NULL,
  `body` text NOT NULL,
  `status` text NOT NULL DEFAULT 'queued',
  `attempts` integer NOT NULL DEFAULT 0,
  `next_attempt_at` integer NOT NULL DEFAULT 0,
  `claimed_at` integer,
  `message_id` text,
  `last_error` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `sent_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mail_outbox_campaign_user_unique` ON `mail_outbox` (`campaign_id`, `user_id`);
--> statement-breakpoint
CREATE INDEX `mail_outbox_pending_idx` ON `mail_outbox` (`status`, `next_attempt_at`, `id`);
--> statement-breakpoint
CREATE INDEX `mail_campaigns_pending_idx` ON `mail_campaigns` (`status`, `id`);
