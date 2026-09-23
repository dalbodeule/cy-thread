ALTER TABLE `posts` ADD `parent_post_id` integer REFERENCES posts(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `posts` ADD `depth` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE posts AS reply
SET parent_post_id = (
  SELECT starter.id FROM posts AS starter
  WHERE starter.thread_id = reply.thread_id
  ORDER BY starter.created_at, starter.id
  LIMIT 1
), depth = 1
WHERE reply.id != (
  SELECT starter.id FROM posts AS starter
  WHERE starter.thread_id = reply.thread_id
  ORDER BY starter.created_at, starter.id
  LIMIT 1
);--> statement-breakpoint
CREATE INDEX `posts_parent_created_idx` ON `posts` (`parent_post_id`,`created_at`);
