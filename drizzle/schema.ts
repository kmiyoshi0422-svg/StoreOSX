import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, unique } from "drizzle-orm/mysql-core";

/**
 * ユーザーテーブル（OAuth認証）
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
  // 実績
  actualCost: int("actualCost"), // 実績金額合計（円）
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
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
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
});

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
});

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
});

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
});

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
    "その他",
  ]).default("その他").notNull(),
  note: text("note"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
});
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
