CREATE TABLE `forum_members` (
  `forum_id` integer NOT NULL REFERENCES `forums`(`id`) ON DELETE CASCADE,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `status` text NOT NULL DEFAULT 'pending',
  `answers_json` text,
  `reviewed_by_user_id` integer REFERENCES `users`(`id`) ON DELETE SET NULL,
  `reviewed_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer,
  PRIMARY KEY (`forum_id`, `user_id`)
);
CREATE INDEX `forum_members_user_idx` ON `forum_members` (`user_id`, `status`);
CREATE INDEX `forum_members_status_idx` ON `forum_members` (`forum_id`, `status`);
UPDATE `forums` SET `visibility` = 'private' WHERE `visibility` <> 'public';
INSERT OR IGNORE INTO `forum_members` (`forum_id`, `user_id`, `status`, `created_at`)
SELECT `forum_id`, `user_id`, 'approved', `created_at` FROM `forum_followers`;
PRAGMA foreign_keys=OFF;
CREATE TABLE `__new_posts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `thread_id` integer NOT NULL REFERENCES `threads`(`id`) ON DELETE CASCADE,
  `parent_post_id` integer REFERENCES `posts`(`id`) ON DELETE CASCADE,
  `depth` integer NOT NULL DEFAULT 0,
  `author_user_id` integer REFERENCES `users`(`id`) ON DELETE SET NULL,
  `guest_ip` text,
  `guest_name` text,
  `markdown` text NOT NULL,
  `html_sanitized` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer,
  `is_deleted` integer NOT NULL DEFAULT false
);
INSERT INTO `__new_posts` (`id`, `thread_id`, `parent_post_id`, `depth`, `author_user_id`, `markdown`, `html_sanitized`, `created_at`, `updated_at`, `is_deleted`)
SELECT `id`, `thread_id`, `parent_post_id`, `depth`, `author_user_id`, `markdown`, `html_sanitized`, `created_at`, `updated_at`, `is_deleted` FROM `posts`;
DROP TABLE `posts`;
ALTER TABLE `__new_posts` RENAME TO `posts`;
PRAGMA foreign_keys=ON;
CREATE INDEX `posts_thread_created_idx` ON `posts` (`thread_id`, `created_at`);
CREATE INDEX `posts_parent_created_idx` ON `posts` (`parent_post_id`, `created_at`);
CREATE INDEX `posts_author_created_idx` ON `posts` (`author_user_id`, `created_at`);
DROP TRIGGER IF EXISTS `threads_fts_title_update`;
CREATE TRIGGER `posts_fts_insert` AFTER INSERT ON `posts` BEGIN
  INSERT INTO `posts_fts` (`rowid`, `thread_id`, `title`, `markdown`)
  SELECT new.id, new.thread_id, threads.title, new.markdown FROM threads WHERE threads.id = new.thread_id;
END;
CREATE TRIGGER `posts_fts_delete` AFTER DELETE ON `posts` BEGIN
  DELETE FROM `posts_fts` WHERE `rowid` = old.id;
END;
CREATE TRIGGER `posts_fts_update` AFTER UPDATE OF `thread_id`, `markdown` ON `posts` BEGIN
  DELETE FROM `posts_fts` WHERE `rowid` = old.id;
  INSERT INTO `posts_fts` (`rowid`, `thread_id`, `title`, `markdown`)
  SELECT new.id, new.thread_id, threads.title, new.markdown FROM threads WHERE threads.id = new.thread_id;
END;
CREATE TRIGGER `threads_fts_title_update` AFTER UPDATE OF `title` ON `threads` BEGIN
  DELETE FROM `posts_fts` WHERE `rowid` IN (SELECT id FROM posts WHERE thread_id = new.id);
  INSERT INTO `posts_fts` (`rowid`, `thread_id`, `title`, `markdown`)
  SELECT posts.id, posts.thread_id, new.title, posts.markdown FROM posts WHERE posts.thread_id = new.id;
END;
