CREATE UNIQUE INDEX `categories_forum_slug_uidx` ON `categories` (`forum_id`,`slug`);--> statement-breakpoint
CREATE INDEX `forum_followers_user_idx` ON `forum_followers` (`user_id`);--> statement-breakpoint
CREATE INDEX `posts_thread_created_idx` ON `posts` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `threads_forum_activity_idx` ON `threads` (`forum_id`,`last_post_at`);--> statement-breakpoint
CREATE INDEX `threads_category_activity_idx` ON `threads` (`category_id`,`last_post_at`);