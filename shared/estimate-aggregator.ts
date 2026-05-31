// 同一案件に複数の見積書がある場合に「案件の見積金額(estimatedCost)」として
// どの値を採用するかを決める純粋関数。
// ルール:
//   1. estimateDate が新しいものを優先
//   2. estimateDate が同じ or 無ければ createdAt が新しいものを優先
//   3. 該当がなければ null を返す
//   4. 合計金額が null/0 のレコードは候補から除外する

export type EstimateRow = {
  id: number;
  totalAmount: number | null | undefined;
  materialAmount?: number | null | undefined;
  laborAmount?: number | null | undefined;
  estimateDate?: Date | string | null | undefined;
  createdAt?: Date | string | null | undefined;
};

export type AggregatedEstimate = {
  totalAmount: number;
  materialAmount: number | null;
  laborAmount: number | null;
  sourceId: number;
};

function toTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * 候補の中から最新の見積を選び、案件側に転記する値を返す。
 * 候補が無ければ null を返す。
 */
export function pickLatestEstimate(
  estimates: EstimateRow[]
): AggregatedEstimate | null {
  const valid = estimates.filter(
    (e) =>
      e.totalAmount != null &&
      typeof e.totalAmount === "number" &&
      e.totalAmount > 0
  );
  if (valid.length === 0) return null;
  // estimateDate -> createdAt -> id の優先で降順ソート
  const sorted = [...valid].sort((a, b) => {
    const da = toTime(a.estimateDate);
    const db = toTime(b.estimateDate);
    if (da !== db) return db - da;
    const ca = toTime(a.createdAt);
    const cb = toTime(b.createdAt);
    if (ca !== cb) return cb - ca;
    return b.id - a.id;
  });
  const top = sorted[0];
  return {
    totalAmount: top.totalAmount as number,
    materialAmount: top.materialAmount ?? null,
    laborAmount: top.laborAmount ?? null,
    sourceId: top.id,
  };
}
