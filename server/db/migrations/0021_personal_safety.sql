CREATE TABLE `user_blocks` (
  `blocker_user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `blocked_user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (`blocker_user_id`, `blocked_user_id`),
  CHECK (`blocker_user_id` != `blocked_user_id`)
);
CREATE TABLE `forum_mutes` (
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `forum_id` integer NOT NULL REFERENCES `forums`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (`user_id`, `forum_id`)
);
