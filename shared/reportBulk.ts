export const BULK_REPORT_LIMIT = 8;
export const BULK_REPORT_MAX_BYTES = 80 * 1024 * 1024;
export const BULK_REPORT_TYPES = ["現場調査報告書", "施工完了報告書"] as const;
export type BulkReportType = (typeof BULK_REPORT_TYPES)[number];

export function reportArchiveFileName(item: {
  caseId: number;
  reportType: BulkReportType;
  requestNumber?: string | null;
  storeName?: string | null;
  historyId?: number;
}) {
  const clean = (value: string) => value.normalize("NFKC")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/\s+/g, "_")
    .replace(/^\.+/, "_")
    .slice(0, 50);
  const number = clean(item.requestNumber || `案件${item.caseId}`);
  const store = clean(item.storeName || "店舗未設定");
  const suffix = item.historyId ? `_履歴${item.historyId}` : "";
  return `${number}_${store}_${item.reportType}_案件${item.caseId}${suffix}.pdf`;
}

export function reportArchiveName() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return `現調・完了報告書_${local.toISOString().slice(0, 16).replace(/[-T:]/g, "")}.zip`;
}
