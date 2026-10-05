CREATE TABLE `estimate_preset_categories` (
	`id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `estimate_preset_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `estimate_preset_items` (
	`id` varchar(64) NOT NULL,
	`category_id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`specification` varchar(255) NOT NULL DEFAULT '',
	`unit` varchar(30) NOT NULL,
	`unit_price` int,
	`note` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `estimate_preset_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_estimate_preset_categories_active_order` ON `estimate_preset_categories` (`is_active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_estimate_preset_items_category_order` ON `estimate_preset_items` (`category_id`,`is_active`,`sort_order`);