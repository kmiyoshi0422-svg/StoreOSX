CREATE TABLE IF NOT EXISTS `mobile_access_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`grant_id` int,
	`token_hash` varchar(64) NOT NULL,
	`token_prefix` varchar(12) NOT NULL,
	`device_name` varchar(120) NOT NULL,
	`platform` varchar(20) NOT NULL,
	`last_used_at` timestamp NULL,
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp NULL,
	`revoked_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mobile_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_mobile_token_hash` UNIQUE(`token_hash`),
	KEY `idx_mobile_token_user` (`user_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `mobile_device_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`device_code_hash` varchar(64) NOT NULL,
	`user_code` varchar(8) NOT NULL,
	`device_name` varchar(120) NOT NULL,
	`platform` varchar(20) NOT NULL,
	`status` enum('pending','approved','denied','consumed') NOT NULL DEFAULT 'pending',
	`user_id` int,
	`decided_at` timestamp NULL,
	`expires_at` timestamp NOT NULL,
	`last_polled_at` timestamp NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mobile_device_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_mobile_grant_device_code` UNIQUE(`device_code_hash`),
	CONSTRAINT `uniq_mobile_grant_user_code` UNIQUE(`user_code`),
	KEY `idx_mobile_grant_expires` (`expires_at`)
);
