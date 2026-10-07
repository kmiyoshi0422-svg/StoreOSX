CREATE TABLE `case_response_date_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`kind` enum('first_response','planned_response') NOT NULL,
	`before_date` timestamp,
	`after_date` timestamp,
	`note` varchar(500),
	`recorded_by` int NOT NULL,
	`recorded_by_name` varchar(255) NOT NULL,
	`recorded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `case_response_date_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cases` ADD `first_response_date` timestamp;--> statement-breakpoint
ALTER TABLE `cases` ADD `response_planned_date` timestamp;--> statement-breakpoint
CREATE INDEX `idx_case_response_date_case_recorded` ON `case_response_date_logs` (`case_id`,`recorded_at`);