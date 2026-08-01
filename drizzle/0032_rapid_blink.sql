ALTER TABLE `cases` ADD `expenseBudget` int;--> statement-breakpoint
ALTER TABLE `expenses` ADD `approvalStatus` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `expenses` ADD `approvedByName` varchar(128);--> statement-breakpoint
ALTER TABLE `expenses` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `expenses` ADD `rejectionReason` text;