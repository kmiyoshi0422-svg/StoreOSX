CREATE TABLE `photo_classification_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`caseId` int NOT NULL,
	`photoId` int NOT NULL,
	`photoFileUrl` varchar(512) NOT NULL,
	`photoMemo` text,
	`beforePhotoType` enum('施工前A','施工前B','施工中','施工後A','施工後B','設置状況','メーカー型番','現調','その他') NOT NULL,
	`afterPhotoType` enum('施工前A','施工前B','施工中','施工後A','施工後B','設置状況','メーカー型番','現調','その他') NOT NULL,
	`suggestedCategory` enum('現調','施工前','施工中','施工後') NOT NULL,
	`confirmedCategory` enum('現調','施工前','施工中','施工後') NOT NULL,
	`confidence` int NOT NULL,
	`reason` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photo_classification_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `photo_classification_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`performedBy` int NOT NULL,
	`performedByName` varchar(255) NOT NULL,
	`changeCount` int NOT NULL,
	`undoneAt` timestamp,
	`undoneBy` int,
	`undoneByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photo_classification_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_photo_classification_changes_run` ON `photo_classification_changes` (`runId`);--> statement-breakpoint
CREATE INDEX `idx_photo_classification_changes_case` ON `photo_classification_changes` (`caseId`);--> statement-breakpoint
CREATE INDEX `idx_photo_classification_changes_photo` ON `photo_classification_changes` (`photoId`);--> statement-breakpoint
CREATE INDEX `idx_photo_classification_runs_case_created` ON `photo_classification_runs` (`caseId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_photo_classification_runs_performed_by` ON `photo_classification_runs` (`performedBy`);--> statement-breakpoint
CREATE INDEX `idx_photo_classification_runs_undone_at` ON `photo_classification_runs` (`undoneAt`);