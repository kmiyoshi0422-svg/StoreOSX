import { TRPCError } from "@trpc/server";
import { z } from "zod";
import JSZip from "jszip";
import { createHash } from "node:crypto";
import { protectedProcedure, router } from "./_core/trpc";
import {
  createPdfGenerationHistory, getCaseById, getDb, getPdfGenerationHistoryByBatchKey,
  getPdfGenerationHistoryById,
} from "./db";
import { cases } from "../drizzle/schema";
import { storageGetSignedUrl, storagePut } from "./storage";
import { filterCasesByArea } from "../shared/accessPolicy";
import {
  BULK_REPORT_LIMIT,
  BULK_REPORT_HISTORY_MAX_PDF_BYTES,
  BULK_REPORT_MAX_BYTES,
  BULK_REPORT_TYPES,
  reportArchiveFileName,
  reportArchiveName,
  type BulkReportType,
} from "../shared/reportBulk";

const selection = z.array(z.object({ caseId: z.number().int().positive(), reportType: z.enum(BULK_REPORT_TYPES) }))
  .min(2, "報告書を2件以上選択してください")
  .max(BULK_REPORT_LIMIT);
const historySelection = z.array(z.number().int().positive()).min(2).max(BULK_REPORT_LIMIT)
  .refine((items) => new Set(items).size === items.length, "同じ履歴を二度選択できません");

function assertStaff(role: string) {
  if (!["owner", "admin", "user", "executive"].includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "報告書一括出力は社員以上だけが利用できます" });
  }
}

function eligibleForReport(record: {
  reportStatus: string | null;
  surveyDate: Date | null;
  surveyImpression: string | null;
  completedAt: Date | null;
  status: string;
}, type: BulkReportType) {
  return type === "現場調査報告書"
    ? Boolean(record.surveyDate || record.surveyImpression || record.reportStatus === "completed")
    : Boolean(record.completedAt || record.status === "完了");
}

export const reportBulkRouter = router({
  candidates: protectedProcedure.query(async ({ ctx }) => {
    assertStaff(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DBに接続できません" });
    const rows = await db.select({ id: cases.id, requestNumber: cases.requestNumber, storeName: cases.storeName,
      prefecture: cases.prefecture, reportStatus: cases.reportStatus, surveyDate: cases.surveyDate,
      surveyImpression: cases.surveyImpression, completedAt: cases.completedAt, status: cases.status }).from(cases);
    return filterCasesByArea(rows, ctx.user).map((row) => ({ id: row.id, requestNumber: row.requestNumber,
      storeName: row.storeName, canSurvey: eligibleForReport(row, "現場調査報告書"),
      canCompletion: eligibleForReport(row, "施工完了報告書") }));
  }),
  validate: protectedProcedure.input(selection).mutation(async ({ ctx, input }) => {
    assertStaff(ctx.user.role);
    if (new Set(input.map(({ caseId, reportType }) => `${caseId}-${reportType}`)).size !== input.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "同じ報告書を二度選択できません" });
    }
    const reports = [];
    for (const { caseId, reportType } of input) {
      const row = await getCaseById(caseId);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "案件が見つかりません" });
      if (!filterCasesByArea([row], ctx.user).length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "エリア外の案件を一括出力できません" });
      }
      if (!eligibleForReport(row, reportType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${row.requestNumber}の${reportType}は作成対象ではありません` });
      }
      reports.push({ caseId, reportType, requestNumber: row.requestNumber, storeName: row.storeName,
        fileName: reportArchiveFileName({ caseId, reportType, requestNumber: row.requestNumber, storeName: row.storeName }) });
    }
    return reports;
  }),
  saveGenerated: protectedProcedure.input(z.object({
    caseId: z.number().int().positive(), reportType: z.enum(BULK_REPORT_TYPES),
    fileName: z.string().min(5).max(500).endsWith(".pdf"),
    fileBase64: z.string().min(5).max(43_000_000),
    batchItemKey: z.string().uuid(), pageCount: z.number().int().min(1).max(150),
  })).mutation(async ({ ctx, input }) => {
    assertStaff(ctx.user.role);
    const record = await getCaseById(input.caseId);
    if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "案件が見つかりません" });
    if (!filterCasesByArea([record], ctx.user).length) {
      throw new TRPCError({ code: "FORBIDDEN", message: "エリア外の案件のPDFは保存できません" });
    }
    if (!eligibleForReport(record, input.reportType)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "現在の案件状態ではこの報告書を保存できません" });
    }
    const expected = reportArchiveFileName({ caseId: input.caseId, reportType: input.reportType,
      requestNumber: record.requestNumber, storeName: record.storeName });
    if (input.fileName !== expected) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "案件情報が変わりました。PDFを再生成してください" });
    }
    const raw = input.fileBase64.startsWith("data:application/pdf;base64,")
      ? input.fileBase64.slice("data:application/pdf;base64,".length) : input.fileBase64;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "PDFのデータ形式が正しくありません" });
    }
    const bytes = Buffer.from(raw, "base64");
    if (bytes.length < 5 || bytes.length > BULK_REPORT_HISTORY_MAX_PDF_BYTES || bytes.subarray(0, 4).toString() !== "%PDF") {
      throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "履歴に保存できるPDFは1件30MB以内の正しいPDFのみです" });
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    const existing = await getPdfGenerationHistoryByBatchKey(input.batchItemKey);
    if (existing) {
      let previousDigest: string | undefined;
      try { previousDigest = JSON.parse(existing.metadata ?? "{}").sha256; } catch { /* malformed legacy metadata */ }
      if (existing.caseId !== input.caseId || existing.reportType !== input.reportType ||
          existing.generatedBy !== ctx.user.id || existing.fileName !== input.fileName ||
          existing.fileSize !== bytes.length || previousDigest !== digest) {
        throw new TRPCError({ code: "CONFLICT", message: "同じ保存キーに別のPDFが登録されています" });
      }
      return { id: existing.id, alreadySaved: true };
    }
    const key = `pdf-history/case-${input.caseId}/${Date.now()}-${input.batchItemKey}.pdf`;
    const stored = await storagePut(key, bytes, "application/pdf");
    try {
      const id = await createPdfGenerationHistory({ caseId: input.caseId, reportType: input.reportType,
        fileName: input.fileName, fileKey: stored.key, fileUrl: stored.url, fileSize: bytes.length,
        generatedBy: ctx.user.id, generatedByName: ctx.user.name ?? ctx.user.email ?? `User ${ctx.user.id}`,
        batchItemKey: input.batchItemKey, metadata: JSON.stringify({ source: "bulk-report", pageCount: input.pageCount, sha256: digest }) });
      return { id, alreadySaved: false };
    } catch (error) {
      const message = String(error instanceof Error ? (error.cause ?? error.message) : error);
      if (/ER_DUP_ENTRY|Duplicate entry/.test(message)) {
        const collided = await getPdfGenerationHistoryByBatchKey(input.batchItemKey);
        if (collided?.caseId === input.caseId && collided.reportType === input.reportType &&
            collided.generatedBy === ctx.user.id && collided.fileSize === bytes.length &&
            collided.fileName === input.fileName && JSON.parse(collided.metadata ?? "{}").sha256 === digest) {
          return { id: collided.id, alreadySaved: true };
        }
        throw new TRPCError({ code: "CONFLICT", message: "同じ保存キーに別のPDFが登録されています" });
      }
      throw error;
    }
  }),
  zipStored: protectedProcedure.input(historySelection).mutation(async ({ ctx, input }) => {
    assertStaff(ctx.user.role);
    const items = [];
    let claimedBytes = 0;
    // Authorization for *every* document before accessing any storage URL.
    for (const id of input) {
      const item = await getPdfGenerationHistoryById(id);
      if (!item || !BULK_REPORT_TYPES.includes(item.reportType as BulkReportType) || !item.caseId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "選択した履歴に対象外のPDFが含まれます" });
      }
      const record = await getCaseById(item.caseId);
      if (!record || !filterCasesByArea([record], ctx.user).length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "アクセスできない案件のPDFが含まれます" });
      }
      if (!item.fileKey.startsWith(`pdf-history/case-${item.caseId}/`) || !item.fileKey.toLowerCase().endsWith(".pdf")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "保存済みPDFの参照形式が正しくありません" });
      }
      claimedBytes += item.fileSize ?? 0;
      if (claimedBytes > BULK_REPORT_MAX_BYTES) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "合計80MB以内で選択してください" });
      items.push({ item, record });
    }

    const zip = new JSZip();
    let actualBytes = 0;
    for (const { item, record } of items) {
      try {
        const signed = await storageGetSignedUrl(item.fileKey);
        const res = await fetch(signed, { signal: AbortSignal.timeout(45_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const size = Number(res.headers.get("content-length") || 0);
        if (size > BULK_REPORT_MAX_BYTES - actualBytes) throw new Error("ファイルサイズの上限超過");
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length === 0 || bytes.length > BULK_REPORT_MAX_BYTES - actualBytes || bytes.subarray(0, 4).toString() !== "%PDF") {
          throw new Error("PDFが空・破損しているかサイズ上限を超えました");
        }
        actualBytes += bytes.length;
        zip.file(reportArchiveFileName({ caseId: item.caseId!, reportType: item.reportType as BulkReportType,
          requestNumber: record.requestNumber, storeName: record.storeName, historyId: item.id }), bytes, { compression: "STORE" });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `履歴${item.id}のPDF取得に失敗しました。保存済みの原本を確認してください`, cause: error });
      }
    }
    const output = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
    if (output.length > BULK_REPORT_MAX_BYTES + 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE" });
    const name = reportArchiveName(items.map(({ item, record }) => ({
      caseId: item.caseId!, requestNumber: record.requestNumber, storeName: record.storeName,
    })));
    const stored = await storagePut(`report-bulk/${ctx.user.id}/${Date.now()}-${name}`, output, "application/zip");
    return { url: stored.url, fileName: name, count: items.length, bytes: output.length };
  }),
});
