import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { unitPriceMaster, unitPriceMasterHistory } from "../drizzle/schema";
import { priceExtractedItem } from "./estimateAssistant";
import { storageGetSignedUrl } from "./storage";
import type { TrpcContext } from "./_core/context";

vi.mock("./storage", async importOriginal => ({
  ...(await importOriginal<typeof import("./storage")>()),
  storageGetSignedUrl: vi.fn(async () => "https://example.invalid/test.pdf"),
}));
const person = (
  role: NonNullable<TrpcContext["user"]>["role"],
  id = 1,
  allowedPrefectures?: string
) => {
  const now = new Date();
  return appRouter.createCaller({
    user: {
      id,
      role,
      openId: `estimate-workflow-${id}`,
      name: `${role}-${id}`,
      email: `${role}@example.com`,
      loginMethod: "manus",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      ...(allowedPrefectures
        ? { areaAccessMode: "selected" as const, allowedPrefectures }
        : {}),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
};
const owner = person("owner");
const user = person("user", 2);
const executive = person("executive", 3);
const valid = {
  majorCategory: "TEST-電気",
  category: "TEST-電気",
  name: "TEST-照合用特殊工事",
  specification: "安全確認込み",
  unit: "箇所",
  low: 7000,
  standard: 8000,
  high: 9000,
  note: "合成テストのみ",
  sourceRef: "TEST-合成単価",
};
const item = {
  name: "照合確認",
  specification: "",
  quantity: 2,
  unit: "式",
  unitPrice: 5000,
  source: "TEST-手動価格",
  note: "安全確認",
  evidence: "戸の開閉が固い",
  pageNumber: 2,
};

describe("見積支援 拡張API統合", () => {
  let caseId = 0;
  const createdPriceIds: string[] = [];
  beforeAll(async () => {
    caseId = (
      await owner.cases.create({
        requestNumber: `TEST-EST-WORKFLOW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        storeName: "見積ワークフローテスト店",
        prefecture: "山口県",
      })
    ).id;
  }, 30000);
  afterAll(async () => {
    const db = await getDb();
    if (db)
      for (const id of createdPriceIds) {
        await db
          .delete(unitPriceMasterHistory)
          .where(eq(unitPriceMasterHistory.priceId, id));
        await db.delete(unitPriceMaster).where(eq(unitPriceMaster.id, id));
      }
    if (caseId) await owner.cases.delete({ id: caseId });
  }, 30000);

  it("社員・役員も見積案を作成可能、協力業者と顧客は一覧・マスタ・承認を拒否", async () => {
    const saved = await user.estimateAssistant.saveDraft({
      caseId,
      title: "社員の案",
      sourceKind: "manual",
      items: [item],
    });
    expect(saved.total).toBe(11000);
    expect(
      (await executive.estimateAssistant.listDrafts({ caseId })).some(
        d => d.id === saved.id
      )
    ).toBe(true);
    for (const role of ["partner", "customer"] as const) {
      await expect(
        person(role).estimateAssistant.listDrafts({ caseId })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        person(role).estimateAssistant.masterList()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        person(role).estimateAssistant.approveDraft({
          id: saved.id,
          expectedUpdatedAt: saved.updatedAt,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(
      person(
        "executive",
        3,
        JSON.stringify(["東京都"])
      ).estimateAssistant.listDrafts({ caseId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("原本PDFは所有者の一時キーかアクセス可能な保存済み案件に限り閲覧できる", async () => {
    const sourcePdfKey = "imports/estimate-assistant/1/TEST-workflow.pdf";
    const saved = await owner.estimateAssistant.saveDraft({
      caseId,
      title: "原本照合",
      sourceKind: "request_pdf",
      sourcePdfKey,
      sourcePdfName: "TEST依頼書.pdf",
      items: [item],
    });
    const ownerResult = await owner.estimateAssistant.pdfPreviewUrl({
      fileKey: sourcePdfKey,
    });
    expect(ownerResult.url).toContain("test.pdf");
    expect(
      (await user.estimateAssistant.pdfPreviewUrl({ draftId: saved.id })).url
    ).toContain("test.pdf");
    await expect(
      user.estimateAssistant.pdfPreviewUrl({ fileKey: sourcePdfKey })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      person(
        "user",
        2,
        JSON.stringify(["東京都"])
      ).estimateAssistant.pdfPreviewUrl({ draftId: saved.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      person("customer").estimateAssistant.pdfPreviewUrl({ draftId: saved.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storageGetSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("原本単価は非破壊。追加→編集→検索候補反映→削除で監査履歴を残す", async () => {
    const created = await user.estimateAssistant.masterSave({ price: valid });
    createdPriceIds.push(created.id);
    const first = (await owner.estimateAssistant.masterList()).find(
      x => x.id === created.id
    )!;
    expect(first.standard).toBe(8000);
    expect(
      (await executive.estimateAssistant.catalog()).items.some(
        x => x.id === created.id
      )
    ).toBe(true);
    const extracted = {
      name: valid.name,
      specification: valid.specification,
      unit: valid.unit,
      quantity: 1,
      widthMm: null,
      heightMm: null,
      evidence: "特殊工事",
      pageNumber: 1,
    };
    expect(
      priceExtractedItem(
        extracted,
        (await owner.estimateAssistant.catalog()).items
      ).unitPrice
    ).toBe(8000);
    await expect(
      owner.estimateAssistant.masterSave({
        id: created.id,
        expectedUpdatedAt: created.updatedAt,
        price: { ...valid, low: 10000, standard: 8000 },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const updated = await executive.estimateAssistant.masterSave({
      id: created.id,
      expectedUpdatedAt: created.updatedAt,
      price: { ...valid, standard: 8500 },
    });
    expect(
      priceExtractedItem(
        extracted,
        (await user.estimateAssistant.catalog()).items
      ).unitPrice
    ).toBe(8500);
    const fixedDraft = await user.estimateAssistant.saveDraft({
      caseId,
      title: "単価マスタ変更テスト",
      sourceKind: "manual",
      items: [
        priceExtractedItem(
          extracted,
          (await user.estimateAssistant.catalog()).items
        ),
      ],
    });
    const fixedQuote = await user.estimateAssistant.approveDraft({
      id: fixedDraft.id,
      expectedUpdatedAt: fixedDraft.updatedAt,
    });
    await expect(
      user.estimateAssistant.masterDelete({
        id: created.id,
        expectedUpdatedAt: created.updatedAt,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await owner.estimateAssistant.masterDelete({
      id: created.id,
      expectedUpdatedAt: updated.updatedAt,
    });
    expect(
      (await user.estimateAssistant.catalog()).items.some(
        x => x.id === created.id
      )
    ).toBe(false);
    expect(
      (await user.estimateAssistant.approvedQuote({ id: fixedDraft.id }))
        .items[0].unitPrice
    ).toBe(8500);
    expect(fixedQuote.items[0].source).toContain(created.id);
    expect(
      (await owner.estimateAssistant.masterList()).find(
        x => x.id === created.id
      )?.isActive
    ).toBe(false);
    expect(
      (await user.estimateAssistant.masterHistory({ id: created.id })).map(
        x => x.operation
      )
    ).toEqual(["delete", "update", "create"]);
    expect(
      (await owner.estimateAssistant.masterList()).filter(x =>
        x.id.startsWith("standard:")
      )
    ).toHaveLength(117);
  }, 30000);

  it("未確定価格を拒否し、保存済み案のみ承認する。承認時の金額・案件情報を固定して再出力できる", async () => {
    const incomplete = await owner.estimateAssistant.saveDraft({
      caseId,
      title: "未確定",
      sourceKind: "manual",
      items: [{ ...item, unitPrice: null }],
    });
    await expect(
      user.estimateAssistant.approveDraft({
        id: incomplete.id,
        expectedUpdatedAt: incomplete.updatedAt,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      (await owner.estimateAssistant.listDrafts({ caseId })).find(
        x => x.id === incomplete.id
      )?.status
    ).toBe("draft");
    const edited = await user.estimateAssistant.saveDraft({
      id: incomplete.id,
      expectedUpdatedAt: incomplete.updatedAt,
      caseId,
      title: "確定版",
      sourceKind: "manual",
      items: [item],
    });
    const approved = await executive.estimateAssistant.approveDraft({
      id: incomplete.id,
      expectedUpdatedAt: edited.updatedAt,
    });
    expect(approved).toMatchObject({
      total: 11000,
      subtotal: 10000,
      tax: 1000,
      approvedBy: 3,
      requestNumber: expect.stringContaining("TEST-EST-WORKFLOW"),
    });
    expect(approved.items[0]).toMatchObject({ quantity: 2, unitPrice: 5000 });
    await expect(
      owner.estimateAssistant.saveDraft({
        id: incomplete.id,
        expectedUpdatedAt: edited.updatedAt,
        caseId,
        title: "改変",
        sourceKind: "manual",
        items: [item],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      user.estimateAssistant.approveDraft({
        id: incomplete.id,
        expectedUpdatedAt: edited.updatedAt,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await user.estimateAssistant.approvedQuote({ id: incomplete.id })
    ).toEqual(approved);
    await expect(
      person(
        "user",
        2,
        JSON.stringify(["東京都"])
      ).estimateAssistant.approvedQuote({ id: incomplete.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const currentCase = await owner.cases.get({ id: caseId });
    expect(currentCase?.plenusQuoteAmount).toBeNull();
    expect(currentCase?.estimatedCost).toBeNull();
  }, 30000);
});
