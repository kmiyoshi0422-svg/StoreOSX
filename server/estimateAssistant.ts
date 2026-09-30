import rawCatalog from "./catalog/standardUnitPrices.json";
import {
  FORETIA_PRICE_DATE,
  FORETIA_SOURCE,
  quoteForetia,
  type EstimateLine,
} from "../shared/estimateAssistant";

export type UnitPrice = (typeof rawCatalog.items)[number];
export const unitPriceCatalog = rawCatalog;

export type PdfWorkItem = {
  name: string;
  specification: string;
  quantity: number | null;
  unit: string;
  widthMm: number | null;
  heightMm: number | null;
  evidence: string;
};

/** AIは作業と根拠のみ抽出する。曖昧な品番や仕様から価格を作らない。 */
export function priceExtractedItem(item: PdfWorkItem): EstimateLine {
  const name = item.name.trim().slice(0, 255);
  const spec = item.specification.trim().slice(0, 500);
  const base: EstimateLine = {
    name,
    specification: spec,
    quantity:
      item.quantity && Number.isFinite(item.quantity) && item.quantity > 0
        ? item.quantity
        : null,
    unit: item.unit.trim().slice(0, 30),
    unitPrice: null,
    source: "PDFの依頼内容（単価未設定）",
    note: item.evidence.trim().slice(0, 500),
  };
  // 完全な型番・寸法を含む場合のみ単一製品に結びつける。
  const description = `${name} ${spec}`;
  if (
    /フォレティア\s*50/i.test(description) &&
    description.includes("ネイチャー") &&
    description.includes("ラダーコード") &&
    item.widthMm != null &&
    item.heightMm != null
  ) {
    const quote = quoteForetia(item.widthMm, item.heightMm);
    if (quote) {
      return {
        ...base,
        name: "フォレティア50 ネイチャー／ラダーコード",
        specification: `幅${item.widthMm}×高さ${item.heightMm}mm (${quote.widthBandCm}×${quote.heightBandCm}cm帯)`,
        unit: "台",
        unitPrice: quote.taxExcluded,
        source: `参考商品価格 ${FORETIA_PRICE_DATE} / ${FORETIA_SOURCE}（税込価格から換算・施工費別）`,
        note: `${base.note} / 販売店価格は要再確認`,
      };
    }
  }
  const normalized = (s: string) =>
    s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  const candidates = unitPriceCatalog.items.filter(
    entry =>
      normalized(entry.name) === normalized(name) &&
      normalized(entry.unit) === normalized(item.unit) &&
      (entry.specification
        ? normalized(entry.specification) === normalized(spec)
        : !spec)
  );
  if (candidates.length !== 1) return base;
  const entry = candidates[0];
  return {
    ...base,
    unitPrice: entry.standard,
    source: `${entry.id} / 標準施工単価表 ${unitPriceCatalog.version}（税区分は原本に明記なし・税抜試算）`,
  };
}
