CREATE TABLE `team_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`team` enum('A','B') NOT NULL,
	`primaryUserId` int,
	`label` varchar(64),
	`color` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `team_settings_id` PRIMARY KEY(`id`)
);
