ALTER TABLE `case_signatures` DROP INDEX `uniq_case_report`;--> statement-breakpoint
ALTER TABLE `case_signatures` ADD `signerRole` enum('staff','customer') DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE `case_signatures` ADD CONSTRAINT `uniq_case_report_role` UNIQUE(`caseId`,`reportType`,`signerRole`);