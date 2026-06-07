CREATE TABLE `team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`team` enum('A','B') NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_team_user` UNIQUE(`team`,`userId`)
);
