CREATE TABLE `store_master` (
	`id` int AUTO_INCREMENT NOT NULL,
	`store_code` varchar(64),
	`store_name` varchar(255) NOT NULL,
	`brand` enum('ほっともっと','やよい軒','その他') NOT NULL DEFAULT 'ほっともっと',
	`prefecture` varchar(16),
	`address` text,
	`phone` varchar(32),
	`business_hours` varchar(64),
	`floor_plan_url` varchar(512),
	`equipment_notes` text,
	`access_notes` text,
	`key_notes` text,
	`last_survey_date` timestamp,
	`total_survey_count` int NOT NULL DEFAULT 0,
	`total_case_count` int NOT NULL DEFAULT 0,
	`total_photo_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_master_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_master_store_code_unique` UNIQUE(`store_code`)
);
--> statement-breakpoint
CREATE TABLE `survey_skip_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`store_id` int,
	`reason` enum('過去写真で判断可能','図面あり','軽微な修理','リピート案件','電話ヒアリング済','その他') NOT NULL,
	`reason_detail` text,
	`reference_case_id` int,
	`decided_by` int,
	`decided_by_name` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `survey_skip_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cases` ADD `store_id` int;--> statement-breakpoint
ALTER TABLE `cases` ADD `partner_notes` text;--> statement-breakpoint
CREATE INDEX `idx_store_master_code` ON `store_master` (`store_code`);--> statement-breakpoint
CREATE INDEX `idx_store_master_brand` ON `store_master` (`brand`);--> statement-breakpoint
CREATE INDEX `idx_store_master_pref` ON `store_master` (`prefecture`);--> statement-breakpoint
CREATE INDEX `idx_skip_case` ON `survey_skip_logs` (`case_id`);--> statement-breakpoint
CREATE INDEX `idx_skip_store` ON `survey_skip_logs` (`store_id`);--> statement-breakpoint
CREATE INDEX `idx_cases_store` ON `cases` (`store_id`);