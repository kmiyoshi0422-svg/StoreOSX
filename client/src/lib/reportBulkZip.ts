import JSZip from "jszip";
import { BULK_REPORT_LIMIT, BULK_REPORT_MAX_BYTES } from "../../../shared/reportBulk";

export async function createReportZip(
  entries: ReadonlyArray<{ fileName: string; bytes: ArrayBuffer }>,
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  if (entries.length < 2 || entries.length > BULK_REPORT_LIMIT) {
    throw new Error(`報告書は2〜${BULK_REPORT_LIMIT}件を選択してください`);
  }
  const zip = new JSZip();
  let totalBytes = 0;
  const names = new Set<string>();
  for (const entry of entries) {
    if (!entry.fileName.endsWith(".pdf") || entry.fileName.includes("/") || entry.fileName.includes("\\")
      || names.has(entry.fileName)) throw new Error("ZIP内のPDFファイル名が重複・不正です");
    names.add(entry.fileName);
    const bytes = new Uint8Array(entry.bytes);
    totalBytes += bytes.byteLength;
    if (bytes.byteLength < 4 || bytes[0] !== 37 || bytes[1] !== 80 || bytes[2] !== 68 || bytes[3] !== 70) {
      throw new Error(`${entry.fileName}はPDF形式ではありません`);
    }
    if (totalBytes > BULK_REPORT_MAX_BYTES) throw new Error("合計80MB以内で選択してください");
    zip.file(entry.fileName, bytes, { compression: "STORE" });
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" }, (metadata) => onProgress?.(Math.round(metadata.percent)));
}
