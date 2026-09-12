export type PdfHistoryReportType =
  | "現場調査報告書"
  | "施工完了報告書"
  | "写真台帳"
  | "写真台帳一括"
  | "ダッシュボード"
  | "効果検証"
  | "横断工程表"
  | "その他";

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("PDFデータの変換に失敗しました"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("PDFデータの読み込みに失敗しました"));
    reader.readAsDataURL(blob);
  });
}
