ALTER TABLE `cases` ADD `reportRejectComment` text;--> statement-breakpoint
ALTER TABLE `cases` ADD `reportRejectedAt` timestamp;--> statement-breakpoint
ALTER TABLE `cases` ADD `reportRejectedBy` varchar(128);