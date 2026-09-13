CREATE TABLE `internal_case_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientUserId` int NOT NULL,
	`caseId` int NOT NULL,
	`notificationType` enum('partner_short_impression') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`actorUserId` int,
	`actorName` varchar(128),
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `internal_case_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_internal_case_notifications_recipient_created` ON `internal_case_notifications` (`recipientUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_internal_case_notifications_recipient_read` ON `internal_case_notifications` (`recipientUserId`,`readAt`);--> statement-breakpoint
CREATE INDEX `idx_internal_case_notifications_case` ON `internal_case_notifications` (`caseId`);