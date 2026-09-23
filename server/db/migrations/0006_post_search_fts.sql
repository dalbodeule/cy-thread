CREATE VIRTUAL TABLE `posts_fts` USING fts5(
  `thread_id` UNINDEXED,
  `title`,
  `markdown`,
  tokenize = 'trigram'
);--> statement-breakpoint
INSERT INTO `posts_fts` (`rowid`, `thread_id`, `title`, `markdown`)
SELECT posts.id, posts.thread_id, threads.title, posts.markdown
FROM posts
INNER JOIN threads ON threads.id = posts.thread_id;--> statement-breakpoint
CREATE TRIGGER `posts_fts_insert` AFTER INSERT ON `posts` BEGIN
  INSERT INTO `posts_fts` (`rowid`, `thread_id`, `title`, `markdown`)
  SELECT new.id, new.thread_id, threads.title, new.markdown
  FROM threads WHERE threads.id = new.thread_id;
END;--> statement-breakpoint
CREATE TRIGGER `posts_fts_delete` AFTER DELETE ON `posts` BEGIN
  DELETE FROM `posts_fts` WHERE `rowid` = old.id;
END;--> statement-breakpoint
CREATE TRIGGER `posts_fts_update` AFTER UPDATE OF `thread_id`, `markdown` ON `posts` BEGIN
  DELETE FROM `posts_fts` WHERE `rowid` = old.id;
  INSERT INTO `posts_fts` (`rowid`, `thread_id`, `title`, `markdown`)
  SELECT new.id, new.thread_id, threads.title, new.markdown
  FROM threads WHERE threads.id = new.thread_id;
END;--> statement-breakpoint
CREATE TRIGGER `threads_fts_title_update` AFTER UPDATE OF `title` ON `threads` BEGIN
  DELETE FROM `posts_fts` WHERE `rowid` IN (
    SELECT id FROM posts WHERE thread_id = new.id
  );
  INSERT INTO `posts_fts` (`rowid`, `thread_id`, `title`, `markdown`)
  SELECT posts.id, posts.thread_id, new.title, posts.markdown
  FROM posts WHERE posts.thread_id = new.id;
END;
