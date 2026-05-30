import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

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
  address: text("address"), // 住所
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
  // 取引先
  contractorName: varchar("contractorName", { length: 255 }),
  contractorPic: varchar("contractorPic", { length: 128 }),
  contractorPhone: varchar("contractorPhone", { length: 32 }),
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
  estimatedCost: int("estimatedCost"), // 見積金額合計（円）
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
  // 順序
  orderNo: int("orderNo").default(0).notNull(),
  // メタ
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;
