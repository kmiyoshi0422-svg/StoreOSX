CREATE TABLE `case_report_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`content` text NOT NULL,
	`generatedAt` timestamp,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_report_drafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_report_draft_case` UNIQUE(`caseId`)
);
