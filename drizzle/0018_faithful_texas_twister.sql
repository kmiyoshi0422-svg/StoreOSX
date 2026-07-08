CREATE TABLE `case_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10) NOT NULL,
	`status` enum('予定','進行中','完了') NOT NULL DEFAULT '予定',
	`color` varchar(16) DEFAULT '#3b82f6',
	`memo` text,
	`orderNo` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_schedules_id` PRIMARY KEY(`id`)
);
