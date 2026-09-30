CREATE TABLE `estimate_ai_candidate_edits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidate_id` int NOT NULL,
	`case_id` int NOT NULL,
	`draft_id` int NOT NULL,
	`before_json` text,
	`after_json` text,
	`changed_fields` varchar(255) NOT NULL,
	`changed_by` int NOT NULL,
	`changed_at` bigint NOT NULL,
	CONSTRAINT `estimate_ai_candidate_edits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `estimate_ai_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`case_id` int NOT NULL,
	`ordinal` int NOT NULL,
	`original_json` text NOT NULL,
	`decision` enum('pending','adopt','exclude') NOT NULL DEFAULT 'pending',
	`decided_by` int,
	`decided_at` bigint,
	`draft_id` int,
	`latest_saved_json` text,
	CONSTRAINT `estimate_ai_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `estimate_ai_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`source_kind` enum('case_pdf','case_text','uploaded_pdf') NOT NULL,
	`model_id` varchar(120) NOT NULL,
	`discrepancy_json` text,
	`generated_by` int NOT NULL,
	`generated_at` bigint NOT NULL,
	CONSTRAINT `estimate_ai_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_estimate_ai_edits_case_time` ON `estimate_ai_candidate_edits` (`case_id`,`changed_at`);--> statement-breakpoint
CREATE INDEX `idx_estimate_ai_edits_candidate` ON `estimate_ai_candidate_edits` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `idx_estimate_ai_candidates_run` ON `estimate_ai_candidates` (`run_id`,`decision`);--> statement-breakpoint
CREATE INDEX `idx_estimate_ai_candidates_draft` ON `estimate_ai_candidates` (`draft_id`);--> statement-breakpoint
CREATE INDEX `idx_estimate_ai_candidates_case` ON `estimate_ai_candidates` (`case_id`);--> statement-breakpoint
CREATE INDEX `idx_estimate_ai_runs_case_time` ON `estimate_ai_runs` (`case_id`,`generated_at`);