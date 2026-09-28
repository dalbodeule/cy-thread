ALTER TABLE `users` ADD COLUMN `avatar_source` text NOT NULL DEFAULT 'provider';
ALTER TABLE `users` ADD COLUMN `provider_avatar_url` text;
ALTER TABLE `users` ADD COLUMN `uploaded_avatar_key` text;
UPDATE `users` SET `provider_avatar_url` = `avatar_url` WHERE `avatar_url` IS NOT NULL;
