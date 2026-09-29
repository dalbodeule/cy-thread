CREATE TABLE `moderation_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `forum_id` integer NOT NULL REFERENCES `forums`(`id`) ON DELETE CASCADE,
  `actor_user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `target_type` text NOT NULL,
  `target_id` integer,
  `action` text NOT NULL,
  `reason` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `moderation_logs_forum_created_idx` ON `moderation_logs` (`forum_id`, `created_at`);
