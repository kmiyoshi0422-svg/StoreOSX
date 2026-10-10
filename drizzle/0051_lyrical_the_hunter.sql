CREATE TABLE `case_responsibility_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`before_officer` varchar(32),
	`after_officer` varchar(32),
	`changed_by` int NOT NULL,
	`changed_by_name` varchar(255) NOT NULL,
	`changed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `case_responsibility_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `responsible_officer_accounts` (
	`user_id` int NOT NULL,
	`officer_key` enum('kihara','noguchi','kono','miyoshi','shindo') NOT NULL,
	`confirmed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `responsible_officer_accounts_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `cases` ADD `responsible_officer` enum('kihara','noguchi','kono','miyoshi','shindo');--> statement-breakpoint
CREATE INDEX `idx_responsibility_logs_case` ON `case_responsibility_logs` (`case_id`,`changed_at`);--> statement-breakpoint
CREATE INDEX `idx_officer_accounts_key` ON `responsible_officer_accounts` (`officer_key`);--> statement-breakpoint
CREATE INDEX `idx_cases_responsible` ON `cases` (`responsible_officer`,`createdAt`);