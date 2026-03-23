CREATE TABLE `webhook_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`source` text NOT NULL,
	`request_headers` text NOT NULL,
	`request_body` text NOT NULL,
	`response_body` text NOT NULL,
	`status_code` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
