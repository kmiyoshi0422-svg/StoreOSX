CREATE TABLE `fullwidth_exclusions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`term` varchar(255) NOT NULL,
	`note` varchar(255),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fullwidth_exclusions_id` PRIMARY KEY(`id`),
	CONSTRAINT `fullwidth_exclusions_term_unique` UNIQUE(`term`)
);
