import { trpc } from "@/lib/trpc";
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
