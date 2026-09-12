CREATE TABLE `partner_assignment_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`caseId` int NOT NULL,
	`notificationType` enum('assigned','changed','cancelled') NOT NULL DEFAULT 'assigned',
	`title` varchar(255) NOT NULL,
	`message` text,
	`constructionDate` timestamp,
	`createdBy` int,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_assignment_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_partner_assignment_notifications_partner_created` ON `partner_assignment_notifications` (`partnerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_partner_assignment_notifications_partner_read` ON `partner_assignment_notifications` (`partnerId`,`readAt`);--> statement-breakpoint
CREATE INDEX `idx_partner_assignment_notifications_case` ON `partner_assignment_notifications` (`caseId`);