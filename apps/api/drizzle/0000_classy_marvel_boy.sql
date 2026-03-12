CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`reach` text NOT NULL,
	`state` text DEFAULT 'staged' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
