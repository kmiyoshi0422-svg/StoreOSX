import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { getCaseRequestSource } from "./db";
import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl } from "./storage";

vi.mock("./_core/llm", async original => ({
  ...(await original<typeof import("./_core/llm")>()),
  invokeLLM: vi.fn(async () => ({
    choices: [{ message: { content: JSON.stringify({
      pdfRequestNumber: null,
      discrepancies: [], items: [
      { name: "建具調整", specification: null, quantity: null, unit: null,
        widthMm: null, heightMm: null, evidence: "バックヤードの鍵が開閉しづらい", pageNumber: null },
    ] }) } }],
  })),
}));
vi.mock("./storage", async original => ({
  ...(await original<typeof import("./storage")>()),
  storageGetSignedUrl: vi.fn(async () => "https://example.invalid/TEST-request.pdf"),
}));

function person(role: NonNullable<TrpcContext["user"]>["role"], id = 1, selected?: string[]) {
  const now = new Date();
  return appRouter.createCaller({
    user: { id, openId: `TEST-case-estimate-${id}`, name: `TEST-${role}`,
      email: `test-${role}@example.invalid`, loginMethod: "manus", role,
      areaAccessMode: selected ? "selected" : "all",
      allowedPrefectures: selected ? JSON.stringify(selected) : null,
      createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}
const owner = person("owner");
const employee = person("user", 2);

describe("案件詳細から依頼PDFを再アップロードせず見積案生成", () => {
  const caseIds: number[] = [];
  const key = `imports/case-1-${Date.now()}-test99.pdf`;
  beforeAll(async () => {
    const requestNumber = `TEST-CASE-EST-${Date.now()}`;
    caseIds.push((await owner.cases.create({
      requestNumber, storeName: "TEST-山口の建具店", prefecture: "山口県",
      requestContent: "バックヤードの鍵が開閉しづらい", categoryMedium: "建具関連",
      requestPdfKey: key, requestPdfName: "TEST依頼.pdf",
    })).id);
    caseIds.push((await owner.cases.create({
      requestNumber: `${requestNumber}-OLD`, storeName: "TEST-既存案件", prefecture: "山口県",
      requestContent: "雨漏りの調査を依頼", categoryMedium: "屋根関連",
    })).id);
  }, 30000);
  afterAll(async () => {
    for (const id of caseIds) await owner.cases.delete({ id });
  }, 30000);

  it("登録時に本人PDFだけ保存し、別ユーザー・他人のキーを拒否", async () => {
    expect(await getCaseRequestSource(caseIds[0])).toMatchObject({
      fileKey: key, uploadedBy: 1, fileName: "TEST依頼.pdf",
    });
    expect(await getCaseRequestSource(caseIds[1])).toBeNull();
    await expect(employee.cases.create({
      requestNumber: `TEST-UNAUTH-PDF-${Date.now()}`, storeName: "TEST拒否",
      requestPdfKey: key, requestPdfName: "TEST依頼.pdf",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("社員は案件情報から生成でき、元PDFは紐付け済み案件にだけ表示する", async () => {
    const context = await employee.estimateAssistant.caseContext({ caseId: caseIds[0] });
    expect(context).toMatchObject({ hasSourcePdf: true, sourcePdfName: "TEST依頼.pdf" });
    expect(JSON.stringify(context)).not.toContain("fileKey");
    const newCase = await employee.estimateAssistant.analyzeCase({ caseId: caseIds[0] });
    expect(newCase.sourcePdfKey).toBe(key);
    expect(newCase.pdfAnalyzed).toBe(true);
    expect(newCase.runId).toBeGreaterThan(0);
    const pdfInput = vi.mocked(invokeLLM).mock.calls.at(-1)?.[0].messages[1]?.content;
    expect(pdfInput).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "text", text: expect.stringContaining("バックヤードの鍵が開閉しづらい") }),
      expect.objectContaining({ type: "file_url", file_url: expect.objectContaining({ mime_type: "application/pdf", url: "https://example.invalid/TEST-request.pdf" }) }),
    ]));
    expect(newCase.items[0]).toMatchObject({ name: "建具調整", unitPrice: null,
      quantity: null, unit: "式", source: "案件元PDFと登録情報（単価は自由入力）", pageNumber: null, evidenceSource: "pdf" });
    const oldCase = await employee.estimateAssistant.analyzeCase({ caseId: caseIds[1] });
    expect(oldCase.sourcePdfKey).toBeNull();
    expect(oldCase.pdfAnalyzed).toBe(false);
    expect((await employee.estimateAssistant.caseContext({ caseId: caseIds[1] })).hasSourcePdf).toBe(false);
    await employee.estimateAssistant.decideCandidates({ caseId: caseIds[0], runId: newCase.runId!, ids: [newCase.items[0].candidateId!], decision: "adopt" });
    const saved = await employee.estimateAssistant.saveDraft({
      caseId: caseIds[0], title: "TEST-案件明細", sourceKind: "request_pdf",
      sourcePdfKey: key, sourcePdfName: "TEST依頼.pdf", items: newCase.items,
    });
    expect(saved.missing).toBe(1);
    expect((await employee.estimateAssistant.pdfPreviewUrl({ caseId: caseIds[0] })).url).toContain("TEST-request.pdf");
    expect((await employee.estimateAssistant.pdfPreviewUrl({ draftId: saved.id })).url).toContain("TEST-request.pdf");
    await expect(employee.estimateAssistant.approveDraft({ id: saved.id, expectedUpdatedAt: saved.updatedAt }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(employee.estimateAssistant.saveDraft({
      caseId: caseIds[1], title: "TEST-混入拒否", sourceKind: "request_pdf",
      sourcePdfKey: key, sourcePdfName: "TEST依頼.pdf", items: newCase.items,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(employee.estimateAssistant.pdfPreviewUrl({ caseId: caseIds[1] }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(storageGetSignedUrl).toHaveBeenCalledTimes(3);
  }, 20000);

  it("元PDFの依頼番号が案件番号と違う場合は履歴も候補も作らない", async () => {
    const before = await employee.estimateAssistant.qualityReport({ days: 7, caseId: caseIds[0] });
    vi.mocked(invokeLLM).mockImplementationOnce(async () => ({ choices: [{ message: { content: JSON.stringify({
      pdfRequestNumber: "TEST-OTHER-CASE", discrepancies: [], items: [
        { name: "建具調整", specification: null, quantity: null, unit: null,
          widthMm: null, heightMm: null, evidence: "鍵", pageNumber: 1 },
      ],
    }) } }] } as any));
    await expect(employee.estimateAssistant.analyzeCase({ caseId: caseIds[0] }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect((await employee.estimateAssistant.qualityReport({ days: 7, caseId: caseIds[0] })).generated).toBe(before.generated);
  }, 20000);

  it("協力業者・顧客・許可エリア外の社員は案件情報や元PDFを取得できない", async () => {
    for (const role of ["partner", "customer"] as const) {
      await expect(person(role).estimateAssistant.caseContext({ caseId: caseIds[0] }))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(person(role).estimateAssistant.analyzeCase({ caseId: caseIds[0] }))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    const otherArea = person("user", 3, ["東京都"]);
    await expect(otherArea.estimateAssistant.caseContext({ caseId: caseIds[0] }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(otherArea.estimateAssistant.analyzeCase({ caseId: caseIds[0] }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(otherArea.estimateAssistant.pdfPreviewUrl({ caseId: caseIds[0] }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
