CREATE TABLE `case_field_memos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`category` enum('状況','確認事項','追加対応','注意','連絡') NOT NULL DEFAULT '状況',
	`body` text NOT NULL,
	`author_user_id` int NOT NULL,
	`author_name` varchar(128) NOT NULL,
	`author_role` varchar(32) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_field_memos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_case_field_memos_case_created` ON `case_field_memos` (`case_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_case_field_memos_author` ON `case_field_memos` (`author_user_id`);