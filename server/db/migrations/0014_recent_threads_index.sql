CREATE INDEX `threads_public_recent_idx` ON `threads` (`is_deleted`, `last_post_at`, `id`);
