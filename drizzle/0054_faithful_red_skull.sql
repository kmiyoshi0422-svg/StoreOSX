CREATE TABLE `owner_management_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('user_category','case_assignment') NOT NULL,
	`target_id` int NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`reason` varchar(500) NOT NULL,
	`changed_by` int NOT NULL,
	`changed_by_name` varchar(128) NOT NULL,
	`changed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_management_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_owner_management_target` ON `owner_management_logs` (`kind`,`target_id`);