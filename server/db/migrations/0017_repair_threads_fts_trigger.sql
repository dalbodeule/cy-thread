DROP TRIGGER IF EXISTS `threads_fts_title_update`;
CREATE TRIGGER `threads_fts_title_update` AFTER UPDATE OF `title` ON `threads` BEGIN
  DELETE FROM `posts_fts` WHERE `rowid` IN (SELECT id FROM posts WHERE thread_id = new.id);
  INSERT INTO `posts_fts` (`rowid`, `thread_id`, `title`, `markdown`)
  SELECT posts.id, posts.thread_id, new.title, posts.markdown FROM posts WHERE posts.thread_id = new.id;
END;
