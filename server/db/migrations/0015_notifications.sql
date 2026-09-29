CREATE TABLE `notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `actor_user_id` integer REFERENCES `users`(`id`) ON DELETE SET NULL,
  `forum_id` integer REFERENCES `forums`(`id`) ON DELETE CASCADE,
  `thread_id` integer REFERENCES `threads`(`id`) ON DELETE CASCADE,
  `post_id` integer REFERENCES `posts`(`id`) ON DELETE CASCADE,
  `kind` text NOT NULL,
  `message` text NOT NULL,
  `read_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `notifications_user_created_idx` ON `notifications` (`user_id`, `created_at`);
CREATE INDEX `notifications_user_unread_idx` ON `notifications` (`user_id`, `read_at`);
