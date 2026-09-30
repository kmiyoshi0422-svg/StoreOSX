CREATE TABLE `estimate_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`source_kind` enum('manual','request_pdf') NOT NULL,
	`source_pdf_key` varchar(512),
	`source_pdf_name` varchar(255),
	`items_json` text NOT NULL,
	`subtotal` int NOT NULL,
	`tax` int NOT NULL,
	`total` int NOT NULL,
	`missing_price_count` int NOT NULL,
	`created_by` int NOT NULL,
	`updated_by` int NOT NULL,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `estimate_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_estimate_drafts_case_updated` ON `estimate_drafts` (`case_id`,`updated_at`);