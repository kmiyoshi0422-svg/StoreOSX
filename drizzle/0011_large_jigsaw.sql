CREATE TABLE `case_signatures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`reportType` enum('survey','completion') NOT NULL,
	`signerName` varchar(128),
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(512) NOT NULL,
	`signedAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_signatures_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_case_report` UNIQUE(`caseId`,`reportType`)
);
