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

// 地方（エリア）— 北→南の標準順
export const REGIONS = [
  "北海道",
  "東北",
  "関東",
  "中部",
  "近畿",
  "中国",
  "四国",
  "九州・沖縄",
] as const;

export type Region = (typeof REGIONS)[number];

// 「地方不明」の表示ラベル（都道府県が判定できない案件用）
export const UNKNOWN_REGION = "未分類";

// 都道府県 → 地方
const PREFECTURE_TO_REGION: Record<string, Region> = {
  北海道: "北海道",
  青森県: "東北",
  岩手県: "東北",
  宮城県: "東北",
  秋田県: "東北",
  山形県: "東北",
  福島県: "東北",
  茨城県: "関東",
  栃木県: "関東",
  群馬県: "関東",
  埼玉県: "関東",
  千葉県: "関東",
  東京都: "関東",
  神奈川県: "関東",
  新潟県: "中部",
  富山県: "中部",
  石川県: "中部",
  福井県: "中部",
  山梨県: "中部",
  長野県: "中部",
  岐阜県: "中部",
  静岡県: "中部",
  愛知県: "中部",
  三重県: "近畿",
  滋賀県: "近畿",
  京都府: "近畿",
  大阪府: "近畿",
  兵庫県: "近畿",
  奈良県: "近畿",
  和歌山県: "近畿",
  鳥取県: "中国",
  島根県: "中国",
  岡山県: "中国",
  広島県: "中国",
  山口県: "中国",
  徳島県: "四国",
  香川県: "四国",
  愛媛県: "四国",
  高知県: "四国",
  福岡県: "九州・沖縄",
  佐賀県: "九州・沖縄",
  長崎県: "九州・沖縄",
  熊本県: "九州・沖縄",
  大分県: "九州・沖縄",
  宮崎県: "九州・沖縄",
  鹿児島県: "九州・沖縄",
  沖縄県: "九州・沖縄",
};

const REGION_ORDER = new Map<string, number>(REGIONS.map((r, i) => [r, i]));

/** 都道府県ラベルから地方（エリア）ラベルを返す。不明は未分類 */
export function regionOfPrefecture(prefectureLabel: string): string {
  return PREFECTURE_TO_REGION[prefectureLabel] ?? UNKNOWN_REGION;
}

/** 地方ラベルの並び順インデックス（未分類は最後） */
export function regionSortIndex(label: string): number {
  const idx = REGION_ORDER.get(label);
  return idx == null ? REGIONS.length : idx;
}
