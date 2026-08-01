import { int, bigint, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, unique, index, decimal } from "drizzle-orm/mysql-core";

/**
 * ユーザーテーブル（OAuth認証）
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "owner", "partner"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 案件テーブル（プレナス修理依頼）
 */
export const cases = mysqlTable("cases", {
  id: int("id").autoincrement().primaryKey(),
  // プレナスシステム項目
  requestNumber: varchar("requestNumber", { length: 64 }).notNull().unique(), // 依頼番号 例:284909-1
  brand: mysqlEnum("brand", ["ほっともっと", "やよい軒", "その他"]).default("ほっともっと").notNull(),
  storeName: varchar("storeName", { length: 255 }).notNull(), // 店舗名
  storeCode: varchar("storeCode", { length: 64 }), // 店舗コード
  shopId: varchar("shopId", { length: 64 }), // SHOP-ID
  prefecture: varchar("prefecture", { length: 16 }), // 都道府県（県別分類用の独立項目）
  address: text("address"), // 住所
  latitude: varchar("latitude", { length: 32 }), // ジオコーディング編度
  longitude: varchar("longitude", { length: 32 }), // ジオコーディング経度
  storePhone: varchar("storePhone", { length: 32 }), // 店舗電話
  businessHours: varchar("businessHours", { length: 64 }), // 営業時間
  // 依頼内容
  requestDate: timestamp("requestDate"), // 依頼日時
  requesterName: varchar("requesterName", { length: 128 }), // 依頼者名
  requesterPhone: varchar("requesterPhone", { length: 32 }), // 依頼者連絡先
  requestContent: text("requestContent"), // 依頼内容
  // 工事区分
  workType: mysqlEnum("workType", ["入替", "修理", "納品", "見積り", "新規"]).default("修理"),
  costBearer: mysqlEnum("costBearer", ["店舗", "営業部", "その他"]).default("店舗"),
  // 修理内容（大中小項目）
  categoryLarge: varchar("categoryLarge", { length: 128 }), // 内外装・サッシ・建築 等
  categoryMedium: varchar("categoryMedium", { length: 128 }), // サッシ・自動ドア 等
  categorySmall: varchar("categorySmall", { length: 128 }), // 修理交換 等
  // 取引先・協力会社
  contractorName: varchar("contractorName", { length: 255 }),
  contractorPic: varchar("contractorPic", { length: 128 }),
  contractorPhone: varchar("contractorPhone", { length: 32 }),
  partnerId: int("partnerId"), // partners.id 協力会社マスタへのリンク
  // 進捗ステージ（4区分）
  progressStage: mysqlEnum("progressStage", [
    "未対応",
    "現調済",
    "見積提出済",
    "承認済",
  ]).default("未対応").notNull(),
  // 協力業者向け共有トークン（/partner-view/[token]）
  partnerToken: varchar("partnerToken", { length: 64 }),
  // 進捗管理
  status: mysqlEnum("status", [
    "受付",       // 依頼受付
    "現調中",     // 現場調査中
    "見積中",     // 見積作成中
    "施工待ち",   // 施工日確定待ち
    "施工中",     // 工事中
    "完了",       // 完了
    "クローズ",   // クローズ
  ]).default("受付").notNull(),
  urgency: mysqlEnum("urgency", ["S", "A", "B", "C"]).default("B").notNull(),
  // 担当者
  assigneeId: int("assigneeId"), // users.id
  // 見積（予算）
  estimatedCost: int("estimatedCost"), // 協力業者の見積金額合計＝原価（円）
  plenusQuoteAmount: int("plenusQuoteAmount"), // プレナスへ提出した見積金額＝売上/請求額（円）
  estimatedMaterialCost: int("estimatedMaterialCost"), // 見積：材料費
  estimatedLaborCost: int("estimatedLaborCost"), // 見積：作業費
  is10mYen: boolean("is10mYen").default(false), // 10万円超フラグ
  // 管理費・現場経費
  managementFee: int("managementFee"), // 自社管理費（円）
  siteExpense: int("siteExpense"), // 現場経費（円）
  ownSurveyCost: int("ownSurveyCost"), // 自社現調費（円）
  partnerSurveyCost: int("partnerSurveyCost"), // パートナー現調費（円）
  transportCost: int("transportCost"), // 交通費（円）
  laborCost: int("laborCost"), // 人件費（円）
  // 実績
  actualCost: int("actualCost"), // 実績金額合計（円）
  expenseBudget: int("expenseBudget"), // 経費予算上限（円）
  actualMaterialCost: int("actualMaterialCost"), // 実績：材料費
  actualLaborCost: int("actualLaborCost"), // 実績：作業費
  invoiceNumber: varchar("invoiceNumber", { length: 64 }), // 請求書番号
  invoiceDate: timestamp("invoiceDate"), // 請求日
  // 工期
  surveyDate: timestamp("surveyDate"), // 現調日
  constructionDate: timestamp("constructionDate"), // 施工日
  completedAt: timestamp("completedAt"), // 完了日
  // メタ
    notes: text("notes"),
  // 現調報告書 所感
  surveyImpression: text("surveyImpression"), // 所感テキスト
  surveyImpressionAuthor: varchar("surveyImpressionAuthor", { length: 128 }), // 記入者名
  // 再訪記録
  revisitCount: int("revisitCount").default(0).notNull(), // 再訪回数（0=再訪なし）
  amountApproved: boolean("amountApproved").default(false).notNull(), // 金額公開承認（協力業者に見せるか）
  storeId: int("store_id"), // 店舗マスタへの外部キー
  partnerNotes: text("partner_notes"), // 協力業者作業メモ
  partnerNotesUpdatedAt: timestamp("partner_notes_updated_at"), // 作業メモ最終更新日時
  partnerNotesUpdatedBy: varchar("partner_notes_updated_by", { length: 128 }), // 作業メモ更新者名
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  statusCreatedIdx: index("idx_cases_status_created").on(t.status, t.createdAt),
  progressStageIdx: index("idx_cases_progress_stage").on(t.progressStage),
  assigneeIdx: index("idx_cases_assignee").on(t.assigneeId),
  brandIdx: index("idx_cases_brand").on(t.brand),
  partnerIdx: index("idx_cases_partner").on(t.partnerId),
  storeIdx: index("idx_cases_store").on(t.storeId),
}));
export type Case = typeof cases.$inferSelect;
export type InsertCase = typeof cases.$inferInsert;

/**
 * チェックリスト項目（業務フロー順）
 */
export const checklistItems = mysqlTable("checklist_items", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  phase: mysqlEnum("phase", ["受付", "現調", "施工", "完了"]).notNull(),
  orderNo: int("orderNo").notNull(), // 表示順
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  checked: boolean("checked").default(false).notNull(),
  checkedAt: timestamp("checkedAt"),
  checkedBy: int("checkedBy"),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  caseIdx: index("idx_checklist_case").on(t.caseId),
}));

export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertChecklistItem = typeof checklistItems.$inferInsert;

/**
 * 写真テーブル
 */
export const photos = mysqlTable("photos", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  // S3ファイル参照
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 512 }).notNull(),
  // 写真分類
  photoType: mysqlEnum("photoType", [
    "施工前A",    // 全景
    "施工前B",    // 近景
    "施工中",     // 施工中の状況
    "施工後A",    // 全景
    "施工後B",    // 近景
    "設置状況",
    "メーカー型番",
    "現調",
    "その他",
  ]).default("現調").notNull(),
  // 工事項目（写真ごとに紐付け）
  workCategory: varchar("workCategory", { length: 128 }), // 例: 内外装・サッシ
  workItem: varchar("workItem", { length: 255 }), // 例: 自動ドア修理
  memo: text("memo"), // メモ・備考
  // 表示の向き（時計回りの回転角度: 0/90/180/270）
  rotation: int("rotation").default(0).notNull(),
  // 順序
  orderNo: int("orderNo").default(0).notNull(),
  // 撮影日時（EXIFまたはアップロード時刻）
  takenAt: timestamp("takenAt"),
  // メタ
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  caseIdx: index("idx_photos_case").on(t.caseId),
}));

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;

/**
 * アプリ設定（キーバリューストア）
 */
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 128 }).notNull().unique(),
  settingValue: text("settingValue").notNull(), // JSON形式で保存
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

/**
 * 協力会社マスタ
 */
export const partners = mysqlTable("partners", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // 会社名
  category: mysqlEnum("category", [
    "電気",
    "給排水",
    "空調",
    "厨房設備",
    "排気・換気",
    "内装",
    "床",
    "看板",
    "外壁",
    "建具",
    "防水",
    "その他",
  ]).default("その他").notNull(),
  phone: varchar("phone", { length: 32 }), // 代表電話
  pic: varchar("pic", { length: 128 }), // 担当者名
  picPhone: varchar("picPhone", { length: 32 }), // 担当者携帯
  email: varchar("email", { length: 320 }),
  address: text("address"),
  area: varchar("area", { length: 128 }), // 対応エリア
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  userId: int("userId"), // users.id 協力業者ユーザーとの紐付け
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = typeof partners.$inferInsert;

/**
 * 見積書テーブル（PDF/画像アップロード + LLM抽出金額）
 */
export const estimates = mysqlTable("estimates", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 512 }).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  mimeType: varchar("mimeType", { length: 64 }),
  // プレナスへの見積金額（原価・全額）
  totalAmount: int("totalAmount"),
  materialAmount: int("materialAmount"),
  laborAmount: int("laborAmount"),
  vendorName: varchar("vendorName", { length: 255 }),
  estimateDate: timestamp("estimateDate"),
  note: text("note"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  caseIdx: index("idx_estimates_case").on(t.caseId),
}));

export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = typeof estimates.$inferInsert;

/**
 * ルート割り振り（2チーム制の現調・工事スケジュール）
 */
export const routeAssignments = mysqlTable("route_assignments", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  team: mysqlEnum("team", ["A", "B"]).notNull(),
  taskType: mysqlEnum("taskType", ["survey", "construction"]).notNull(), // 現調 or 工事
  scheduledDate: varchar("scheduledDate", { length: 10 }).notNull(), // YYYY-MM-DD
  sequence: int("sequence").default(0).notNull(), // 同一チーム/同一日の訪問順
  assigneeId: int("assigneeId"), // users.id
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  caseIdx: index("idx_routes_case").on(t.caseId),
  dateIdx: index("idx_routes_date").on(t.scheduledDate),
  teamDateIdx: index("idx_routes_team_date").on(t.team, t.scheduledDate),
}));

export type RouteAssignment = typeof routeAssignments.$inferSelect;
export type InsertRouteAssignment = typeof routeAssignments.$inferInsert;

/**
 * チーム設定（v13: チームA/Bの担当者割り振り）
 * 全システムで全グローバルシングルトンとして保持（1行/チーム）
 */
export const teamSettings = mysqlTable("team_settings", {
  id: int("id").autoincrement().primaryKey(),
  team: mysqlEnum("team", ["A", "B"]).notNull(),
  primaryUserId: int("primaryUserId"), // 代表担当者
  label: varchar("label", { length: 64 }), // チーム名（例：×街×チーム）
  color: varchar("color", { length: 16 }), // 表示色 hex
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeamSetting = typeof teamSettings.$inferSelect;
export type InsertTeamSetting = typeof teamSettings.$inferInsert;

/**
 * チームメンバー（v33: 1チームに複数メンバーを登録）
 * team ごとに userId を複数保持。代表担当者(team_settings.primaryUserId)とは別軸。
 */
export const teamMembers = mysqlTable("team_members", {
  id: int("id").autoincrement().primaryKey(),
  team: mysqlEnum("team", ["A", "B"]).notNull(),
  userId: int("userId").notNull(), // users.id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniqTeamUser: unique("uniq_team_user").on(t.team, t.userId),
}));

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

/**
 * 経費テーブル（v19: PDF/画像から取り込む経費を案件に自動紐付け）
 */
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId"), // null可（全体経費・マッチ前は未確定）
  scope: mysqlEnum("scope", ["案件", "全体"]).default("案件").notNull(), // 案件紐付か全体共通経費か
  fileKey: varchar("fileKey", { length: 512 }),
  fileUrl: varchar("fileUrl", { length: 512 }),
  fileName: varchar("fileName", { length: 255 }),
  mimeType: varchar("mimeType", { length: 64 }),
  vendorName: varchar("vendorName", { length: 255 }), // 業者名・支払先
  amount: int("amount").notNull(), // 税込金額
  taxAmount: int("taxAmount"), // 内消費税
  expenseDate: timestamp("expenseDate"), // 支払日・領収日
  category: mysqlEnum("category", [
    "材料費",
    "外注費",
    "交通費",
    "消耗品",
    "車両費",
    "宿泊費",
    "接待交際費",
    "人件費",
    "現調費",
    "その他",
  ]).default("その他").notNull(),
  note: text("note"),
  uploadedBy: int("uploadedBy"),
  createdByName: varchar("createdByName", { length: 128 }), // 入力者名
  updatedByName: varchar("updatedByName", { length: 128 }), // 最終更新者名
  // 承認ワークフロー
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedBy: int("approvedBy"), // 承認者 users.id
  approvedByName: varchar("approvedByName", { length: 128 }),
  approvedAt: timestamp("approvedAt"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  caseIdx: index("idx_expenses_case").on(t.caseId),
}));

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

/**
 * 報告書署名テーブル（v37: 現場調査報告書／施工完了報告書のプレナス責任者サインを保存）
 * 案件×報告書種別ごとに1件（upsert）。署名画像はS3に保存し、ここには参照のみ保持する。
 */
export const caseSignatures = mysqlTable("case_signatures", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  reportType: mysqlEnum("reportType", ["survey", "completion"]).notNull(), // survey=現場調査 / completion=施工完了
  signerName: varchar("signerName", { length: 128 }), // サイン者名（プレナス責任者）
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3ファイルキー（署名PNG）
  fileUrl: varchar("fileUrl", { length: 512 }).notNull(), // /manus-storage/ 参照URL
  signedAt: timestamp("signedAt").defaultNow().notNull(), // サイン日時
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uniqCaseReport: unique("uniq_case_report").on(t.caseId, t.reportType),
}));
export type CaseSignature = typeof caseSignatures.$inferSelect;
export type InsertCaseSignature = typeof caseSignatures.$inferInsert;


/**
 * 施工完了報告書ドラフト（v40: 参考PDF準拠の完了報告書セクション文章を保存）
 * 案件ごとに1件（upsert）。AI生成した本文＋手編集後の内容をJSONで保持し、
 * 再生成しても手編集が消えないように content をそのまま保存する。
 * 金額は一切保持しない。
 */
export const caseReportDrafts = mysqlTable("case_report_drafts", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  // セクション本文・評価表・写真キャプション等をまとめたJSON文字列
  content: text("content").notNull(),
  generatedAt: timestamp("generatedAt"), // 最終AI生成日時
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uniqCase: unique("uniq_report_draft_case").on(t.caseId),
}));
export type CaseReportDraft = typeof caseReportDrafts.$inferSelect;
export type InsertCaseReportDraft = typeof caseReportDrafts.$inferInsert;

/**
 * 全角化の除外辞書（v41: 型番・メールアドレス・固有名詞など、
 * PDF出力時に半角のまま残したい語を登録する）。
 * term は完全一致で保護され、周囲のテキストだけが全角化・括弧除去される。
 */
export const fullwidthExclusions = mysqlTable("fullwidth_exclusions", {
  id: int("id").autoincrement().primaryKey(),
  term: varchar("term", { length: 255 }).notNull().unique(), // 保護する語（例: ABC-123X）
  note: varchar("note", { length: 255 }), // メモ（任意）
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FullwidthExclusion = typeof fullwidthExclusions.$inferSelect;
export type InsertFullwidthExclusion = typeof fullwidthExclusions.$inferInsert;

/**
 * 案件工程スケジュール（ガントチャート式工程管理）
 */
export const caseSchedules = mysqlTable("case_schedules", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  title: varchar("title", { length: 255 }).notNull(), // 工程名
  startDate: varchar("startDate", { length: 10 }).notNull(), // YYYY-MM-DD
  endDate: varchar("endDate", { length: 10 }).notNull(), // YYYY-MM-DD
  status: mysqlEnum("status", ["予定", "進行中", "完了"]).default("予定").notNull(),
  color: varchar("color", { length: 16 }).default("#3b82f6"), // 表示色 hex
  memo: text("memo"),
  progress: int("progress").default(0).notNull(), // 進捗率 0-100%
  orderNo: int("orderNo").default(0).notNull(), // 表示順
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  caseIdx: index("idx_schedules_case").on(t.caseId),
  datesIdx: index("idx_schedules_dates").on(t.startDate, t.endDate),
}));
export type CaseSchedule = typeof caseSchedules.$inferSelect;
export type InsertCaseSchedule = typeof caseSchedules.$inferInsert;


/**
 * 工程テンプレートテーブル
 */
export const scheduleTemplates = mysqlTable("schedule_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // テンプレート名 例: "サッシ修理5工程セット"
  description: text("description"), // 説明
  items: text("items").notNull(), // JSON: [{title, durationDays, color, memo, orderNo}]
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ScheduleTemplate = typeof scheduleTemplates.$inferSelect;
export type InsertScheduleTemplate = typeof scheduleTemplates.$inferInsert;


/**
 * 雨漏り調査チェックリスト（案件ごとに1件）
 * 表紙情報 + 総括所見 + 浸入経路推定をJSONで保持
 */
export const rainLeakInspections = mysqlTable("rain_leak_inspections", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  // 表紙情報
  inspectionDate: varchar("inspectionDate", { length: 10 }), // YYYY-MM-DD
  buildingStructure: varchar("buildingStructure", { length: 128 }), // 建物構造
  buildingAge: varchar("buildingAge", { length: 64 }), // 築年数
  inspector: varchar("inspector", { length: 128 }), // 調査員
  weather: varchar("weather", { length: 64 }), // 天候
  // 浸入経路推定（JSON配列: [{location, suspect1, suspect2, suspect3, applicable}]）
  routeEstimations: text("routeEstimations"),
  // 総括所見（JSON: {overview, symptoms, cause, urgencyReason, plan, remarks, nextInspection}）
  summary: text("summary"),
  // 集計
  totalIssueCount: int("totalIssueCount").default(0).notNull(),
  urgentCount: int("urgentCount").default(0).notNull(), // 🔴
  cautionCount: int("cautionCount").default(0).notNull(), // 🟡
  observeCount: int("observeCount").default(0).notNull(), // 🟢
  overallJudgment: varchar("overallJudgment", { length: 64 }), // 緊急度判定
  // メタ
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uniqCase: unique("uniq_rain_leak_case").on(t.caseId),
}));
export type RainLeakInspection = typeof rainLeakInspections.$inferSelect;
export type InsertRainLeakInspection = typeof rainLeakInspections.$inferInsert;

/**
 * 雨漏り調査チェック項目（各チェック項目の記録）
 */
export const rainLeakCheckItems = mysqlTable("rain_leak_check_items", {
  id: int("id").autoincrement().primaryKey(),
  inspectionId: int("inspectionId").notNull(), // rain_leak_inspections.id
  // セクション区分
  section: mysqlEnum("section", ["室内", "天井裏", "外部"]).notNull(),
  // 項目情報
  orderNo: int("orderNo").notNull(), // 表示順
  category: varchar("category", { length: 64 }).notNull(), // 例: 天井, 壁, 窓, 屋根
  itemTitle: varchar("itemTitle", { length: 255 }).notNull(), // チェック項目名
  // 記録
  status: mysqlEnum("status", ["未確認", "有", "無", "不明"]).default("未確認").notNull(),
  urgency: mysqlEnum("urgency", ["none", "urgent", "caution", "observe"]).default("none").notNull(), // 🔴/🟡/🟢/-
  memo: text("memo"),
  photoNo: varchar("photoNo", { length: 32 }), // 写真番号
  // メタ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RainLeakCheckItem = typeof rainLeakCheckItems.$inferSelect;
export type InsertRainLeakCheckItem = typeof rainLeakCheckItems.$inferInsert;


/**
 * 案件ドキュメント（図面・仕様書・資料）
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId"), // NULL = shared/common document (not tied to a specific case)
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"), // bytes
  category: mysqlEnum("category", ["図面", "仕様書", "見積書", "報告書", "写真", "担当者一覧", "施工対象一覧", "マニュアル", "その他"]).default("その他").notNull(),
  tags: text("tags"), // JSON array of tags for flexible categorization
  memo: text("memo"),
  uploadedBy: int("uploadedBy"),
  isLocked: int("isLocked").default(0).notNull(), // 1 = locked (restricted access)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  caseIdx: index("idx_documents_case").on(t.caseId),
}));
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ============================================================
// Project Folders (共通資料を案件グループに紐づけ)
// ============================================================
export const projectFolders = mysqlTable("project_folders", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ProjectFolder = typeof projectFolders.$inferSelect;
export type InsertProjectFolder = typeof projectFolders.$inferInsert;

export const projectFolderCases = mysqlTable("project_folder_cases", {
  id: int("id").autoincrement().primaryKey(),
  folderId: int("folderId").notNull(),
  caseId: int("caseId").notNull(),
});
export type ProjectFolderCase = typeof projectFolderCases.$inferSelect;

export const projectFolderDocuments = mysqlTable("project_folder_documents", {
  id: int("id").autoincrement().primaryKey(),
  folderId: int("folderId").notNull(),
  documentId: int("documentId").notNull(),
});
export type ProjectFolderDocument = typeof projectFolderDocuments.$inferSelect;

// ============================================================
// Document Versions (バージョン管理)
// ============================================================
export const documentVersions = mysqlTable("document_versions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  version: int("version").notNull(), // 1, 2, 3...
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileSize: int("fileSize"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = typeof documentVersions.$inferInsert;

// ============================================================
// Revisit Logs (再訪記録)
// ============================================================
export const revisitLogs = mysqlTable("revisit_logs", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("case_id").notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  note: text("note"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  createdBy: varchar("created_by", { length: 255 }),
});
export type RevisitLog = typeof revisitLogs.$inferSelect;
export type InsertRevisitLog = typeof revisitLogs.$inferInsert;


// ============================================================
// Status Change Logs (ステータス変更履歴)
// ============================================================
export const statusLogs = mysqlTable("status_logs", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("case_id").notNull(),
  userId: int("user_id"),
  userName: varchar("user_name", { length: 255 }),
  fromStatus: varchar("from_status", { length: 50 }),
  toStatus: varchar("to_status", { length: 50 }).notNull(),
  comment: text("comment"),
  photoUrls: text("photo_urls"), // JSON array of photo URLs
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type StatusLog = typeof statusLogs.$inferSelect;
export type InsertStatusLog = typeof statusLogs.$inferInsert;

// ============================================================
// 店舗マスタ（正規化された店舗情報）
// ============================================================
export const storeMaster = mysqlTable("store_master", {
  id: int("id").autoincrement().primaryKey(),
  storeCode: varchar("store_code", { length: 64 }).unique(), // 店舗コード
  storeName: varchar("store_name", { length: 255 }).notNull(),
  brand: mysqlEnum("brand", ["ほっともっと", "やよい軒", "その他"]).default("ほっともっと").notNull(),
  prefecture: varchar("prefecture", { length: 16 }),
  address: text("address"),
  phone: varchar("phone", { length: 32 }),
  businessHours: varchar("business_hours", { length: 64 }),
  // 店舗固有の蓄積情報
  floorPlanUrl: varchar("floor_plan_url", { length: 512 }), // 図面URL
  equipmentNotes: text("equipment_notes"), // 設備メモ（型番・設置年等）
  accessNotes: text("access_notes"), // アクセス方法・駐車場情報
  keyNotes: text("key_notes"), // 鍵の場所・管理方法
  // 現調実績サマリ
  lastSurveyDate: timestamp("last_survey_date"), // 最終現調日
  totalSurveyCount: int("total_survey_count").default(0).notNull(), // 累計現調回数
  totalCaseCount: int("total_case_count").default(0).notNull(), // 累計案件数
  totalPhotoCount: int("total_photo_count").default(0).notNull(), // 累計写真枚数
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeCodeIdx: index("idx_store_master_code").on(t.storeCode),
  brandIdx: index("idx_store_master_brand").on(t.brand),
  prefectureIdx: index("idx_store_master_pref").on(t.prefecture),
}));
export type StoreMaster = typeof storeMaster.$inferSelect;
export type InsertStoreMaster = typeof storeMaster.$inferInsert;

// ============================================================
// 現調スキップログ（現調省略の判断記録）
// ============================================================
export const surveySkipLogs = mysqlTable("survey_skip_logs", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("case_id").notNull(),
  storeId: int("store_id"), // store_master.id
  reason: mysqlEnum("reason", [
    "過去写真で判断可能",
    "図面あり",
    "軽微な修理",
    "リピート案件",
    "電話ヒアリング済",
    "その他",
  ]).notNull(),
  reasonDetail: text("reason_detail"), // その他の場合の詳細
  referenceCaseId: int("reference_case_id"), // 参照した過去案件
  decidedBy: int("decided_by"), // 判断者 users.id
  decidedByName: varchar("decided_by_name", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  caseIdx: index("idx_skip_case").on(t.caseId),
  storeIdx: index("idx_skip_store").on(t.storeId),
}));
export type SurveySkipLog = typeof surveySkipLogs.$inferSelect;
export type InsertSurveySkipLog = typeof surveySkipLogs.$inferInsert;

/**
 * AI生成失敗時の一時保存キュー
 */
export const pendingAiTasks = mysqlTable("pending_ai_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  taskType: varchar("task_type", { length: 64 }).notNull(), // 'impression' | 'reportDraft'
  caseId: int("case_id").notNull(),
  params: text("params"), // JSONシリアライズされたパラメータ
  status: mysqlEnum("status", ["pending", "retrying", "resolved", "failed"]).default("pending").notNull(),
  errorMessage: text("error_message"),
  retryCount: int("retry_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (t) => ({
  userIdx: index("idx_pending_ai_user").on(t.userId),
  statusIdx: index("idx_pending_ai_status").on(t.status),
  caseIdx: index("idx_pending_ai_case").on(t.caseId),
}));
export type PendingAiTask = typeof pendingAiTasks.$inferSelect;
export type InsertPendingAiTask = typeof pendingAiTasks.$inferInsert;
// ============================================================
// 店舗設備台帳（グリーストラップ、フード排気、温湿度、雨漏り/漏電歴、分電盤写真）
// ============================================================

/**
 * グリーストラップ情報
 */
export const storeGreaseTraps = mysqlTable("store_grease_traps", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("store_id").notNull(), // store_master.id
  location: varchar("location", { length: 128 }), // 設置場所（厨房内、外部等）
  modelNumber: varchar("model_number", { length: 128 }), // 品番
  lidSize: varchar("lid_size", { length: 64 }), // 蓋の大きさ（例: 600x600mm）
  lidMaterial: varchar("lid_material", { length: 64 }), // 蓋の材質（FRP、鉄、ステンレス等）
  capacity: varchar("capacity", { length: 64 }), // 容量
  memo: text("memo"),
  photoFileKey: varchar("photo_file_key", { length: 512 }), // 写真のS3キー
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("idx_grease_store").on(t.storeId),
}));
export type StoreGreaseTrap = typeof storeGreaseTraps.$inferSelect;
export type InsertStoreGreaseTrap = typeof storeGreaseTraps.$inferInsert;

/**
 * フード排気情報
 */
export const storeExhaustHoods = mysqlTable("store_exhaust_hoods", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("store_id").notNull(), // store_master.id
  location: varchar("location", { length: 128 }), // 設置場所
  hoodType: varchar("hood_type", { length: 128 }), // フードの種類
  exhaustVolume: varchar("exhaust_volume", { length: 64 }), // 排気量（例: 2000m³/h）
  motorModel: varchar("motor_model", { length: 128 }), // モーター品番
  filterSize: varchar("filter_size", { length: 64 }), // フィルターサイズ
  memo: text("memo"),
  photoFileKey: varchar("photo_file_key", { length: 512 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("idx_exhaust_store").on(t.storeId),
}));
export type StoreExhaustHood = typeof storeExhaustHoods.$inferSelect;
export type InsertStoreExhaustHood = typeof storeExhaustHoods.$inferInsert;

/**
 * 温湿度記録（天井内・厨房内）
 */
export const storeEnvironmentLogs = mysqlTable("store_environment_logs", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("store_id").notNull(), // store_master.id
  measurementArea: mysqlEnum("measurement_area", ["天井内", "厨房内"]).notNull(),
  temperature: decimal("temperature", { precision: 5, scale: 1 }), // 温度（℃）
  humidity: decimal("humidity", { precision: 5, scale: 1 }), // 湿度（%）
  measuredAt: timestamp("measured_at"), // 計測日時
  measuredBy: varchar("measured_by", { length: 128 }), // 計測者
  caseId: int("case_id"), // 関連案件（あれば）
  memo: text("memo"),
  photoFileKey: varchar("photo_file_key", { length: 512 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("idx_env_store").on(t.storeId),
  areaIdx: index("idx_env_area").on(t.measurementArea),
}));
export type StoreEnvironmentLog = typeof storeEnvironmentLogs.$inferSelect;
export type InsertStoreEnvironmentLog = typeof storeEnvironmentLogs.$inferInsert;

/**
 * 雨漏り歴
 */
export const storeLeakHistory = mysqlTable("store_leak_history", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("store_id").notNull(), // store_master.id
  leakType: mysqlEnum("leak_type", ["雨漏り", "漏電"]).notNull(),
  occurredAt: timestamp("occurred_at"), // 発生日
  location: varchar("location", { length: 255 }), // 発生箇所
  severity: mysqlEnum("severity", ["軽微", "中程度", "重大"]).default("中程度"),
  cause: text("cause"), // 原因
  repairContent: text("repair_content"), // 修理内容
  repairDate: timestamp("repair_date"), // 修理日
  caseId: int("case_id"), // 関連案件
  memo: text("memo"),
  photoFileKeys: text("photo_file_keys"), // 写真のS3キー（JSON配列）
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("idx_leak_store").on(t.storeId),
  typeIdx: index("idx_leak_type").on(t.leakType),
}));
export type StoreLeakHistory = typeof storeLeakHistory.$inferSelect;
export type InsertStoreLeakHistory = typeof storeLeakHistory.$inferInsert;

/**
 * 分電盤写真
 */
export const storeDistributionBoards = mysqlTable("store_distribution_boards", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("store_id").notNull(), // store_master.id
  boardName: varchar("board_name", { length: 128 }), // 分電盤名称（主幹、厨房系統等）
  location: varchar("location", { length: 255 }), // 設置場所
  capacity: varchar("capacity", { length: 64 }), // 容量（例: 60A）
  circuitCount: int("circuit_count"), // 回路数
  photoFileKey: varchar("photo_file_key", { length: 512 }).notNull(), // 写真のS3キー
  memo: text("memo"),
  photographedAt: timestamp("photographed_at"), // 撮影日
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("idx_board_store").on(t.storeId),
}));
export type StoreDistributionBoard = typeof storeDistributionBoards.$inferSelect;
export type InsertStoreDistributionBoard = typeof storeDistributionBoards.$inferInsert;
