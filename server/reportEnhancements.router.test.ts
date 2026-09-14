import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { caseReportDrafts, caseSignatures, photos } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { getDb, getSignature, upsertSignature } from "./db";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function ownerContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "report-enhancement-test-owner",
    email: "report-enhancement@example.com",
    name: "Report Enhancement Test",
    loginMethod: "manus",
    role: "owner",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("report enhancements router integration", () => {
  const caller = appRouter.createCaller(ownerContext());
  let caseId = 0;
  let beforeIds: number[] = [];
  let afterIds: number[] = [];

  beforeAll(async () => {
    const created = await caller.cases.create({
      requestNumber: `TEST-REPORT-ENH-${Date.now()}`,
      brand: "その他",
      storeName: "報告書拡張テスト店",
      workType: "修理",
      costBearer: "店舗",
      requestDate: new Date(),
    });
    caseId = created.id;
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(photos).values([
      { caseId, fileKey: `test/${caseId}/before-1.jpg`, fileUrl: `/manus-storage/test/${caseId}/before-1.jpg`, photoType: "施工前A", workItem: "客席天井", orderNo: 0 },
      { caseId, fileKey: `test/${caseId}/before-2.jpg`, fileUrl: `/manus-storage/test/${caseId}/before-2.jpg`, photoType: "施工前B", workItem: "厨房壁", orderNo: 1 },
      { caseId, fileKey: `test/${caseId}/after-1.jpg`, fileUrl: `/manus-storage/test/${caseId}/after-1.jpg`, photoType: "施工後A", workItem: "客席天井", orderNo: 2 },
      { caseId, fileKey: `test/${caseId}/after-2.jpg`, fileUrl: `/manus-storage/test/${caseId}/after-2.jpg`, photoType: "施工後B", workItem: "厨房壁", orderNo: 3 },
    ]);
    const rows = await db.select().from(photos).where(eq(photos.caseId, caseId));
    beforeIds = rows.filter((photo) => ["施工前A", "施工前B"].includes(photo.photoType)).map((photo) => photo.id);
    afterIds = rows.filter((photo) => ["施工後A", "施工後B"].includes(photo.photoType)).map((photo) => photo.id);
  }, 30000);

  afterAll(async () => {
    if (!caseId) return;
    const db = await getDb();
    if (db) {
      await db.delete(caseSignatures).where(eq(caseSignatures.caseId, caseId));
      await db.delete(caseReportDrafts).where(eq(caseReportDrafts.caseId, caseId));
      await db.delete(photos).where(eq(photos.caseId, caseId));
    }
    await caller.cases.delete({ id: caseId });
  }, 30000);

  it("手動Before／After組み合わせを保存し、他のドラフト本文を維持する", async () => {
    await caller.reportDraft.save({
      caseId,
      content: { overview: "既存本文", manualPhotoPairs: [] },
    });
    const saved = await caller.reportDraft.savePhotoPairs({
      caseId,
      pairs: [{ beforePhotoId: beforeIds[0], afterPhotoId: afterIds[1] }],
    });
    expect(saved.manualPhotoPairs).toEqual([
      { beforePhotoId: beforeIds[0], afterPhotoId: afterIds[1] },
    ]);
    const draft = await caller.reportDraft.get({ caseId });
    expect(draft.content.overview).toBe("既存本文");
    expect(draft.content.manualPhotoPairs).toEqual(saved.manualPhotoPairs);
  });

  it("異区分IDと重複指定を保存時に除外する", async () => {
    const saved = await caller.reportDraft.savePhotoPairs({
      caseId,
      pairs: [
        { beforePhotoId: afterIds[0], afterPhotoId: beforeIds[0] },
        { beforePhotoId: beforeIds[1], afterPhotoId: afterIds[0] },
        { beforePhotoId: beforeIds[1], afterPhotoId: afterIds[1] },
      ],
    });
    expect(saved.manualPhotoPairs).toEqual([
      { beforePhotoId: beforeIds[1], afterPhotoId: afterIds[0] },
      { beforePhotoId: null, afterPhotoId: afterIds[1] },
    ]);
  });

  it("担当者と先方の署名を同じ報告書へ別々に保存できる", async () => {
    await upsertSignature({
      caseId,
      reportType: "completion",
      signerRole: "staff",
      signerName: "担当者",
      fileKey: `test/${caseId}/staff.png`,
      fileUrl: `/manus-storage/test/${caseId}/staff.png`,
      signedAt: new Date(),
      createdBy: 1,
    });
    await upsertSignature({
      caseId,
      reportType: "completion",
      signerRole: "customer",
      signerName: "先方確認者",
      fileKey: `test/${caseId}/customer.png`,
      fileUrl: `/manus-storage/test/${caseId}/customer.png`,
      signedAt: new Date(),
      createdBy: 1,
    });
    expect((await getSignature(caseId, "completion", "staff"))?.signerName).toBe("担当者");
    expect((await getSignature(caseId, "completion", "customer"))?.signerName).toBe("先方確認者");
  });
});
