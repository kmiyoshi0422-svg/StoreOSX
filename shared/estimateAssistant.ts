/** 参考ページの2026-09-21価格スナップショット。仕入値・出し見積ではない。 */
export const FORETIA_SOURCE = "https://www.bicklycurtain.com/c/blind/1001631";
export const FORETIA_REFERENCE =
  "https://foretia-price-kei.maverick-4654.chatgpt.site/";
export const FORETIA_PRICE_DATE = "2026-09-21";
export const FORETIA_WIDTH_CM = [
  80, 100, 120, 140, 160, 180, 200, 220, 240,
] as const;
export const FORETIA_HEIGHT_CM = [
  80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280,
] as const;
export const FORETIA_PRICES_TAX_INCLUDED = [
  [27500, 30250, 32780, 35640, 37400, 39710, 43120, 45760, 47960],
  [29480, 30360, 34210, 38940, 41250, 44000, 47850, 50930, 53570],
  [31020, 33000, 36410, 41690, 44220, 47300, 51590, 55000, 57970],
  [32890, 36850, 40810, 44880, 47960, 51590, 56320, 60280, 63690],
  [34320, 38830, 43120, 47630, 51040, 55000, 60060, 64460, 68200],
  [36300, 41250, 45870, 50930, 54890, 59180, 64680, 69520, 73260],
  [37840, 43120, 48180, 53570, 57860, 62590, 68530, 74360, 78540],
  [39710, 45540, 50930, 56980, 61600, 66770, 72820, 78320, 82720],
  [41250, 47410, 53240, 59620, 64680, 70730, 78320, 84260, 88000],
  [43340, 49940, 56210, 63030, 67980, 74580, 82170, 90090, 93280],
  [45210, 52250, 59070, 66220, 71390, 78430, 86130, 96030, 98450],
] as const;

export type EstimateLine = {
  name: string;
  specification: string;
  quantity: number | null;
  unit: string;
  unitPrice: number | null; // 円・税抜の試算単価。出典を必ず併記
  source: string;
  note: string;
};

export function quoteForetia(widthMm: number, heightMm: number) {
  if (
    !Number.isInteger(widthMm) ||
    !Number.isInteger(heightMm) ||
    widthMm % 10 !== 0 ||
    heightMm % 10 !== 0
  )
    return null;
  if (widthMm < 280 || widthMm > 2400 || heightMm < 250 || heightMm > 2800)
    return null;
  if (widthMm < 580 && heightMm > 2500) return null;
  if (widthMm * heightMm > 9_000_000) return null;
  const wi = FORETIA_WIDTH_CM.findIndex(v => widthMm <= v * 10);
  const hi = FORETIA_HEIGHT_CM.findIndex(v => heightMm <= v * 10);
  if (wi < 0 || hi < 0) return null;
  const taxIncluded = FORETIA_PRICES_TAX_INCLUDED[hi]?.[wi];
  if (!taxIncluded) return null;
  const excluded = Math.round(taxIncluded / 1.1);
  return {
    taxIncluded,
    taxExcluded: excluded,
    tax: taxIncluded - excluded,
    widthBandCm: FORETIA_WIDTH_CM[wi],
    heightBandCm: FORETIA_HEIGHT_CM[hi],
  };
}

export function calculateEstimate(lines: EstimateLine[]) {
  let subtotal = 0;
  let missing = 0;
  for (const line of lines) {
    if (
      line.unitPrice === null ||
      line.quantity === null ||
      !Number.isFinite(line.quantity) ||
      !Number.isFinite(line.unitPrice)
    ) {
      missing++;
      continue;
    }
    if (line.unitPrice < 0 || line.quantity <= 0) {
      missing++;
      continue;
    }
    subtotal += Math.round(line.unitPrice * line.quantity);
  }
  const tax = Math.floor(subtotal * 0.1);
  return { subtotal, tax, total: subtotal + tax, missing };
}
