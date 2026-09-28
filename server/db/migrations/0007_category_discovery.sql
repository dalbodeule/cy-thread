CREATE TABLE `forum_requests` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `requester_user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `reviewed_by_user_id` integer REFERENCES `users`(`id`) ON DELETE SET NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `reviewed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forum_requests_pending_slug_idx` ON `forum_requests` (`slug`) WHERE `status` = 'pending';
--> statement-breakpoint
CREATE INDEX `forum_requests_status_created_idx` ON `forum_requests` (`status`, `created_at`);
--> statement-breakpoint
CREATE TABLE `featured_categories` (
  `rank` integer PRIMARY KEY NOT NULL,
  `category_id` integer NOT NULL REFERENCES `categories`(`id`) ON DELETE CASCADE,
  `activity_count` integer NOT NULL DEFAULT 0,
  `refreshed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `featured_categories_category_idx` ON `featured_categories` (`category_id`);
