CREATE TABLE `emergency_survey_date_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`before_date` timestamp,
	`after_date` timestamp,
	`evidence_type` enum('completion_report','survey_report','staff_confirmation','other') NOT NULL,
	`evidence_note` varchar(500) NOT NULL,
	`recorded_by` int NOT NULL,
	`recorded_by_name` varchar(255) NOT NULL,
	`recorded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emergency_survey_date_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_emergency_survey_date_case_recorded` ON `emergency_survey_date_logs` (`case_id`,`recorded_at`);