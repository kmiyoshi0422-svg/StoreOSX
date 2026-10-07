import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { getPdfGenerationHistoryById } from "./db";
import { storageGetSignedUrl } from "./storage";
import { reportArchiveFileName } from "../shared/reportBulk";
import type { TrpcContext } from "./_core/context";

const now = new Date();
const user = { id: 1, openId: "TEST-bulk-history-owner", name: "TEST PDF履歴検証",
  email: "test-bulk@example.invalid", loginMethod: "manus", role: "owner" as const,
  createdAt: now, updatedAt: now, lastSignedIn: now };
const caller = appRouter.createCaller({ user,
  req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });

describe("一括生成PDFの実DB・ストレージ履歴", () => {
  it("保存、検索、再取得、再試行時の重複防止、案件削除時の清掃", async () => {
    const requestNumber = `TEST-BULK-HISTORY-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const created = await caller.cases.create({ requestNumber, brand: "その他", storeName: "履歴検証テスト店", prefecture: "福岡県" });
    let historyId: number | undefined;
    try {
      await caller.cases.update({ id: created.id, data: { surveyImpression: "現調確認済み" } });
      const name = reportArchiveFileName({ caseId: created.id, requestNumber, storeName: "履歴検証テスト店",
        reportType: "現場調査報告書" });
      const sourcePdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
      const input = { caseId: created.id, reportType: "現場調査報告書" as const,
        fileName: name, fileBase64: sourcePdf.toString("base64"),
        batchItemKey: randomUUID(), pageCount: 1 };
      const first = await caller.reportBulk.saveGenerated(input);
      historyId = first.id;
      expect(first.alreadySaved).toBe(false);
      const second = await caller.reportBulk.saveGenerated(input);
      expect(second).toEqual({ id: first.id, alreadySaved: true });
      const listing = await caller.pdfHistory.list({ search: requestNumber, limit: 5, offset: 0 });
      expect(listing.total).toBe(1);
      expect(listing.items[0]).toMatchObject({ caseId: created.id, fileName: name,
        reportType: "現場調査報告書", generatedByName: user.name });
      const saved = await getPdfGenerationHistoryById(first.id);
      expect(saved?.metadata).toContain('"source":"bulk-report"');
      const download = await caller.pdfHistory.getDownloadUrl({ id: first.id });
      expect(download.fileName).toBe(name);
      const signed = await storageGetSignedUrl(saved!.fileKey);
      const bytes = Buffer.from(await (await fetch(signed)).arrayBuffer());
      expect(bytes).toEqual(sourcePdf);
    } finally {
      await caller.cases.delete({ id: created.id });
    }
    expect(await getPdfGenerationHistoryById(historyId!)).toBeUndefined();
  }, 45000);
});
