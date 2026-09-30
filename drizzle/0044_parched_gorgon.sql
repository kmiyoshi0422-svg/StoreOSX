CREATE TABLE `unit_price_master` (
	`id` varchar(191) NOT NULL,
	`major_category` varchar(120) NOT NULL,
	`category` varchar(120) NOT NULL,
	`name` varchar(255) NOT NULL,
	`specification` varchar(255) NOT NULL DEFAULT '',
	`unit` varchar(40) NOT NULL,
	`low` int NOT NULL,
	`standard` int NOT NULL,
	`high` int NOT NULL,
	`note` text,
	`source_ref` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `unit_price_master_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `unit_price_master_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`price_id` varchar(191) NOT NULL,
	`operation` enum('create','update','delete') NOT NULL,
	`before_json` text,
	`after_json` text,
	`changed_by` int NOT NULL,
	`changed_at` bigint NOT NULL,
	CONSTRAINT `unit_price_master_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `estimate_drafts` ADD `status` enum('draft','approved') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `estimate_drafts` ADD `approved_by` int;--> statement-breakpoint
ALTER TABLE `estimate_drafts` ADD `approved_at` bigint;--> statement-breakpoint
ALTER TABLE `estimate_drafts` ADD `approved_snapshot_json` text;--> statement-breakpoint
CREATE INDEX `idx_unit_price_master_category` ON `unit_price_master` (`major_category`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_unit_price_master_history_price` ON `unit_price_master_history` (`price_id`,`changed_at`);