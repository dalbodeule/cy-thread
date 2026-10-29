DELETE FROM reactions
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM reactions
  WHERE thread_id IS NOT NULL AND post_id IS NULL
  GROUP BY user_id, thread_id, kind
  UNION ALL
  SELECT MIN(rowid)
  FROM reactions
  WHERE post_id IS NOT NULL AND thread_id IS NULL
  GROUP BY user_id, post_id, kind
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_thread_user_kind_unique_idx`
ON `reactions` (`user_id`, `thread_id`, `kind`)
WHERE `thread_id` IS NOT NULL AND `post_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_post_user_kind_unique_idx`
ON `reactions` (`user_id`, `post_id`, `kind`)
WHERE `post_id` IS NOT NULL AND `thread_id` IS NULL;
