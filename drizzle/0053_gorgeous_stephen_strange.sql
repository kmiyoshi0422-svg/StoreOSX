CREATE TABLE `case_internal_memos` (
	`case_id` int NOT NULL,
	`body` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`updated_by` int NOT NULL,
	`updated_by_name` varchar(128) NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_internal_memos_case_id` PRIMARY KEY(`case_id`)
);
