// 都道府県（北→南の標準順）
export const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
] as const;

export type Prefecture = (typeof PREFECTURES)[number];

// 「県別不明」の表示ラベル（住所から判定できない案件用）
export const UNKNOWN_PREFECTURE = "未分類";

const PREFECTURE_ORDER = new Map<string, number>(
  PREFECTURES.map((p, i) => [p, i]),
);

/**
 * 住所文字列の先頭付近から都道府県を判定する。
 * - 全角/半角スペースや郵便番号が先頭にあっても許容
 * - 判定できない場合は null を返す
 */
export function detectPrefecture(
  address: string | null | undefined,
): Prefecture | null {
  if (!address) return null;
  const normalized = address.trim();
  if (!normalized) return null;

  // 郵便番号（〒123-4567 / 123-4567 / 1234567）や先頭空白を除去
  const stripped = normalized
    .replace(/^[\s　]+/, "")
    .replace(/^〒?\s*\d{3}-?\d{4}\s*/, "")
    .trim();

  for (const pref of PREFECTURES) {
    if (stripped.startsWith(pref)) return pref;
  }
  // 先頭一致しない場合でも、文字列中の早い位置に都道府県名があれば採用
  let best: { pref: Prefecture; index: number } | null = null;
  for (const pref of PREFECTURES) {
    const idx = stripped.indexOf(pref);
    if (idx >= 0 && idx <= 8) {
      if (!best || idx < best.index) best = { pref, index: idx };
    }
  }
  return best?.pref ?? null;
}

/** 都道府県ラベル（null は未分類） */
export function prefectureLabel(
  address: string | null | undefined,
): string {
  return detectPrefecture(address) ?? UNKNOWN_PREFECTURE;
}

/**
 * 案件の県別分類ラベルを決定する。
 * - 独立項目の prefecture を最優先
 * - 未設定の場合は住所から推定
 * - どちらも不明なら未分類
 */
export function resolveCasePrefecture(
  c: { prefecture?: string | null; address?: string | null },
): string {
  const explicit = c.prefecture?.trim();
  if (explicit) return explicit;
  return detectPrefecture(c.address) ?? UNKNOWN_PREFECTURE;
}

/** 都道府県ラベルの並び順インデックス（未分類は最後） */
export function prefectureSortIndex(label: string): number {
  const idx = PREFECTURE_ORDER.get(label);
  return idx == null ? PREFECTURES.length : idx;
}
