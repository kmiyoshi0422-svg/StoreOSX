// 経費集計（立替者別）の純粋関数。サーバーとテストで共有する。

export const EXPENSE_CATEGORIES = [
  "材料費",
  "外注費",
  "交通費",
  "消耗品",
  "車両費",
  "宿泊費",
  "接待交際費",
  "その他",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** 集計対象の最小限の経費レコード */
export type ExpenseLike = {
  amount?: number | null;
  category?: string | null;
  scope?: string | null; // "案件" | "全体"
  uploadedBy?: number | null;
};

export type UserExpenseAggregate = {
  userId: number | null;
  userName: string;
  total: number;
  count: number;
  caseTotal: number;
  generalTotal: number;
  byCategory: Record<string, number>;
};

export type ExpenseAggregateResult = {
  byUser: UserExpenseAggregate[];
  grandTotal: number;
  count: number;
  categories: string[];
};

function emptyByCategory(): Record<string, number> {
  return Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0]));
}

/**
 * 経費を立替者(uploadedBy)別に集計する。
 * @param rows 集計対象の経費レコード
 * @param userNames userId -> 表示名 のマップ
 */
export function aggregateExpensesByUser(
  rows: ExpenseLike[],
  userNames: Map<number, string>,
): ExpenseAggregateResult {
  const map = new Map<number | null, UserExpenseAggregate>();
  let grandTotal = 0;

  for (const e of rows) {
    const uid = e.uploadedBy ?? null;
    if (!map.has(uid)) {
      map.set(uid, {
        userId: uid,
        userName: uid != null ? userNames.get(uid) ?? `ID:${uid}` : "不明",
        total: 0,
        count: 0,
        caseTotal: 0,
        generalTotal: 0,
        byCategory: emptyByCategory(),
      });
    }
    const a = map.get(uid)!;
    const amt = e.amount ?? 0;
    a.total += amt;
    a.count += 1;
    if (e.scope === "全体") a.generalTotal += amt;
    else a.caseTotal += amt;
    const cat = (e.category as string) ?? "その他";
    a.byCategory[cat] = (a.byCategory[cat] ?? 0) + amt;
    grandTotal += amt;
  }

  const byUser = Array.from(map.values()).sort((x, y) => y.total - x.total);
  return {
    byUser,
    grandTotal,
    count: rows.length,
    categories: [...EXPENSE_CATEGORIES],
  };
}

/**
 * 期間フィルタ用。basisMs(expenseDate優先、無ければcreatedAt)が範囲内かを判定。
 * 日付が無いレコードは、範囲指定が無い場合のみ含める。
 */
export function isWithinRange(
  basisMs: number | null,
  fromMs?: number,
  toMs?: number,
): boolean {
  if (basisMs == null) return fromMs == null && toMs == null;
  if (fromMs != null && basisMs < fromMs) return false;
  if (toMs != null && basisMs > toMs) return false;
  return true;
}
