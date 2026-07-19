CREATE TABLE `rain_leak_check_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectionId` int NOT NULL,
	`section` enum('室内','天井裏','外部') NOT NULL,
	`orderNo` int NOT NULL,
	`category` varchar(64) NOT NULL,
	`itemTitle` varchar(255) NOT NULL,
	`status` enum('未確認','有','無','不明') NOT NULL DEFAULT '未確認',
	`urgency` enum('none','urgent','caution','observe') NOT NULL DEFAULT 'none',
	`memo` text,
	`photoNo` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rain_leak_check_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rain_leak_inspections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`inspectionDate` varchar(10),
	`buildingStructure` varchar(128),
	`buildingAge` varchar(64),
	`inspector` varchar(128),
	`weather` varchar(64),
	`routeEstimations` text,
	`summary` text,
	`totalIssueCount` int NOT NULL DEFAULT 0,
	`urgentCount` int NOT NULL DEFAULT 0,
	`cautionCount` int NOT NULL DEFAULT 0,
	`observeCount` int NOT NULL DEFAULT 0,
	`overallJudgment` varchar(64),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rain_leak_inspections_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_rain_leak_case` UNIQUE(`caseId`)
);
