// 施工完了報告書のビフォーアフター比較ロジック（純粋関数）
// UIに依存しないため、ユニットテスト可能。

// 比較対象に必要な最小限のフィールドのみを要求する型
export type PairablePhoto = {
  id: number;
  photoType: string;
  workItem: string | null;
  orderNo: number;
};

// ビフォー（現調・施工前）と判定する区分
export const BEFORE_TYPES = ["現調", "施工前A", "施工前B"] as const;
// アフター（施工後・設置状況）と判定する区分
export const AFTER_TYPES = ["施工後A", "施工後B", "設置状況"] as const;

export function isBeforeType(t: string): boolean {
  return (BEFORE_TYPES as readonly string[]).includes(t);
}
export function isAfterType(t: string): boolean {
  return (AFTER_TYPES as readonly string[]).includes(t);
}

// 比較ペア: before / after のどちらかが欠けることがある（片側のみ）
export type BeforeAfterPair<T extends PairablePhoto = PairablePhoto> = {
  // ペアの見出しに使う工事項目（無ければ空文字）
  workItem: string;
  before: T | null;
  after: T | null;
};

// 工事項目キーの正規化（前後空白除去・小文字化はせず日本語想定でtrimのみ）
function normalizeKey(workItem: string | null): string {
  return (workItem ?? "").trim();
}

/**
 * ビフォーアフターのペアを生成する。
 *
 * ルール:
 * 1. 工事項目(workItem)が一致するビフォー/アフターを優先してペア化する。
 *    - 同一工事項目で複数枚ある場合は orderNo 昇順で1枚ずつ突き合わせる。
 * 2. 工事項目が空(未設定)の写真同士は、ビフォー群・アフター群それぞれを
 *    orderNo 昇順に並べ、出現順で突き合わせる。
 * 3. 片側しか存在しないものは、もう片方を null としてペアに含める
 *    （UI側で「該当なし」プレースホルダを表示する）。
 *
 * 返り値の順序:
 *   工事項目あり（最初の出現 orderNo 順） → 工事項目なし（出現順）
 */
export function buildBeforeAfterPairs<T extends PairablePhoto>(
  photos: T[],
): BeforeAfterPair<T>[] {
  const befores = photos.filter((p) => isBeforeType(p.photoType));
  const afters = photos.filter((p) => isAfterType(p.photoType));

  const byOrder = (a: T, b: T) => a.orderNo - b.orderNo;

  // 工事項目ありとなしに分割
  const keyedBefore = new Map<string, T[]>();
  const unkeyedBefore: T[] = [];
  for (const p of [...befores].sort(byOrder)) {
    const k = normalizeKey(p.workItem);
    if (k) {
      if (!keyedBefore.has(k)) keyedBefore.set(k, []);
      keyedBefore.get(k)!.push(p);
    } else {
      unkeyedBefore.push(p);
    }
  }

  const keyedAfter = new Map<string, T[]>();
  const unkeyedAfter: T[] = [];
  for (const p of [...afters].sort(byOrder)) {
    const k = normalizeKey(p.workItem);
    if (k) {
      if (!keyedAfter.has(k)) keyedAfter.set(k, []);
      keyedAfter.get(k)!.push(p);
    } else {
      unkeyedAfter.push(p);
    }
  }

  // 工事項目キーの並び順: ビフォー/アフター双方の最小orderNoで決定
  const allKeys = new Set<string>([
    ...Array.from(keyedBefore.keys()),
    ...Array.from(keyedAfter.keys()),
  ]);
  const keyOrder = Array.from(allKeys).sort((a, b) => {
    const minOrder = (arr?: T[]) =>
      arr && arr.length ? Math.min(...arr.map((p) => p.orderNo)) : Number.MAX_SAFE_INTEGER;
    const ao = Math.min(minOrder(keyedBefore.get(a)), minOrder(keyedAfter.get(a)));
    const bo = Math.min(minOrder(keyedBefore.get(b)), minOrder(keyedAfter.get(b)));
    return ao - bo;
  });

  const pairs: BeforeAfterPair<T>[] = [];

  // 1. 工事項目ありのペア化
  for (const key of keyOrder) {
    const bs = keyedBefore.get(key) ?? [];
    const as = keyedAfter.get(key) ?? [];
    const n = Math.max(bs.length, as.length);
    for (let i = 0; i < n; i++) {
      pairs.push({
        workItem: key,
        before: bs[i] ?? null,
        after: as[i] ?? null,
      });
    }
  }

  // 2. 工事項目なしのペア化（出現順で突き合わせ）
  const n = Math.max(unkeyedBefore.length, unkeyedAfter.length);
  for (let i = 0; i < n; i++) {
    const b = unkeyedBefore[i] ?? null;
    const a = unkeyedAfter[i] ?? null;
    if (!b && !a) continue;
    pairs.push({
      workItem: "",
      before: b,
      after: a,
    });
  }

  return pairs;
}

/**
 * ペア配列を1ページ pairsPerPage 組ずつに分割する。
 */
export function paginatePairs<T extends PairablePhoto>(
  pairs: BeforeAfterPair<T>[],
  pairsPerPage: number,
): BeforeAfterPair<T>[][] {
  const pages: BeforeAfterPair<T>[][] = [];
  for (let i = 0; i < pairs.length; i += pairsPerPage) {
    pages.push(pairs.slice(i, i + pairsPerPage));
  }
  return pages;
}
