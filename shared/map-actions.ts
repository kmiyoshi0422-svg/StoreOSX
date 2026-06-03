/**
 * 案件マップの吹き出し（InfoWindow）で使う、現場向けクイックアクションの
 * リンク生成ロジック。DOM に依存しない純粋関数として切り出し、vitest で検証する。
 */

/** 電話番号文字列を tel: スキームに使える形へ正規化（数字と + のみ残す） */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^0-9+]/g, "");
}

/** tel: リンクを生成。正規化後に有効な番号が無ければ null。 */
export function buildTelHref(raw: string | null | undefined): string | null {
  const normalized = normalizePhone(raw);
  // 少なくとも数字が3桁以上ないと電話番号として扱わない
  const digitCount = normalized.replace(/\+/g, "").length;
  if (digitCount < 3) return null;
  return `tel:${normalized}`;
}

/**
 * Google マップの「経路案内」リンクを生成。
 * 住所があれば住所を、無ければ緯度経度を目的地に使う。
 */
export function buildMapDirectionsHref(params: {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  const address = (params.address ?? "").trim();
  let destination: string;
  if (address) {
    destination = encodeURIComponent(address);
  } else if (
    typeof params.lat === "number" &&
    typeof params.lng === "number" &&
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lng)
  ) {
    destination = `${params.lat},${params.lng}`;
  } else {
    destination = "";
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}
