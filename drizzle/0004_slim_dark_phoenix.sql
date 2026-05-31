CREATE TABLE `estimates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(512) NOT NULL,
	`fileName` varchar(255),
	`mimeType` varchar(64),
	`totalAmount` int,
	`materialAmount` int,
	`laborAmount` int,
	`vendorName` varchar(255),
	`estimateDate` timestamp,
	`note` text,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `estimates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cases` ADD `progressStage` enum('未対応','現調済','見積提出済','承認済') DEFAULT '未対応' NOT NULL;--> statement-breakpoint
ALTER TABLE `cases` ADD `partnerToken` varchar(64);