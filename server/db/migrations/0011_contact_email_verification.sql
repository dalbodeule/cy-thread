ALTER TABLE `users` ADD COLUMN `contact_email_verified_at` integer;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `contact_email_verify_token` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `contact_email_verify_expires_at` integer;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_contact_email_verify_token_unique` ON `users` (`contact_email_verify_token`);
