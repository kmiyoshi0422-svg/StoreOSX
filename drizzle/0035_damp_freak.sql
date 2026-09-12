CREATE TABLE `pdf_generation_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int,
	`report_type` enum('現場調査報告書','施工完了報告書','写真台帳','写真台帳一括','ダッシュボード','効果検証','横断工程表','その他') NOT NULL,
	`file_name` varchar(500) NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`file_url` varchar(1000) NOT NULL,
	`file_size` int,
	`generated_by` int NOT NULL,
	`generated_by_name` varchar(128),
	`period_start` timestamp,
	`period_end` timestamp,
	`metadata` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pdf_generation_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_pdf_history_case` ON `pdf_generation_history` (`case_id`);--> statement-breakpoint
CREATE INDEX `idx_pdf_history_type_created` ON `pdf_generation_history` (`report_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_pdf_history_generated_by` ON `pdf_generation_history` (`generated_by`);--> statement-breakpoint
CREATE INDEX `idx_pdf_history_created_at` ON `pdf_generation_history` (`created_at`);