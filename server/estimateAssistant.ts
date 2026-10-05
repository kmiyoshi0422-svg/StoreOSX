import rawCatalog from "./catalog/standardUnitPrices.json";
import type { EstimateLine } from "../shared/estimateAssistant";

export type UnitPrice = (typeof rawCatalog.items)[number];
export type PriceCandidate = UnitPrice & { sourceRef?: string };
export const unitPriceCatalog = rawCatalog;

export type PdfWorkItem = {
  name: string;
  specification: string;
  quantity: number | null;
  unit: string;
  widthMm: number | null;
  heightMm: number | null;
  evidence: string;
  pageNumber?: number | null;
};

/** PDF・案件の事実だけを見積候補に移す。価格マスタも商品計算も自動適用しない。 */
export function priceExtractedItem(item: PdfWorkItem): EstimateLine {
  return {
    name: item.name.trim().slice(0, 255),
    specification: item.specification.trim().slice(0, 500),
    quantity:
      item.quantity != null &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0
        ? item.quantity
        : null,
    unit: item.unit.trim().slice(0, 30) || "式",
    unitPrice: null,
    source: "依頼内容から抽出（単価は自由入力・標準単価を自動適用しない）",
    note: "",
    evidence: item.evidence.trim().slice(0, 500),
    pageNumber: item.pageNumber ?? null,
  };
}
