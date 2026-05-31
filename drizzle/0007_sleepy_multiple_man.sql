CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int,
	`fileKey` varchar(512),
	`fileUrl` varchar(512),
	`fileName` varchar(255),
	`mimeType` varchar(64),
	`vendorName` varchar(255),
	`amount` int NOT NULL,
	`taxAmount` int,
	`expenseDate` timestamp,
	`category` enum('材料費','外注費','交通費','消耗品','その他') NOT NULL DEFAULT 'その他',
	`note` text,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
