import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  cases,
  checklistItems,
  estimates,
  InsertCase,
  InsertChecklistItem,
  InsertEstimate,
  InsertPartner,
  InsertPhoto,
  InsertUser,
  partners,
  photos,
  users,
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

export async function createPhoto(data: InsertPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(photos).values(data).$returningId();
  return result[0].id;
}

export async function updatePhoto(
  id: number,
  data: Partial<Pick<InsertPhoto, "photoType" | "workCategory" | "workItem" | "memo" | "orderNo">>
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
