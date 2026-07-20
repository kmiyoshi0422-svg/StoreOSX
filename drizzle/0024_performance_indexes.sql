-- 案件テーブル（cases）のパフォーマンスインデックス追加
-- ステータス別一覧（最新順）の高速化
CREATE INDEX `idx_cases_status_created` ON `cases` (`status`, `createdAt`);--> statement-breakpoint
-- 進捗ステージ別フィルタの高速化
CREATE INDEX `idx_cases_progress_stage` ON `cases` (`progressStage`);--> statement-breakpoint
-- 担当者別の案件一覧の高速化
CREATE INDEX `idx_cases_assignee_status` ON `cases` (`assigneeId`, `status`);--> statement-breakpoint
-- 県別フィルタの高速化
CREATE INDEX `idx_cases_prefecture_status` ON `cases` (`prefecture`, `status`);--> statement-breakpoint
-- 店舗コード検索の高速化
CREATE INDEX `idx_cases_store_code` ON `cases` (`storeCode`);--> statement-breakpoint
-- 依頼日順ソートの高速化
CREATE INDEX `idx_cases_request_date` ON `cases` (`requestDate`);--> statement-breakpoint
-- 写真テーブル（photos）のインデックス追加
-- 案件×写真種別での取得を高速化
CREATE INDEX `idx_photos_case_type` ON `photos` (`caseId`, `photoType`);--> statement-breakpoint
-- 案件内の表示順取得の高速化
CREATE INDEX `idx_photos_case_order` ON `photos` (`caseId`, `orderNo`);--> statement-breakpoint
-- チェックリストテーブルのインデックス追加
CREATE INDEX `idx_checklist_case_phase` ON `checklist_items` (`caseId`, `phase`);--> statement-breakpoint
-- 経費テーブルのインデックス追加
CREATE INDEX `idx_expenses_case_id` ON `expenses` (`caseId`);--> statement-breakpoint
-- 見積書テーブルのインデックス追加
CREATE INDEX `idx_estimates_case_id` ON `estimates` (`caseId`);--> statement-breakpoint
-- ルート割り振りテーブルのインデックス追加
CREATE INDEX `idx_route_assignments_date_team` ON `route_assignments` (`scheduledDate`, `team`);--> statement-breakpoint
-- 工程スケジュールテーブルのインデックス追加
CREATE INDEX `idx_case_schedules_case_id` ON `case_schedules` (`caseId`);--> statement-breakpoint
-- 雨漏り点検テーブルのインデックス追加
CREATE INDEX `idx_rain_leak_items_inspection` ON `rain_leak_check_items` (`inspectionId`);
