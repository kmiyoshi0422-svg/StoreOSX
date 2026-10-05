import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { calculateEstimate, quoteForetia } from "../shared/estimateAssistant";
import { priceExtractedItem, unitPriceCatalog } from "./estimateAssistant";
import { storagePut, storageGetSignedUrl } from "./storage";

vi.mock("./storage", async importOriginal => ({
  ...(await importOriginal<typeof import("./storage")>()),
  storagePut: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));

type Role = NonNullable<TrpcContext["user"]>["role"];
function caller(
  role: Role,
  options: Partial<NonNullable<TrpcContext["user"]>> = {}
) {
  const now = new Date();
  return appRouter.createCaller({
    user: {
      id: 1,
      openId: `estimate-${role}`,
      name: role,
      email: `${role}@example.com`,
      loginMethod: "manus",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      ...options,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}
const work = {
  name: "不明な塗装",
  specification: "",
  quantity: 2,
  unit: "式",
  widthMm: null,
  heightMm: null,
  evidence: "現場で塗装",
};

describe("見積支援の価格ロジック", () => {
  it("参考の幅1800×高さ2000mmは税込62590円・税抜56900円", () => {
    expect(quoteForetia(1800, 2000)).toMatchObject({
      taxIncluded: 62590,
      taxExcluded: 56900,
      tax: 5690,
      widthBandCm: 180,
      heightBandCm: 200,
    });
  });
  it("寸法を上の価格帯へ繰り上げ、境界・入力刻み・幅58cm未満・面積を拒否する", () => {
    expect(quoteForetia(1810, 2000)?.widthBandCm).toBe(200);
    expect(quoteForetia(280, 250)?.taxIncluded).toBe(27500);
    expect(quoteForetia(2400, 2800)?.taxIncluded).toBe(98450);
    for (const dims of [
      [279, 800],
      [1800, 2001],
      [2401, 800],
      [1800, 2801],
      [570, 2510],
      [2400, 4000],
      [NaN, 900],
    ]) {
      expect(quoteForetia(dims[0], dims[1])).toBeNull();
    }
  });
  it("共有単価表は117行・標準単価欠損0件・大小関係逆転0件", () => {
    expect(unitPriceCatalog.items).toHaveLength(117);
    expect(
      unitPriceCatalog.items.every(
        x => x.low > 0 && x.low <= x.standard && x.standard <= x.high
      )
    ).toBe(true);
  });
  it("PDFの不明数量は空欄で、標準単価やフォレティア価格も自動で代入しない", () => {
    expect(priceExtractedItem(work).unitPrice).toBeNull();
    expect(
      priceExtractedItem({ ...work, name: "コンセント新設", unit: "箇所" })
        .unitPrice
    ).toBeNull();
    expect(
      priceExtractedItem({
        ...work,
        name: "フォレティア50",
        widthMm: 1800,
        heightMm: 2000,
      }).unitPrice
    ).toBeNull();
    expect(
      priceExtractedItem({
        ...work,
        name: "フォレティア50 ネイチャー ラダーコード",
        widthMm: 1800,
        heightMm: 2000,
      }).unitPrice
    ).toBeNull();
    expect(
      priceExtractedItem({
        ...work,
        name: "フォレティア50 ネイチャー ラダーコード",
        widthMm: null,
      }).unitPrice
    ).toBeNull();
    expect(priceExtractedItem({ ...work, quantity: null, unit: "" })).toMatchObject({
      name: "不明な塗装", quantity: null, unit: "式", unitPrice: null,
    });
    expect(priceExtractedItem({ ...work, quantity: 3 }).quantity).toBe(3);
  });
  it("未価格項目は0円とみなして総額と誤認させず、入力済みのみ概算する", () => {
    const extracted = priceExtractedItem({
      ...work,
      name: "コンセント新設",
      unit: "箇所",
    });
    const priced = { ...extracted, unitPrice: 8000, source: "担当者が自由に入力" };
    expect(calculateEstimate([priced, priceExtractedItem(work)])).toEqual({
      subtotal: 16000,
      tax: 1600,
      total: 17600,
      missing: 1,
    });
  });
});

describe("見積支援のAPI権限・非破壊", () => {
  it.each(["partner", "customer"] as Role[])(
    "%sに価格カタログを渡さない",
    async role => {
      await expect(
        caller(role).estimateAssistant.catalog()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  );
  it.each(["owner", "admin", "executive", "user"] as Role[])(
    "%sは価格マスタを閲覧でき、PDFアップロードも操作可能（不正なPDFは拒否）",
    async role => {
      expect((await caller(role).estimateAssistant.catalog()).items).toHaveLength(117);
      await expect(caller(role).estimateAssistant.uploadPdf({
        fileName: "x.pdf", fileBase64: Buffer.from("not a pdf").toString("base64"),
      })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  );
  it("役員のPDF操作にもファイル所有者の境界を適用", async () => {
    await expect(
      caller("executive").estimateAssistant.analyzePdf({
        fileKey: "imports/estimate-assistant/999/other.pdf",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storagePut).not.toHaveBeenCalled();
  });
  it("管理者は偽PDFと他ユーザーのPDFキーを解析・保存前に拒否", async () => {
    await expect(
      caller("owner").estimateAssistant.uploadPdf({
        fileName: "x.pdf",
        fileBase64: Buffer.from("not a pdf").toString("base64"),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller("owner").estimateAssistant.analyzePdf({
        fileKey: "imports/estimate-assistant/999/fake.pdf",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storageGetSignedUrl).not.toHaveBeenCalled();
    expect(storagePut).not.toHaveBeenCalled();
  });
});

describe("見積案の案件紐付けと保存履歴", () => {
  const owner = caller("owner");
  let caseId = 0;
  beforeAll(async () => {
    caseId = (
      await owner.cases.create({
        requestNumber: `TEST-EST-ASSIST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        storeName: "見積支援テスト専用店舗",
        prefecture: "山口県",
      })
    ).id;
  }, 30000);
  afterAll(async () => {
    if (caseId) await owner.cases.delete({ id: caseId });
  }, 30000);
  it("追加→一覧→更新、旧版更新拒否、社内金額を自動更新しない", async () => {
    const extracted = priceExtractedItem({
      ...work,
      name: "コンセント新設",
      unit: "箇所",
    });
    const line = { ...extracted, unitPrice: 8000, source: "担当者が自由に入力" };
    const created = await owner.estimateAssistant.saveDraft({
      caseId,
      title: "試算案",
      sourceKind: "manual",
      items: [line],
    });
    expect(created).toMatchObject({
      subtotal: 16000,
      tax: 1600,
      total: 17600,
      missing: 0,
    });
    const rows = await owner.estimateAssistant.listDrafts({ caseId });
    expect(rows.find(row => row.id === created.id)?.items[0].source).toBe("担当者が自由に入力");
    const updated = await owner.estimateAssistant.saveDraft({
      id: created.id,
      expectedUpdatedAt: created.updatedAt,
      caseId,
      title: "修正版",
      sourceKind: "manual",
      items: [line, priceExtractedItem(work)],
    });
    expect(updated.missing).toBe(1);
    await expect(
      owner.estimateAssistant.saveDraft({
        id: created.id,
        expectedUpdatedAt: created.updatedAt,
        caseId,
        title: "古い版",
        sourceKind: "manual",
        items: [line],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const caseRecord = await owner.cases.get({ id: caseId });
    expect(caseRecord?.plenusQuoteAmount).toBeNull();
    expect(caseRecord?.estimatedCost).toBeNull();
  });
  it("許可エリア外の役員は金額のある見積案を閲覧できない", async () => {
    const restricted = caller("executive", {
      areaAccessMode: "selected",
      allowedPrefectures: JSON.stringify(["東京都"]),
    });
    await expect(
      restricted.estimateAssistant.listDrafts({ caseId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("他の管理者は既存PDFの出典を維持して編集でき、別ユーザーの新規PDFキーは使えない", async () => {
    const originalKey = "imports/estimate-assistant/1/test-source.pdf";
    const line = priceExtractedItem(work);
    const created = await owner.estimateAssistant.saveDraft({
      caseId,
      title: "元PDFありの案",
      sourceKind: "request_pdf",
      sourcePdfKey: originalKey,
      sourcePdfName: "テスト依頼書.pdf",
      items: [line],
    });
    const admin = caller("admin", { id: 990933 });
    const updated = await admin.estimateAssistant.saveDraft({
      id: created.id,
      expectedUpdatedAt: created.updatedAt,
      caseId,
      title: "共同編集後の案",
      sourceKind: "request_pdf",
      sourcePdfKey: originalKey,
      sourcePdfName: "テスト依頼書.pdf",
      items: [line],
    });
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    await expect(
      admin.estimateAssistant.saveDraft({
        id: created.id,
        expectedUpdatedAt: updated.updatedAt,
        caseId,
        title: "差し替え",
        sourceKind: "request_pdf",
        sourcePdfKey: "imports/estimate-assistant/1/other.pdf",
        sourcePdfName: "other.pdf",
        items: [line],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
