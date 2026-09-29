CREATE TABLE `thread_reads` (
  `thread_id` integer NOT NULL REFERENCES `threads`(`id`) ON DELETE CASCADE,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `last_read_post_id` integer,
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (`thread_id`, `user_id`)
);
CREATE TABLE `thread_subscriptions` (
  `thread_id` integer NOT NULL REFERENCES `threads`(`id`) ON DELETE CASCADE,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (`thread_id`, `user_id`)
);
