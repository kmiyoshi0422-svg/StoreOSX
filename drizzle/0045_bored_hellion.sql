CREATE TABLE `case_request_sources` (
	`case_id` int NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`uploaded_by` int NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `case_request_sources_case_id` PRIMARY KEY(`case_id`)
);
