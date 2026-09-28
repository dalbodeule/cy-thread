CREATE TABLE `user_suspensions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `actor_user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `reason` text NOT NULL,
  `duration` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `expires_at` integer,
  `revoked_at` integer,
  `revoked_by_user_id` integer REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `user_suspensions_user_active_idx` ON `user_suspensions` (`user_id`, `revoked_at`, `expires_at`);
--> statement-breakpoint
CREATE INDEX `threads_author_created_idx` ON `threads` (`author_user_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `posts_author_created_idx` ON `posts` (`author_user_id`, `created_at`);
