CREATE TABLE `document_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`version` int NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileSize` int,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_folder_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`folderId` int NOT NULL,
	`caseId` int NOT NULL,
	CONSTRAINT `project_folder_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_folder_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`folderId` int NOT NULL,
	`documentId` int NOT NULL,
	CONSTRAINT `project_folder_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revisit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`reason` varchar(50) NOT NULL,
	`note` text,
	`created_at` bigint NOT NULL,
	`created_by` varchar(255),
	CONSTRAINT `revisit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `status_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`user_id` int,
	`user_name` varchar(255),
	`from_status` varchar(50),
	`to_status` varchar(50) NOT NULL,
	`comment` text,
	`photo_urls` text,
	`created_at` bigint NOT NULL,
	CONSTRAINT `status_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documents` MODIFY COLUMN `caseId` int;--> statement-breakpoint
ALTER TABLE `documents` MODIFY COLUMN `category` enum('図面','仕様書','見積書','報告書','写真','担当者一覧','施工対象一覧','マニュアル','その他') NOT NULL DEFAULT 'その他';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','owner','partner') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `cases` ADD `revisitCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cases` ADD `amountApproved` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `partners` ADD `userId` int;--> statement-breakpoint
CREATE INDEX `idx_schedules_case` ON `case_schedules` (`caseId`);--> statement-breakpoint
CREATE INDEX `idx_schedules_dates` ON `case_schedules` (`startDate`,`endDate`);--> statement-breakpoint
CREATE INDEX `idx_cases_status_created` ON `cases` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_cases_progress_stage` ON `cases` (`progressStage`);--> statement-breakpoint
CREATE INDEX `idx_cases_assignee` ON `cases` (`assigneeId`);--> statement-breakpoint
CREATE INDEX `idx_cases_brand` ON `cases` (`brand`);--> statement-breakpoint
CREATE INDEX `idx_cases_partner` ON `cases` (`partnerId`);--> statement-breakpoint
CREATE INDEX `idx_checklist_case` ON `checklist_items` (`caseId`);--> statement-breakpoint
CREATE INDEX `idx_documents_case` ON `documents` (`caseId`);--> statement-breakpoint
CREATE INDEX `idx_estimates_case` ON `estimates` (`caseId`);--> statement-breakpoint
CREATE INDEX `idx_expenses_case` ON `expenses` (`caseId`);--> statement-breakpoint
CREATE INDEX `idx_photos_case` ON `photos` (`caseId`);--> statement-breakpoint
CREATE INDEX `idx_routes_case` ON `route_assignments` (`caseId`);--> statement-breakpoint
CREATE INDEX `idx_routes_date` ON `route_assignments` (`scheduledDate`);--> statement-breakpoint
CREATE INDEX `idx_routes_team_date` ON `route_assignments` (`team`,`scheduledDate`);