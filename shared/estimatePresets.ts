import type { EstimateLine } from "./estimateAssistant";

/** 定型項目は作業名・単位を転記。数量は現場で確認し、施工標準単価を自動で引かない。 */
export function presetToEstimateLine(
  item: {
    name: string;
    specification: string;
    unit: string;
    unitPrice: number | null;
    note: string | null;
  },
  categoryName: string
): EstimateLine {
  return {
    name: item.name,
    specification: item.specification,
    quantity: null,
    unit: item.unit,
    unitPrice: item.unitPrice,
    source:
      item.unitPrice === null
        ? `定型メニュー「${categoryName}」（単価は自由入力）`
        : `定型メニュー「${categoryName}」（設定単価・確認可）`,
    note: item.note ?? "",
  };
}
