import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  cases,
  caseSignatures,
  caseReportDrafts,
  InsertCaseReportDraft,
  caseSchedules,
  InsertCaseSchedule,
  scheduleTemplates,
  InsertScheduleTemplate,
  fullwidthExclusions,
  InsertFullwidthExclusion,
  checklistItems,
  estimates,
  expenses,
  appSettings,
  InsertCase,
  InsertCaseSignature,
  InsertChecklistItem,
  InsertEstimate,
  InsertExpense,
  InsertPartner,
  InsertPhoto,
  InsertRouteAssignment,
  InsertTeamSetting,
  InsertUser,
  teamMembers,
  partners,
  photos,
  routeAssignments,
  teamSettings,
  users,
  rainLeakInspections,
  rainLeakCheckItems,
  InsertRainLeakInspection,
  InsertRainLeakCheckItem,
  documents,
  InsertDocument,
  projectFolders,
  InsertProjectFolder,
  projectFolderCases,
  projectFolderDocuments,
  documentVersions,
  InsertDocumentVersion,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================
// User
// ============================================================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users);
}

// ============================================================
// Cases
// ============================================================
export async function listCases() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cases).orderBy(desc(cases.createdAt));
}

/**
 * 一覧表示用の軽量クエリ。
 * 全カラムではなく、一覧画面で必要な最小限のカラムのみ取得することで
 * レスポンスサイズを60〜70%削減し、転送・パース時間を短縮する。
 */
export async function listCasesSummary() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: cases.id,
      requestNumber: cases.requestNumber,
      brand: cases.brand,
      storeName: cases.storeName,
      storeCode: cases.storeCode,
      prefecture: cases.prefecture,
      address: cases.address,
      status: cases.status,
      progressStage: cases.progressStage,
      urgency: cases.urgency,
      assigneeId: cases.assigneeId,
      requestDate: cases.requestDate,
      constructionDate: cases.constructionDate,
      plenusQuoteAmount: cases.plenusQuoteAmount,
      estimatedCost: cases.estimatedCost,
      actualCost: cases.actualCost,
      categoryLarge: cases.categoryLarge,
      categoryMedium: cases.categoryMedium,
      requestContent: cases.requestContent,
      requesterName: cases.requesterName,
      createdAt: cases.createdAt,
      revisitCount: cases.revisitCount,
      surveyDate: cases.surveyDate,
      partnerId: cases.partnerId,
      amountApproved: cases.amountApproved,
    })
    .from(cases)
    .orderBy(desc(cases.createdAt));
}

/**
 * マップ表示専用の軽量クエリ。
 * 座標が設定されている案件のみ、マップ表示に必要な最小限のカラムを返却する。
 */
export async function listCasesForMap() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: cases.id,
      requestNumber: cases.requestNumber,
      storeName: cases.storeName,
      brand: cases.brand,
      address: cases.address,
      storePhone: cases.storePhone,
      latitude: cases.latitude,
      longitude: cases.longitude,
      urgency: cases.urgency,
      progressStage: cases.progressStage,
      status: cases.status,
      partnerId: cases.partnerId,
    })
    .from(cases)
    .where(and(isNotNull(cases.latitude), isNotNull(cases.longitude)))
    .orderBy(desc(cases.createdAt));
}

/**
 * インポート系ページ・セレクトボックス向けの最小限クエリ。
 * id, requestNumber, storeName のみ返却する。
 */
export async function listCasesMinimal() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: cases.id,
      requestNumber: cases.requestNumber,
      storeName: cases.storeName,
      brand: cases.brand,
      address: cases.address,
    })
    .from(cases)
    .orderBy(desc(cases.createdAt));
}

/**
 * 予実管理ページ向けの軽量クエリ。
 * 金額関連フィールドとステータスのみ返却する。
 */
export async function listCasesForBudget() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: cases.id,
      requestNumber: cases.requestNumber,
      storeName: cases.storeName,
      brand: cases.brand,
      status: cases.status,
      progressStage: cases.progressStage,
      urgency: cases.urgency,
      estimatedCost: cases.estimatedCost,
      plenusQuoteAmount: cases.plenusQuoteAmount,
      estimatedMaterialCost: cases.estimatedMaterialCost,
      estimatedLaborCost: cases.estimatedLaborCost,
      actualCost: cases.actualCost,
      actualMaterialCost: cases.actualMaterialCost,
      actualLaborCost: cases.actualLaborCost,
      managementFee: cases.managementFee,
      siteExpense: cases.siteExpense,
      ownSurveyCost: cases.ownSurveyCost,
      partnerSurveyCost: cases.partnerSurveyCost,
      transportCost: cases.transportCost,
      laborCost: cases.laborCost,
      is10mYen: cases.is10mYen,
      categoryLarge: cases.categoryLarge,
      requestDate: cases.requestDate,
      constructionDate: cases.constructionDate,
      completedAt: cases.completedAt,
      createdAt: cases.createdAt,
      invoiceNumber: cases.invoiceNumber,
    })
    .from(cases)
    .orderBy(desc(cases.createdAt));
}

export async function getCaseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCase(data: InsertCase) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cases).values(data).$returningId();
  return result[0].id;
}

export async function updateCase(id: number, data: Partial<InsertCase>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(cases).set(data).where(eq(cases.id, id));
}

export async function deleteCase(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cases).where(eq(cases.id, id));
  await db.delete(checklistItems).where(eq(checklistItems.caseId, id));
  await db.delete(photos).where(eq(photos.caseId, id));
}

// ============================================================
// Checklist
// ============================================================
export async function getChecklistByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.caseId, caseId))
    .orderBy(checklistItems.orderNo);
}

export async function createChecklistItems(items: InsertChecklistItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;
  await db.insert(checklistItems).values(items);
}

export async function getChecklistItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateChecklistItem(
  id: number,
  data: { checked?: boolean; checkedBy?: number | null; checkedAt?: Date | null; memo?: string | null }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(checklistItems).set(data).where(eq(checklistItems.id, id));
}

// ============================================================
// Photos
// ============================================================
export async function getPhotosByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(photos)
    .where(eq(photos.caseId, caseId))
    .orderBy(photos.orderNo, photos.createdAt);
}

// 複数案件の写真をまとめて取得（一括写真台帳PDF用）
export async function getPhotosByCaseIds(caseIds: number[]) {
  const db = await getDb();
  if (!db || caseIds.length === 0) return [];
  return db
    .select()
    .from(photos)
    .where(inArray(photos.caseId, caseIds))
    .orderBy(photos.orderNo, photos.createdAt);
}

// 複数案件の基本情報をまとめて取得（一括写真台帳PDF用）
export async function getCasesByIds(caseIds: number[]) {
  const db = await getDb();
  if (!db || caseIds.length === 0) return [];
  return db.select().from(cases).where(inArray(cases.id, caseIds));
}

export async function createPhoto(data: InsertPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(photos).values(data).$returningId();
  return result[0].id;
}

export async function updatePhoto(
  id: number,
  data: Partial<Pick<InsertPhoto, "photoType" | "workCategory" | "workItem" | "memo" | "rotation" | "orderNo" | "takenAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(photos).set(data).where(eq(photos.id, id));
}

export async function deletePhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(photos).where(eq(photos.id, id));
}

export async function getPhotoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================
// Partners (協力会社マスタ)
// ============================================================
export async function listPartners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(partners).orderBy(desc(partners.isActive), partners.category, partners.name);
}

export async function getPartnerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPartner(data: InsertPartner) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(partners).values(data).$returningId();
  return result[0].id;
}

export async function updatePartner(id: number, data: Partial<InsertPartner>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partners).set(data).where(eq(partners.id, id));
}

export async function deletePartner(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(partners).where(eq(partners.id, id));
}

// 指定協力会社に紐付く案件一覧（新しい順）
export async function listCasesByPartner(partnerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cases)
    .where(eq(cases.partnerId, partnerId))
    .orderBy(desc(cases.createdAt));
}

// 依頼番号で案件を検索（重複チェック用）
export async function getCaseByRequestNumber(requestNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cases).where(eq(cases.requestNumber, requestNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================
// Estimates（見積書）
// ============================================================
export async function listEstimatesByCase(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(estimates)
    .where(eq(estimates.caseId, caseId))
    .orderBy(desc(estimates.createdAt));
}

export async function createEstimate(data: InsertEstimate): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [r] = await db.insert(estimates).values(data).$returningId();
  return r.id;
}

export async function deleteEstimateById(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(estimates).where(eq(estimates.id, id));
}

export async function getEstimateById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCaseByPartnerToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(cases).where(eq(cases.partnerToken, token)).limit(1);
  return rows[0] ?? null;
}

export async function setCasePartnerToken(caseId: number, token: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(cases).set({ partnerToken: token }).where(eq(cases.id, caseId));
}


// ============================================================
// Route Assignments (v12)
// ============================================================
export async function listRouteAssignmentsByDateRange(start: string, end: string) {
  const db = await getDb();
  if (!db) return [];
  // YYYY-MM-DD 文字列の単純比較で範囲取得
  const all = await db.select().from(routeAssignments);
  return all.filter((r) => r.scheduledDate >= start && r.scheduledDate <= end);
}

export async function listRouteAssignmentsForCase(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(routeAssignments).where(eq(routeAssignments.caseId, caseId));
}

export async function createRouteAssignment(data: InsertRouteAssignment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(routeAssignments).values(data);
  const insertId = (result as unknown as { insertId: number }).insertId;
  return insertId;
}

export async function updateRouteAssignment(
  id: number,
  data: Partial<InsertRouteAssignment>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(routeAssignments).set(data).where(eq(routeAssignments.id, id));
}

export async function deleteRouteAssignment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(routeAssignments).where(eq(routeAssignments.id, id));
}

export async function clearRouteAssignmentsInRange(start: string, end: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const all = await db.select().from(routeAssignments);
  const ids = all
    .filter((r) => r.scheduledDate >= start && r.scheduledDate <= end)
    .map((r) => r.id);
  for (const id of ids) {
    await db.delete(routeAssignments).where(eq(routeAssignments.id, id));
  }
  return ids.length;
}


// ============================================================
// Team Settings (v13)
// ============================================================
export async function listTeamSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teamSettings);
}

export async function upsertTeamSetting(data: InsertTeamSetting) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const all = await db.select().from(teamSettings).where(eq(teamSettings.team, data.team));
  if (all.length > 0) {
    await db.update(teamSettings).set({
      primaryUserId: data.primaryUserId ?? null,
      label: data.label ?? null,
      color: data.color ?? null,
    }).where(eq(teamSettings.id, all[0].id));
    return all[0].id;
  }
  const result = await db.insert(teamSettings).values(data);
  return (result as unknown as { insertId: number }).insertId;
}

// チームメンバー（v33）
export async function listTeamMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teamMembers);
}

/** 指定チームのメンバーを userIds の内容で総入れ替え（差し替え） */
export async function setTeamMembers(team: "A" | "B", userIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(teamMembers).where(eq(teamMembers.team, team));
  const unique = Array.from(new Set(userIds.filter((n) => Number.isFinite(n))));
  if (unique.length > 0) {
    await db.insert(teamMembers).values(unique.map((userId) => ({ team, userId })));
  }
  return unique.length;
}


// ============================================================
// Expenses (v19)
// ============================================================
export async function listAllExpenses() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(expenses).orderBy(desc(expenses.expenseDate), desc(expenses.id));
}

export async function listExpensesByCase(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(expenses).where(eq(expenses.caseId, caseId)).orderBy(desc(expenses.expenseDate), desc(expenses.id));
}

export async function listUnmatchedExpenses() {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(expenses).orderBy(desc(expenses.id));
  return all.filter((e) => e.caseId == null);
}

export async function createExpense(input: InsertExpense) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(expenses).values(input);
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return Number(insertId);
}

export async function updateExpense(id: number, patch: Partial<InsertExpense>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(expenses).set(patch).where(eq(expenses.id, id));
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(expenses).where(eq(expenses.id, id));
}

export async function getExpenseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 案件の actualCost を「経費合計＋見積実績(materialAmount+laborAmount)」で同期 */
export async function syncCaseActualCost(caseId: number) {
  const db = await getDb();
  if (!db) return;
  // 案件スコープの経費のみを実績原価に反映（全体共通経費は含めない）
  const expRows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.caseId, caseId), eq(expenses.scope, "案件")));
  const expenseTotal = expRows.reduce((s, e) => s + (e.amount ?? 0), 0);
  // 経費合計を actualCost にセット（請求書ベースの実績）
  await db.update(cases).set({ actualCost: expenseTotal }).where(eq(cases.id, caseId));
}

/** 全体（案件に紐づかない共通）経費の一覧 */
export async function listGeneralExpenses() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(expenses)
    .where(eq(expenses.scope, "全体"))
    .orderBy(desc(expenses.expenseDate), desc(expenses.id));
}

/**
 * 期間内の経費を立替者(uploadedBy)別に集計する。
 * fromMs/toMs は expenseDate を基準（未設定の経費は createdAt で代替）。
 * 返却: 立替者ごとの合計・件数・区分別内訳・案件/全体別内訳。
 */
export async function listExpensesForAggregation(fromMs?: number, toMs?: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(expenses);
  return rows.filter((e) => {
    const basis = e.expenseDate ?? e.createdAt;
    const t = basis ? new Date(basis).getTime() : null;
    if (t == null) return fromMs == null && toMs == null;
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  });
}


// ============================================================
// Case Signatures (v37: 現場調査報告書／施工完了報告書の署名)
// ============================================================
type ReportType = "survey" | "completion";

/** 案件の署名一覧（survey/completion両方）を取得 */
export async function listSignaturesByCase(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(caseSignatures).where(eq(caseSignatures.caseId, caseId));
}

/** 案件×報告書種別で署名を1件取得 */
export async function getSignature(caseId: number, reportType: ReportType) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(caseSignatures)
    .where(and(eq(caseSignatures.caseId, caseId), eq(caseSignatures.reportType, reportType)))
    .limit(1);
  return rows[0] ?? null;
}

/** 案件×報告書種別の署名を upsert（同一なら更新、無ければ挿入） */
export async function upsertSignature(data: InsertCaseSignature) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db
    .select()
    .from(caseSignatures)
    .where(and(eq(caseSignatures.caseId, data.caseId), eq(caseSignatures.reportType, data.reportType)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(caseSignatures)
      .set({
        signerName: data.signerName ?? null,
        fileKey: data.fileKey,
        fileUrl: data.fileUrl,
        signedAt: data.signedAt ?? new Date(),
        createdBy: data.createdBy ?? null,
      })
      .where(eq(caseSignatures.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(caseSignatures).values(data);
  return (result as unknown as { insertId: number }).insertId;
}

/** 署名を削除（案件×報告書種別） */
export async function deleteSignature(caseId: number, reportType: ReportType) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .delete(caseSignatures)
    .where(and(eq(caseSignatures.caseId, caseId), eq(caseSignatures.reportType, reportType)));
}


// ============================================================
// Case Report Drafts (v40: 施工完了報告書のセクション本文をAI生成＋手編集保存)
// ============================================================

/** 案件の完了報告書ドラフトを1件取得 */
export async function getReportDraft(caseId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(caseReportDrafts)
    .where(eq(caseReportDrafts.caseId, caseId))
    .limit(1);
  return rows[0] ?? null;
}

/** 案件の完了報告書ドラフトを upsert（content/JSON文字列を保存） */
export async function upsertReportDraft(data: InsertCaseReportDraft) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db
    .select()
    .from(caseReportDrafts)
    .where(eq(caseReportDrafts.caseId, data.caseId))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(caseReportDrafts)
      .set({
        content: data.content,
        generatedAt: data.generatedAt ?? existing[0].generatedAt,
        updatedBy: data.updatedBy ?? null,
      })
      .where(eq(caseReportDrafts.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(caseReportDrafts).values(data);
  return (result as unknown as { insertId: number }).insertId;
}

/* ------------------------------------------------------------------ */
/* 全角化の除外辞書（fullwidth_exclusions）                            */
/* ------------------------------------------------------------------ */

/** 除外辞書を全件取得（新しい順） */
export async function listFullwidthExclusions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(fullwidthExclusions)
    .orderBy(desc(fullwidthExclusions.createdAt));
}

/** 除外語の term だけを配列で取得（PDF出力で利用） */
export async function getFullwidthExclusionTerms(): Promise<string[]> {
  const rows = await listFullwidthExclusions();
  return rows.map((r) => r.term);
}

/** 除外語を追加（term は一意。重複時は既存を返す） */
export async function addFullwidthExclusion(data: InsertFullwidthExclusion) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const term = data.term.trim();
  if (!term) throw new Error("term is required");
  const existing = await db
    .select()
    .from(fullwidthExclusions)
    .where(eq(fullwidthExclusions.term, term))
    .limit(1);
  if (existing.length > 0) {
    // メモの更新のみ反映
    if (data.note !== undefined && data.note !== existing[0].note) {
      await db
        .update(fullwidthExclusions)
        .set({ note: data.note ?? null })
        .where(eq(fullwidthExclusions.id, existing[0].id));
    }
    return existing[0].id;
  }
  const result = await db
    .insert(fullwidthExclusions)
    .values({ ...data, term });
  return (result as unknown as { insertId: number }).insertId;
}

/** 除外語を削除 */
export async function deleteFullwidthExclusion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(fullwidthExclusions).where(eq(fullwidthExclusions.id, id));
}


// ===== アプリ設定（キーバリューストア） =====
/** 設定値を取得（JSONパース済み） */
export async function getAppSetting<T = unknown>(key: string): Promise<T | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
  if (rows.length === 0) return null;
  try { return JSON.parse(rows[0].settingValue) as T; } catch { return null; }
}

/** 設定値を保存（JSON文字列化して保存） */
export async function setAppSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const json = JSON.stringify(value);
  const existing = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
  if (existing.length > 0) {
    await db.update(appSettings).set({ settingValue: json }).where(eq(appSettings.settingKey, key));
  } else {
    await db.insert(appSettings).values({ settingKey: key, settingValue: json });
  }
}

/** 全設定を取得 */
export async function getAllAppSettings(): Promise<Record<string, unknown>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(appSettings);
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    try { result[row.settingKey] = JSON.parse(row.settingValue); } catch { result[row.settingKey] = row.settingValue; }
  }
  return result;
}


// ─── Case Schedules (工程管理) ─────────────────────────────────────────────
export async function listSchedulesByCase(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(caseSchedules).where(eq(caseSchedules.caseId, caseId)).orderBy(caseSchedules.orderNo);
}

export async function createSchedule(data: InsertCaseSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(caseSchedules).values(data);
  return { id: result.insertId };
}

export async function updateSchedule(id: number, data: Partial<Omit<InsertCaseSchedule, "id" | "caseId" | "createdAt" | "createdBy">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(caseSchedules).set(data).where(eq(caseSchedules.id, id));
}

export async function deleteSchedule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(caseSchedules).where(eq(caseSchedules.id, id));
}


// ============================================================
// Schedule Templates
// ============================================================

export async function listScheduleTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduleTemplates).orderBy(desc(scheduleTemplates.updatedAt));
}

export async function createScheduleTemplate(data: InsertScheduleTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(scheduleTemplates).values(data);
  return result.insertId;
}

export async function deleteScheduleTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(scheduleTemplates).where(eq(scheduleTemplates.id, id));
}

export async function updateScheduleTemplate(id: number, data: Partial<Omit<InsertScheduleTemplate, "id" | "createdAt" | "createdBy">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(scheduleTemplates).set(data).where(eq(scheduleTemplates.id, id));
}


// ============================================================
// Rain Leak Inspection（雨漏り調査）
// ============================================================

export async function getRainLeakInspectionByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(rainLeakInspections).where(eq(rainLeakInspections.caseId, caseId));
  return rows[0] ?? null;
}

export async function createRainLeakInspection(data: InsertRainLeakInspection) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(rainLeakInspections).values(data);
  return { id: result.insertId };
}

export async function updateRainLeakInspection(id: number, data: Partial<InsertRainLeakInspection>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(rainLeakInspections).set(data).where(eq(rainLeakInspections.id, id));
}

export async function getRainLeakCheckItems(inspectionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rainLeakCheckItems).where(eq(rainLeakCheckItems.inspectionId, inspectionId)).orderBy(rainLeakCheckItems.orderNo);
}

export async function upsertRainLeakCheckItems(inspectionId: number, items: InsertRainLeakCheckItem[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete existing items and re-insert
  await db.delete(rainLeakCheckItems).where(eq(rainLeakCheckItems.inspectionId, inspectionId));
  if (items.length > 0) {
    await db.insert(rainLeakCheckItems).values(items);
  }
}

export async function updateRainLeakCheckItem(id: number, data: { status?: "未確認" | "有" | "無" | "不明"; urgency?: "none" | "urgent" | "caution" | "observe"; memo?: string; photoNo?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(rainLeakCheckItems).set(data).where(eq(rainLeakCheckItems.id, id));
}


// ============================================================
// Documents (図面・仕様書・資料)
// ============================================================
export async function createDocument(doc: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(documents).values(doc);
  return result.insertId;
}

export async function listDocumentsByCase(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(eq(documents.caseId, caseId)).orderBy(desc(documents.createdAt));
}

/** Partner-facing: only return unlocked documents */
export async function listDocumentsByCaseForPartner(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(and(eq(documents.caseId, caseId), eq(documents.isLocked, 0))).orderBy(desc(documents.createdAt));
}

export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(documents).where(eq(documents.id, id));
}

export async function updateDocumentMemo(id: number, memo: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(documents).set({ memo }).where(eq(documents.id, id));
}

export async function toggleDocumentLock(id: number, isLocked: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(documents).set({ isLocked }).where(eq(documents.id, id));
}

export async function listAllDocuments(opts: { category?: string; search?: string; limit?: number; offset?: number; scope?: "case" | "shared" | "all" }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (opts.category) {
    conditions.push(eq(documents.category, opts.category as any));
  }
  if (opts.search) {
    conditions.push(like(documents.fileName, `%${opts.search}%`));
  }
  // Scope filter: case-linked vs shared (common) documents
  if (opts.scope === "case") {
    conditions.push(isNotNull(documents.caseId));
  } else if (opts.scope === "shared") {
    conditions.push(isNull(documents.caseId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  const items = await db
    .select({
      id: documents.id,
      caseId: documents.caseId,
      fileName: documents.fileName,
      fileKey: documents.fileKey,
      fileUrl: documents.fileUrl,
      mimeType: documents.mimeType,
      fileSize: documents.fileSize,
      category: documents.category,
      tags: documents.tags,
      memo: documents.memo,
      isLocked: documents.isLocked,
      createdAt: documents.createdAt,
      storeName: cases.storeName,
      requestNumber: cases.requestNumber,
    })
    .from(documents)
    .leftJoin(cases, eq(documents.caseId, cases.id))
    .where(where)
    .orderBy(desc(documents.createdAt))
    .limit(limit)
    .offset(offset);

  // Count total
  const countResult = await db
    .select({ id: documents.id })
    .from(documents)
    .where(where);
  const total = countResult.length;

  return { items, total };
}

// List shared (common) documents by tag
export async function listSharedDocumentsByTag(tag: string) {
  const db = await getDb();
  if (!db) return [];
  const items = await db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      fileKey: documents.fileKey,
      fileUrl: documents.fileUrl,
      mimeType: documents.mimeType,
      fileSize: documents.fileSize,
      category: documents.category,
      tags: documents.tags,
      memo: documents.memo,
      isLocked: documents.isLocked,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(and(isNull(documents.caseId), like(documents.tags, `%${tag}%`)))
    .orderBy(desc(documents.createdAt));
  return items;
}

// Update tags for a document
export async function updateDocumentTags(id: number, tags: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(documents).set({ tags }).where(eq(documents.id, id));
}

// ============================================================
// Cross-Project Schedule (横断工程表)
// ============================================================
export async function listAllSchedulesWithCase() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      scheduleId: caseSchedules.id,
      caseId: caseSchedules.caseId,
      title: caseSchedules.title,
      startDate: caseSchedules.startDate,
      endDate: caseSchedules.endDate,
      status: caseSchedules.status,
      color: caseSchedules.color,
      progress: caseSchedules.progress,
      orderNo: caseSchedules.orderNo,
      memo: caseSchedules.memo,
      // Case info
      storeName: cases.storeName,
      requestNumber: cases.requestNumber,
      brand: cases.brand,
      prefecture: cases.prefecture,
      caseStatus: cases.status,
      assigneeId: cases.assigneeId,
    })
    .from(caseSchedules)
    .innerJoin(cases, eq(caseSchedules.caseId, cases.id))
    .orderBy(caseSchedules.startDate);
}

/**
 * 全案件の工程スケジュールを、案件情報（店舗名・業者ID）付きで取得する。
 * フロントエンドで業者ごとにグループ化してガントチャートを描画する。
 */
export async function listCrossPartnerSchedules(rangeStart?: string, rangeEnd?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(caseSchedules.caseId, cases.id)];
  // 日付フィルタ: endDate >= rangeStart AND startDate <= rangeEnd
  if (rangeStart) conditions.push(gte(caseSchedules.endDate, rangeStart));
  if (rangeEnd) conditions.push(lte(caseSchedules.startDate, rangeEnd));
  return db
    .select({
      id: caseSchedules.id,
      caseId: caseSchedules.caseId,
      title: caseSchedules.title,
      startDate: caseSchedules.startDate,
      endDate: caseSchedules.endDate,
      status: caseSchedules.status,
      color: caseSchedules.color,
      progress: caseSchedules.progress,
      memo: caseSchedules.memo,
      // 案件情報
      storeName: cases.storeName,
      requestNumber: cases.requestNumber,
      brand: cases.brand,
      partnerId: cases.partnerId,
      contractorName: cases.contractorName,
      urgency: cases.urgency,
      progressStage: cases.progressStage,
      address: cases.address,
      assigneeId: cases.assigneeId,
    })
    .from(caseSchedules)
    .innerJoin(cases, and(...conditions))
    .orderBy(caseSchedules.startDate, cases.storeName);
}

/**
 * route_assignments も横断工程表に含める（現調・工事の予定）
 * 案件情報付きで取得
 */
export async function listCrossPartnerRoutes(rangeStart?: string, rangeEnd?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(routeAssignments.caseId, cases.id)];
  // 日付フィルタ: scheduledDate >= rangeStart AND scheduledDate <= rangeEnd
  if (rangeStart) conditions.push(gte(routeAssignments.scheduledDate, rangeStart));
  if (rangeEnd) conditions.push(lte(routeAssignments.scheduledDate, rangeEnd));
  return db
    .select({
      id: routeAssignments.id,
      caseId: routeAssignments.caseId,
      team: routeAssignments.team,
      taskType: routeAssignments.taskType,
      scheduledDate: routeAssignments.scheduledDate,
      assigneeId: routeAssignments.assigneeId,
      notes: routeAssignments.notes,
      // 案件情報
      storeName: cases.storeName,
      requestNumber: cases.requestNumber,
      brand: cases.brand,
      partnerId: cases.partnerId,
      contractorName: cases.contractorName,
      urgency: cases.urgency,
    })
    .from(routeAssignments)
    .innerJoin(cases, and(...conditions))
    .orderBy(routeAssignments.scheduledDate, cases.storeName);
}

// ============================================================
// Project Folders (プロジェクトフォルダ)
// ============================================================
export async function listProjectFolders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectFolders).orderBy(desc(projectFolders.createdAt));
}

export async function getProjectFolder(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(projectFolders).where(eq(projectFolders.id, id));
  return rows[0] || null;
}

export async function createProjectFolder(data: InsertProjectFolder) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(projectFolders).values(data);
  return { id: result[0].insertId };
}

export async function updateProjectFolder(id: number, data: { name?: string; description?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(projectFolders).set({ ...data, updatedAt: new Date() }).where(eq(projectFolders.id, id));
}

export async function deleteProjectFolder(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectFolderCases).where(eq(projectFolderCases.folderId, id));
  await db.delete(projectFolderDocuments).where(eq(projectFolderDocuments.folderId, id));
  await db.delete(projectFolders).where(eq(projectFolders.id, id));
}

export async function listFolderCases(folderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: cases.id, storeName: cases.storeName, requestNumber: cases.requestNumber, brand: cases.brand, status: cases.status })
    .from(projectFolderCases)
    .innerJoin(cases, eq(projectFolderCases.caseId, cases.id))
    .where(eq(projectFolderCases.folderId, folderId));
}

export async function listFolderDocuments(folderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      fileUrl: documents.fileUrl,
      fileSize: documents.fileSize,
      category: documents.category,
      tags: documents.tags,
      memo: documents.memo,
      createdAt: documents.createdAt,
    })
    .from(projectFolderDocuments)
    .innerJoin(documents, eq(projectFolderDocuments.documentId, documents.id))
    .where(eq(projectFolderDocuments.folderId, folderId));
}

export async function addCaseToFolder(folderId: number, caseId: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projectFolderCases).values({ folderId, caseId }).onDuplicateKeyUpdate({ set: { folderId } });
}

export async function removeCaseFromFolder(folderId: number, caseId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectFolderCases).where(and(eq(projectFolderCases.folderId, folderId), eq(projectFolderCases.caseId, caseId)));
}

export async function addDocumentToFolder(folderId: number, documentId: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projectFolderDocuments).values({ folderId, documentId }).onDuplicateKeyUpdate({ set: { folderId } });
}

export async function removeDocumentFromFolder(folderId: number, documentId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectFolderDocuments).where(and(eq(projectFolderDocuments.folderId, folderId), eq(projectFolderDocuments.documentId, documentId)));
}

export async function listFoldersByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: projectFolders.id, name: projectFolders.name, description: projectFolders.description })
    .from(projectFolderCases)
    .innerJoin(projectFolders, eq(projectFolderCases.folderId, projectFolders.id))
    .where(eq(projectFolderCases.caseId, caseId));
}

export async function listDocumentsByFolderIds(folderIds: number[]) {
  const db = await getDb();
  if (!db || folderIds.length === 0) return [];
  return db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      fileUrl: documents.fileUrl,
      fileSize: documents.fileSize,
      category: documents.category,
      tags: documents.tags,
      memo: documents.memo,
      createdAt: documents.createdAt,
      folderId: projectFolderDocuments.folderId,
    })
    .from(projectFolderDocuments)
    .innerJoin(documents, eq(projectFolderDocuments.documentId, documents.id))
    .where(inArray(projectFolderDocuments.folderId, folderIds));
}

// ============================================================
// Document Versions (バージョン管理)
// ============================================================
export async function createDocumentVersion(data: InsertDocumentVersion) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(documentVersions).values(data);
  return { id: result[0].insertId };
}

export async function listDocumentVersions(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentVersions).where(eq(documentVersions.documentId, documentId)).orderBy(desc(documentVersions.version));
}

export async function getLatestVersionNumber(documentId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ version: documentVersions.version }).from(documentVersions).where(eq(documentVersions.documentId, documentId)).orderBy(desc(documentVersions.version)).limit(1);
  return rows[0]?.version || 0;
}

// ============================================================
// Full-text Search (全文検索)
// ============================================================
export async function searchDocuments(query: string, opts?: { scope?: "case" | "shared" | "all"; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const searchPattern = `%${query}%`;
  const conditions = [
    or(
      like(documents.fileName, searchPattern),
      like(documents.memo, searchPattern),
      like(documents.tags, searchPattern),
      like(documents.category, searchPattern),
    ),
  ];
  if (opts?.scope === "case") conditions.push(isNotNull(documents.caseId));
  if (opts?.scope === "shared") conditions.push(isNull(documents.caseId));
  
  return db
    .select({
      id: documents.id,
      caseId: documents.caseId,
      fileName: documents.fileName,
      fileUrl: documents.fileUrl,
      fileSize: documents.fileSize,
      category: documents.category,
      tags: documents.tags,
      memo: documents.memo,
      isLocked: documents.isLocked,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt))
    .limit(opts?.limit || 50);
}
