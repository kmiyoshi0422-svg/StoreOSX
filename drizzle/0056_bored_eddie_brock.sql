CREATE TABLE `staff_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('user','admin','executive') NOT NULL,
	`area_access_mode` enum('all','selected') NOT NULL DEFAULT 'all',
	`allowed_prefectures` text,
	`state` enum('pending','active','canceled') NOT NULL DEFAULT 'pending',
	`version` int NOT NULL DEFAULT 1,
	`user_id` int,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_registrations_email_unique` UNIQUE(`email`),
	CONSTRAINT `staff_registrations_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `owner_management_logs` MODIFY COLUMN `kind` enum('user_category','case_assignment','user_profile','partner_profile','user_lifecycle','staff_registration') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `disabled_at` timestamp;