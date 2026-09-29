CREATE TABLE `reactions` (
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `thread_id` integer REFERENCES `threads`(`id`) ON DELETE CASCADE,
  `post_id` integer REFERENCES `posts`(`id`) ON DELETE CASCADE,
  `kind` text NOT NULL DEFAULT 'like',
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (`user_id`, `thread_id`, `post_id`, `kind`),
  CHECK ((`thread_id` IS NOT NULL AND `post_id` IS NULL) OR (`thread_id` IS NULL AND `post_id` IS NOT NULL))
);
CREATE INDEX `reactions_thread_idx` ON `reactions` (`thread_id`, `kind`);
CREATE INDEX `reactions_post_idx` ON `reactions` (`post_id`, `kind`);
