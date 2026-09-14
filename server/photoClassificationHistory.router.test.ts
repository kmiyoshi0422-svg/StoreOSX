import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { photos } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
type Role = AuthenticatedUser["role"];

function createContext(role: Role, options: Partial<AuthenticatedUser> = {}): TrpcContext {
  const now = new Date();
  const id = options.id ?? 992001;
  return {
    user: {
      id,
      openId: `photo-history-${role}-${id}`,
      email: `${role}-${id}@photo-history.example.com`,
      name: `写真履歴 ${role}`,
      loginMethod: "manus",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      ...options,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const ownerCaller = appRouter.createCaller(createContext("owner", { id: 1, name: "履歴テスト管理者" }));
const createdCaseIds: number[] = [];

async function createFixture(photoTypes: Array<"現調" | "施工前A" | "施工中" | "施工後A">) {
  const created = await ownerCaller.cases.create({
    requestNumber: `TEST-PHOTO-HISTORY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    brand: "その他",
    storeName: "写真分類履歴テスト店",
    prefecture: "福岡県",
    workType: "修理",
    costBearer: "店舗",
    requestDate: new Date(),
  });
  createdCaseIds.push(created.id);
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(photos).values(photoTypes.map((photoType, index) => ({
    caseId: created.id,
    fileKey: `test/${created.id}/history-${index}.jpg`,
    fileUrl: `/manus-storage/test/${created.id}/history-${index}.jpg`,
    photoType,
    memo: `履歴テスト写真${index + 1}`,
    orderNo: index,
  })));
  const rows = await db.select().from(photos).where(eq(photos.caseId, created.id));
  return { caseId: created.id, photoIds: rows.sort((a, b) => a.orderNo - b.orderNo).map((row) => row.id) };
}

afterEach(async () => {
  while (createdCaseIds.length > 0) {
    const caseId = createdCaseIds.pop()!;
    await ownerCaller.cases.delete({ id: caseId });
  }
}, 30000);

describe("AI写真分類の履歴とUndo", () => {
  it("実行者・変更前後・AI提案・確信度・理由を保存し、Undo後は二重実行を拒否する", async () => {
    const { caseId, photoIds } = await createFixture(["現調"]);
    const applied = await ownerCaller.photos.applyClassifications({
      caseId,
      updates: [{
        photoId: photoIds[0],
        category: "施工前",
        suggestedCategory: "施工中",
        confidence: 67,
        reason: "工具と養生が確認できるため施工中と判定しました。",
      }],
    });

    expect(applied).toMatchObject({ success: true, count: 1, runId: expect.any(Number) });
    const history = await ownerCaller.photos.classificationHistory({ caseId });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      performedByName: "履歴テスト管理者",
      changeCount: 1,
      canUndo: true,
      conflictCount: 0,
    });
    expect(history[0].changes[0]).toMatchObject({
      photoId: photoIds[0],
      beforePhotoType: "現調",
      afterPhotoType: "施工前A",
      suggestedCategory: "施工中",
      confirmedCategory: "施工前",
      confidence: 67,
      reason: "工具と養生が確認できるため施工中と判定しました。",
      currentPhotoType: "施工前A",
      isCurrentMatch: true,
    });

    await expect(ownerCaller.photos.undoClassification({
      caseId,
      runId: applied.runId!,
    })).resolves.toEqual({ success: true, count: 1 });

    const db = await getDb();
    const [restored] = await db!.select().from(photos).where(eq(photos.id, photoIds[0]));
    expect(restored.photoType).toBe("現調");
    const afterUndo = await ownerCaller.photos.classificationHistory({ caseId });
    expect(afterUndo[0].undoneAt).toBeInstanceOf(Date);
    expect(afterUndo[0].undoneByName).toBe("履歴テスト管理者");
    expect(afterUndo[0].canUndo).toBe(false);

    await expect(ownerCaller.photos.undoClassification({
      caseId,
      runId: applied.runId!,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  }, 30000);

  it("1枚でも後から変更されていればUndoを全件中止し、他の写真も変更しない", async () => {
    const { caseId, photoIds } = await createFixture(["現調", "現調"]);
    const applied = await ownerCaller.photos.applyClassifications({
      caseId,
      updates: photoIds.map((photoId) => ({
        photoId,
        category: "施工前" as const,
        suggestedCategory: "施工前" as const,
        confidence: 94,
        reason: "未施工状態のため施工前と判定しました。",
      })),
    });

    const db = await getDb();
    await db!.update(photos).set({ photoType: "施工中" }).where(eq(photos.id, photoIds[0]));
    const beforeUndo = await ownerCaller.photos.classificationHistory({ caseId });
    expect(beforeUndo[0]).toMatchObject({ canUndo: false, conflictCount: 1 });

    await expect(ownerCaller.photos.undoClassification({
      caseId,
      runId: applied.runId!,
    })).rejects.toMatchObject({ code: "CONFLICT" });

    const rows = await db!.select().from(photos).where(eq(photos.caseId, caseId));
    const types = new Map(rows.map((row) => [row.id, row.photoType] as const));
    expect(types.get(photoIds[0])).toBe("施工中");
    expect(types.get(photoIds[1])).toBe("施工前A");
  }, 30000);

  it("同じ写真に後続の未復元AI分類がある場合は、現在値が一致していても古い履歴をUndoしない", async () => {
    const { caseId, photoIds } = await createFixture(["現調"]);
    const first = await ownerCaller.photos.applyClassifications({
      caseId,
      updates: [{
        photoId: photoIds[0],
        category: "施工前",
        suggestedCategory: "施工前",
        confidence: 93,
        reason: "施工前の状態です。",
      }],
    });
    const second = await ownerCaller.photos.applyClassifications({
      caseId,
      updates: [{
        photoId: photoIds[0],
        category: "施工中",
        suggestedCategory: "施工中",
        confidence: 91,
        reason: "作業途中の状態です。",
      }],
    });
    const db = await getDb();
    await db!.update(photos).set({ photoType: "施工前A" }).where(eq(photos.id, photoIds[0]));

    const history = await ownerCaller.photos.classificationHistory({ caseId });
    const firstRun = history.find((run) => run.id === first.runId)!;
    expect(firstRun.canUndo).toBe(false);
    expect(firstRun.conflictCount).toBe(1);
    expect(firstRun.changes[0].hasLaterActiveChange).toBe(true);

    await expect(ownerCaller.photos.undoClassification({ caseId, runId: first.runId! }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    const [photo] = await db!.select().from(photos).where(eq(photos.id, photoIds[0]));
    expect(photo.photoType).toBe("施工前A");
  }, 30000);

  it("許可エリアpartnerは履歴を閲覧・Undoでき、役員と顧客は拒否される", async () => {
    const { caseId, photoIds } = await createFixture(["現調"]);
    const applied = await ownerCaller.photos.applyClassifications({
      caseId,
      updates: [{ photoId: photoIds[0], category: "施工後", confidence: 91, reason: "完了状態です。" }],
    });
    const partnerCaller = appRouter.createCaller(createContext("partner", {
      id: 992002,
      areaAccessMode: "selected",
      allowedPrefectures: JSON.stringify(["福岡県"]),
    }));
    await expect(partnerCaller.photos.classificationHistory({ caseId })).resolves.toHaveLength(1);
    await expect(partnerCaller.photos.undoClassification({ caseId, runId: applied.runId! }))
      .resolves.toEqual({ success: true, count: 1 });

    for (const role of ["executive", "customer"] as const) {
      const caller = appRouter.createCaller(createContext(role, { id: role === "executive" ? 992003 : 992004 }));
      await expect(caller.photos.classificationHistory({ caseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.photos.undoClassification({ caseId, runId: applied.runId! }))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  }, 30000);
});
