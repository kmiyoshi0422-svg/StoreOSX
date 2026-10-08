import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { blobToBase64, type PdfHistoryReportType } from "@/lib/pdfHistory";
import type jsPDF from "jspdf";

type RecordPdfInput = {
  pdf: jsPDF;
  fileName: string;
  reportType: PdfHistoryReportType;
  caseId?: number | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  metadata?: Record<string, unknown>;
};

export function usePdfHistoryRecorder() {
  const { user } = useAuth();
  const uploadMutation = trpc.pdfHistory.upload.useMutation();

  const recordPdf = async ({
    pdf,
    fileName,
    reportType,
    caseId,
    periodStart,
    periodEnd,
    metadata,
  }: RecordPdfInput) => {
    // 社外は許可案件のPDFを出力できるが、社内専用の履歴APIは呼ばない。
    if (user?.role === "partner" || user?.role === "customer") return { skipped: true };
    const blob = pdf.output("blob");
    const fileBase64 = await blobToBase64(blob);
    return uploadMutation.mutateAsync({
      caseId: caseId ?? null,
      reportType,
      fileName,
      fileBase64,
      fileSize: blob.size,
      periodStartMs: periodStart?.getTime() ?? null,
      periodEndMs: periodEnd?.getTime() ?? null,
      metadata,
    });
  };

  return {
    recordPdf,
    isRecording: uploadMutation.isPending,
  };
}
