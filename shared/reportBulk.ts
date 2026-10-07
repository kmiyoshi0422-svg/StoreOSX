export const BULK_REPORT_LIMIT = 8;
export const BULK_REPORT_MAX_BYTES = 80 * 1024 * 1024;
export const BULK_REPORT_HISTORY_MAX_PDF_BYTES = 30 * 1024 * 1024;
export const BULK_REPORT_TYPES = ["現場調査報告書", "施工完了報告書"] as const;
export type BulkReportType = (typeof BULK_REPORT_TYPES)[number];

type NamedCase = { caseId: number; requestNumber?: string | null; storeName?: string | null };

function safePart(value: string, maxLength = 50) {
  return value.normalize("NFKC")
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/\s+/g, "_")
    .replace(/^\.+/, "_")
    .slice(0, maxLength) || "未設定";
}

export function reportArchiveFileName(item: NamedCase & {
  reportType: BulkReportType;
  historyId?: number;
}) {
  const number = safePart(item.requestNumber || `案件${item.caseId}`);
  const store = safePart(item.storeName || "店舗未設定");
  const suffix = item.historyId ? `_履歴${item.historyId}` : "";
  return `${number}_${store}_${item.reportType}_案件${item.caseId}${suffix}.pdf`;
}

/** ZIP名はダウンロードする日の日本時間で統一する。複数案件では先頭の店舗名と残りの案件数を示す。 */
export function reportArchiveName(items: ReadonlyArray<NamedCase>, date = new Date()) {
  if (items.length < 2 || items.length > BULK_REPORT_LIMIT) {
    throw new Error(`報告書は2〜${BULK_REPORT_LIMIT}件を選択してください`);
  }
  const first = items[0];
  const uniqueCases = new Set(items.map((item) => item.caseId));
  const store = safePart(first.storeName || "店舗未設定", 36);
  const identity = uniqueCases.size === 1
    ? `${store}_${safePart(first.requestNumber || `案件${first.caseId}`, 36)}`
    : `${store}_ほか${uniqueCases.size - 1}案件`;
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${identity}_現調・完了報告書_${value("year")}${value("month")}${value("day")}_${value("hour")}${value("minute")}.zip`;
}
