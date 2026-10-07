import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { readFileSync } from "node:fs";
import type { TrpcContext } from "./_core/context";

const fake = vi.hoisted(() => ({
  getCaseById: vi.fn(), getPdfGenerationHistoryById: vi.fn(), getDb: vi.fn(),
  storageGetSignedUrl: vi.fn(), storagePut: vi.fn(),
}));
vi.mock("./db", () => fake);
vi.mock("./storage", () => ({ storageGetSignedUrl: fake.storageGetSignedUrl, storagePut: fake.storagePut }));

import { reportBulkRouter } from "./reportBulkRouter";
import { createReportZip } from "../client/src/lib/reportBulkZip";
import { reportArchiveFileName } from "../shared/reportBulk";

const pdf = (n: number) => Buffer.from(`%PDF-1.4\nmock-report-${n}\n%%EOF`);
function caller(role: "owner" | "admin" | "user" | "executive" | "partner" | "customer", areaAccessMode?: "selected") {
  const now = new Date();
  return reportBulkRouter.createCaller({
    user: { id: 12, openId: `TEST-bulk-${role}`, name: role, role,
      email: `test-${role}@example.invalid`, loginMethod: "manus", createdAt: now,
      updatedAt: now, lastSignedIn: now, areaAccessMode,
      allowedPrefectures: '["東京都"]' },
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}
const row = (id: number, prefecture = "東京都") => ({ id, requestNumber: `TEST-ZIP-${id}`,
  storeName: `試験店${id}`, prefecture, reportStatus: "completed", surveyDate: new Date(),
  surveyImpression: "確認済み", completedAt: new Date(), status: "完了" });

beforeEach(() => {
  vi.resetAllMocks();
  fake.getCaseById.mockImplementation(async (id: number) => row(id, id === 9 ? "大阪府" : "東京都"));
  fake.getPdfGenerationHistoryById.mockImplementation(async (id: number) => ({ id, caseId: id === 2 ? 9 : 1,
    reportType: id === 3 ? "写真台帳" : "現場調査報告書", fileSize: 28,
    fileKey: `pdf-history/case-${id === 2 ? 9 : 1}/test-${id}.pdf` }));
  fake.storageGetSignedUrl.mockImplementation(async (key: string) => `https://example.invalid/${key}`);
  fake.storagePut.mockResolvedValue({ key: "test.zip", url: "/manus-storage/test.zip" });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true,
    headers: new Headers({ "content-length": String(pdf(url.includes("test-2") ? 2 : 1).length) }),
    arrayBuffer: async () => pdf(url.includes("test-2") ? 2 : 1) }))); // Buffer is a Uint8Array; only stubs the network
});

describe("一括報告書ZIPの選択と権限", () => {
  it.each(["partner", "customer"] as const)("%s の選択・履歴ZIPを拒否", async (role) => {
    await expect(caller(role).validate([{ caseId: 1, reportType: "現場調査報告書" },
      { caseId: 2, reportType: "施工完了報告書" }])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(role).zipStored([1, 2])).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.storagePut).not.toHaveBeenCalled();
  });
  it("全員に閲覧権限を再確認し、エリア外のPDFは読込前に全件停止", async () => {
    await expect(caller("user", "selected").zipStored([1, 2])).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.storageGetSignedUrl).not.toHaveBeenCalled();
    expect(fake.storagePut).not.toHaveBeenCalled();
    await expect(caller("user", "selected").validate([{ caseId: 1, reportType: "現場調査報告書" },
      { caseId: 9, reportType: "施工完了報告書" }])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("2件の保存済みPDFだけを混同しない固有名でZIP化", async () => {
    fake.getPdfGenerationHistoryById.mockImplementation(async (id: number) => ({ id, caseId: 1,
      reportType: id === 1 ? "現場調査報告書" : "施工完了報告書", fileSize: 28,
      fileKey: `pdf-history/case-1/test-${id}.pdf` }));
    const result = await caller("owner").zipStored([1, 2]);
    expect(result.count).toBe(2);
    const archive = await JSZip.loadAsync(fake.storagePut.mock.calls[0][1]);
    const names = Object.keys(archive.files);
    expect(names).toHaveLength(2);
    expect(names[0]).toContain("現場調査報告書");
    expect(names[1]).toContain("施工完了報告書");
    expect(await archive.file(names[0])!.async("string")).toContain("%PDF");
  });
  it("写真台帳や破損PDFを含む選択はZIPを保存しない", async () => {
    await expect(caller("owner").zipStored([1, 3])).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fake.storageGetSignedUrl).not.toHaveBeenCalled();
    fake.getPdfGenerationHistoryById.mockImplementation(async (id: number) => ({ id, caseId: 1,
      reportType: "現場調査報告書", fileSize: 30, fileKey: `pdf-history/case-1/test-${id}.pdf` }));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, headers: new Headers(),
      arrayBuffer: async () => Buffer.from("not PDF") })));
    await expect(caller("executive").zipStored([1, 2])).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fake.storagePut).not.toHaveBeenCalled();
  });
  it("保存元に2件未満、重複IDや容量超過を許さない", async () => {
    await expect(caller("admin").zipStored([1, 1])).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller("admin").zipStored([1])).rejects.toMatchObject({ code: "BAD_REQUEST" });
    fake.getPdfGenerationHistoryById.mockImplementation(async (id: number) => ({ id, caseId: 1,
      reportType: "施工完了報告書", fileSize: 81 * 1024 * 1024, fileKey: `pdf-history/case-1/test-${id}.pdf` }));
    await expect(caller("admin").zipStored([1, 2])).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(fake.storagePut).not.toHaveBeenCalled();
  });
});

describe("一括生成したA4 PDFのZIP", () => {
  it("現調・完了は既存の.report-pageだけを使い全件確認後にZIP出力", () => {
    const hook = readFileSync("client/src/hooks/useBulkReportFrame.ts", "utf8");
    const view = readFileSync("client/src/pages/ReportBulkDownload.tsx", "utf8");
    for (const name of ["CaseReport", "CompletionReport"]) {
      const file = readFileSync(`client/src/pages/${name}.tsx`, "utf8");
      expect(file).toContain("useBulkReportFrame({");
    }
    expect(hook).toContain('querySelectorAll<HTMLElement>(".report-page")');
    expect(hook).toContain("strict: true");
    expect(view).toContain("verified.size !== reports.length");
    expect(view).toContain("event.origin !== window.location.origin");
  });
  it("2種類のPDFを別ファイルに保存し、同名案件でも衝突しない", async () => {
    const name = reportArchiveFileName({ caseId: 7, requestNumber: "../A\\B", storeName: "test", reportType: "現場調査報告書" });
    expect(name).not.toContain("..");
    expect(name).not.toContain("\\");
    const entries = [1, 2].map(n => ({ fileName: `${n}.pdf`, bytes: pdf(n).buffer.slice(pdf(n).byteOffset, pdf(n).byteOffset + pdf(n).byteLength) as ArrayBuffer }));
    const zip = await createReportZip(entries);
    const archive = await JSZip.loadAsync(await zip.arrayBuffer());
    expect(Object.keys(archive.files)).toEqual(["1.pdf", "2.pdf"]);
    expect(await archive.file("2.pdf")!.async("string")).toContain("mock-report-2");
  });
  it("重複ファイル名・破損PDFは全件拒否", async () => {
    const data = pdf(1);
    const buf = Uint8Array.from(data).buffer;
    await expect(createReportZip([{ fileName: "same.pdf", bytes: buf }, { fileName: "same.pdf", bytes: buf }])).rejects.toThrow("重複");
    await expect(createReportZip([{ fileName: "a.pdf", bytes: buf }, { fileName: "b.pdf", bytes: Uint8Array.from([1,2,3]).buffer }])).rejects.toThrow("PDF形式");
  });
});
