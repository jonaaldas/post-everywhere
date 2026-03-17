ALTER TABLE `posts` ADD `platform_post_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `platform_publish_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `platform_publish_status` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `platform_publish_error` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `last_platform_sync_at` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `tiktok_settings` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `tiktok_state` text;--> statement-breakpoint
ALTER TABLE `social_connections` ADD `refresh_token_expires_at` text;