CREATE TABLE `responsibility_roster_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`reason` varchar(500) NOT NULL,
	`changed_by` int NOT NULL,
	`changed_by_name` varchar(255) NOT NULL,
	`changed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `responsibility_roster_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cases` MODIFY COLUMN `responsible_officer` varchar(32);