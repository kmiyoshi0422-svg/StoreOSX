CREATE TABLE `pending_ai_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`task_type` varchar(64) NOT NULL,
	`case_id` int NOT NULL,
	`params` text,
	`status` enum('pending','retrying','resolved','failed') NOT NULL DEFAULT 'pending',
	`error_message` text,
	`retry_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`resolved_at` timestamp,
	CONSTRAINT `pending_ai_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_pending_ai_user` ON `pending_ai_tasks` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_pending_ai_status` ON `pending_ai_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pending_ai_case` ON `pending_ai_tasks` (`case_id`);