ALTER TABLE `forum_requests` ADD COLUMN `description` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `forum_requests` ADD COLUMN `reapply_blocked_until` integer;
--> statement-breakpoint
UPDATE `forum_requests` SET `reapply_blocked_until` = `reviewed_at` + 604800000 WHERE `status` = 'approved' AND `reviewed_at` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `forum_requests_requester_blocked_idx` ON `forum_requests` (`requester_user_id`, `reapply_blocked_until`);
