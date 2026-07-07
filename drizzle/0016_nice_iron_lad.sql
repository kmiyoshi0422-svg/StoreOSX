ALTER TABLE `photos` MODIFY COLUMN `photoType` enum('施工前A','施工前B','施工中','施工後A','施工後B','設置状況','メーカー型番','現調','その他') NOT NULL DEFAULT '現調';--> statement-breakpoint
ALTER TABLE `cases` ADD `surveyImpression` text;--> statement-breakpoint
ALTER TABLE `cases` ADD `surveyImpressionAuthor` varchar(128);