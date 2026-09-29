ALTER TABLE `threads` ADD COLUMN `format` text NOT NULL DEFAULT 'discussion';
ALTER TABLE `threads` ADD COLUMN `poll_json` text NOT NULL DEFAULT '[]';
ALTER TABLE `threads` ADD COLUMN `accepted_post_id` integer;
CREATE TABLE `poll_votes` (
  `thread_id` integer NOT NULL REFERENCES `threads`(`id`) ON DELETE CASCADE,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `option_index` integer NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (`thread_id`, `user_id`)
);
