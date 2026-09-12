CREATE TABLE `zapier_file_syncs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`callback_token_hash` varchar(64) NOT NULL,
	`status` enum('pending','sent','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`attempt_count` int NOT NULL DEFAULT 0,
	`last_error` text,
	`google_drive_file_id` varchar(255),
	`google_drive_url` varchar(1000),
	`zapier_table_record_id` varchar(255),
	`requested_by` int,
	`last_attempt_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zapier_file_syncs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_zapier_sync_document` UNIQUE(`document_id`),
	CONSTRAINT `uniq_zapier_sync_event` UNIQUE(`event_id`),
	CONSTRAINT `uniq_zapier_sync_callback_token_hash` UNIQUE(`callback_token_hash`)
);
--> statement-breakpoint
CREATE INDEX `idx_zapier_sync_status` ON `zapier_file_syncs` (`status`);