CREATE TABLE `route_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`team` enum('A','B') NOT NULL,
	`taskType` enum('survey','construction') NOT NULL,
	`scheduledDate` varchar(10) NOT NULL,
	`sequence` int NOT NULL DEFAULT 0,
	`assigneeId` int,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `route_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cases` ADD `latitude` varchar(32);--> statement-breakpoint
ALTER TABLE `cases` ADD `longitude` varchar(32);