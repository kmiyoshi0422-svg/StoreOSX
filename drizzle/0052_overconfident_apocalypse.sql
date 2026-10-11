CREATE TABLE `case_deadline_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`before_deadline` varchar(10),
	`after_deadline` varchar(10),
	`reason` varchar(500) NOT NULL,
	`changed_by` int NOT NULL,
	`changed_by_name` varchar(255) NOT NULL,
	`changed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `case_deadline_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cases` ADD `completion_deadline` varchar(10);--> statement-breakpoint
CREATE INDEX `idx_case_deadline_logs_case` ON `case_deadline_logs` (`case_id`,`changed_at`);