CREATE TABLE `store_distribution_boards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`store_id` int NOT NULL,
	`board_name` varchar(128),
	`location` varchar(255),
	`capacity` varchar(64),
	`circuit_count` int,
	`photo_file_key` varchar(512) NOT NULL,
	`memo` text,
	`photographed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_distribution_boards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_environment_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`store_id` int NOT NULL,
	`measurement_area` enum('天井内','厨房内') NOT NULL,
	`temperature` decimal(5,1),
	`humidity` decimal(5,1),
	`measured_at` timestamp,
	`measured_by` varchar(128),
	`case_id` int,
	`memo` text,
	`photo_file_key` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `store_environment_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_exhaust_hoods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`store_id` int NOT NULL,
	`location` varchar(128),
	`hood_type` varchar(128),
	`exhaust_volume` varchar(64),
	`motor_model` varchar(128),
	`filter_size` varchar(64),
	`memo` text,
	`photo_file_key` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_exhaust_hoods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_grease_traps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`store_id` int NOT NULL,
	`location` varchar(128),
	`model_number` varchar(128),
	`lid_size` varchar(64),
	`lid_material` varchar(64),
	`capacity` varchar(64),
	`memo` text,
	`photo_file_key` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_grease_traps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_leak_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`store_id` int NOT NULL,
	`leak_type` enum('雨漏り','漏電') NOT NULL,
	`occurred_at` timestamp,
	`location` varchar(255),
	`severity` enum('軽微','中程度','重大') DEFAULT '中程度',
	`cause` text,
	`repair_content` text,
	`repair_date` timestamp,
	`case_id` int,
	`memo` text,
	`photo_file_keys` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_leak_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cases` ADD `reportStatus` enum('draft','completed') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `cases` ADD `reportCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `cases` ADD `reportCompletedBy` varchar(128);--> statement-breakpoint
ALTER TABLE `cases` ADD `reportPdfUrl` varchar(1000);--> statement-breakpoint
ALTER TABLE `cases` ADD `reportPdfGeneratedAt` timestamp;--> statement-breakpoint
CREATE INDEX `idx_board_store` ON `store_distribution_boards` (`store_id`);--> statement-breakpoint
CREATE INDEX `idx_env_store` ON `store_environment_logs` (`store_id`);--> statement-breakpoint
CREATE INDEX `idx_env_area` ON `store_environment_logs` (`measurement_area`);--> statement-breakpoint
CREATE INDEX `idx_exhaust_store` ON `store_exhaust_hoods` (`store_id`);--> statement-breakpoint
CREATE INDEX `idx_grease_store` ON `store_grease_traps` (`store_id`);--> statement-breakpoint
CREATE INDEX `idx_leak_store` ON `store_leak_history` (`store_id`);--> statement-breakpoint
CREATE INDEX `idx_leak_type` ON `store_leak_history` (`leak_type`);