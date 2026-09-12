ALTER TABLE `cases` MODIFY COLUMN `status` enum('受付','現調中','見積中','施工待ち','施工中','完了','クローズ','失注') NOT NULL DEFAULT '受付';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','executive','admin','owner','partner','customer') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `cases` MODIFY COLUMN `status` enum('受付','現調中','見積中','施工待ち','施工中','完了','クローズ','失注') NOT NULL DEFAULT '受付';--> statement-breakpoint
ALTER TABLE `cases` ADD `lostReason` enum('高額なため','対応に不備','別業者手配','その他');--> statement-breakpoint
ALTER TABLE `cases` ADD `lostReasonDetail` text;--> statement-breakpoint
ALTER TABLE `cases` ADD `lostAt` timestamp;--> statement-breakpoint
ALTER TABLE `cases` ADD `lostBy` int;--> statement-breakpoint
ALTER TABLE `cases` ADD `preLostStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `areaAccessMode` enum('all','selected') DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `allowedPrefectures` text;
