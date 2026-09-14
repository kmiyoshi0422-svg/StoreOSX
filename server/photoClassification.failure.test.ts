import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { photos } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";

const { classifyMock } = vi.hoisted(() => ({ classifyMock: vi.fn() }));
vi.mock("./photoClassification", () => ({
  classifyConstructionPhotos: classifyMock,
}));

import { appRouter } from "./routers";

function ownerContext(): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: 1,
      openId: "photo-classification-failure-owner",
      email: "photo-classification-failure@example.com",
      name: "写真分類失敗テスト",
      loginMethod: "manus",
      role: "owner",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("施工写真AI分類の候補取得安全性", () => {
  const caller = appRouter.createCaller(ownerContext());
  let caseId = 0;
  let photoId = 0;

  beforeAll(async () => {
    const created = await caller.cases.create({
      requestNumber: `TEST-PHOTO-CLASS-FAIL-${Date.now()}`,
      brand: "その他",
      storeName: "写真AI分類失敗テスト店",
      workType: "修理",
      costBearer: "店舗",
      requestDate: new Date(),
    });
    caseId = created.id;
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(photos).values({
      caseId,
      fileKey: `test/${caseId}/original.jpg`,
      fileUrl: `/manus-storage/test/${caseId}/original.jpg`,
      photoType: "現調",
    });
    const [photo] = await db.select().from(photos).where(eq(photos.caseId, caseId));
    photoId = photo.id;
  }, 30000);

  beforeEach(() => {
    classifyMock.mockReset();
  });

  afterAll(async () => {
    if (!caseId) return;
    const db = await getDb();
    if (db) await db.delete(photos).where(eq(photos.caseId, caseId));
    await caller.cases.delete({ id: caseId });
  }, 30000);

  it("AI候補を返しても、人が保存するまでは写真区分を変更しない", async () => {
    classifyMock.mockResolvedValue([
      { photoId, category: "施工後", confidence: 73, reason: "補修済みに見えるが全体像が不明" },
    ]);
    const result = await caller.photos.classify({ caseId, photoIds: [photoId] });
    expect(result).toEqual([
      {
        photoId,
        category: "施工後",
        confidence: 73,
        reason: "補修済みに見えるが全体像が不明",
        requiresReview: true,
      },
    ]);

    const db = await getDb();
    const [photo] = await db!.select().from(photos).where(eq(photos.id, photoId));
    expect(photo.photoType).toBe("現調");
  });

  it("AI利用上限時は区分を変更せず再試行案内を返す", async () => {
    classifyMock.mockRejectedValue(new Error("412 usage exhausted"));
    await expect(
      caller.photos.classify({ caseId, photoIds: [photoId] }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining("時間をおいて再試行"),
    });

    const db = await getDb();
    const [photo] = await db!.select().from(photos).where(eq(photos.id, photoId));
    expect(photo.photoType).toBe("現調");
  });
});
