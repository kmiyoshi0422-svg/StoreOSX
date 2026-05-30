CREATE TABLE `partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` enum('電気','給排水','空調','厨房設備','排気・換気','内装','床','看板','外壁','建具','防水','その他') NOT NULL DEFAULT 'その他',
	`phone` varchar(32),
	`pic` varchar(128),
	`picPhone` varchar(32),
	`email` varchar(320),
	`address` text,
	`area` varchar(128),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cases` ADD `partnerId` int;--> statement-breakpoint
ALTER TABLE `cases` ADD `estimatedMaterialCost` int;--> statement-breakpoint
ALTER TABLE `cases` ADD `estimatedLaborCost` int;--> statement-breakpoint
ALTER TABLE `cases` ADD `actualCost` int;--> statement-breakpoint
ALTER TABLE `cases` ADD `actualMaterialCost` int;--> statement-breakpoint
ALTER TABLE `cases` ADD `actualLaborCost` int;--> statement-breakpoint
ALTER TABLE `cases` ADD `invoiceNumber` varchar(64);--> statement-breakpoint
ALTER TABLE `cases` ADD `invoiceDate` timestamp;--> statement-breakpoint
ALTER TABLE `cases` ADD `surveyDate` timestamp;--> statement-breakpoint
ALTER TABLE `cases` ADD `constructionDate` timestamp;--> statement-breakpoint
ALTER TABLE `cases` ADD `completedAt` timestamp;