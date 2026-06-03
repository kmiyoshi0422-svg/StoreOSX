/**
 * 案件収支の計算ロジック（売上・原価・粗利）
 *
 * 定義:
 * - 売上(sales/revenue)   = プレナスへ提出した見積金額(plenusQuoteAmount)
 *                            未入力の場合は協力業者見積額(estimatedCost)からの想定 (÷ 0.75)
 * - 原価(cost)            = 協力業者見積額(estimatedCost) + 経費合計(expensesTotal)
 * - 粗利(grossProfit)     = 売上 - 原価
 * - 粗利率(grossMargin)   = 粗利 / 売上 (売上が0なら0)
 *
 * 協力業者見積額からプレナス提出額を想定する際の係数。
 * 協力業者額 = プレナス額 × 0.75 という想定の逆算（プレナス額 = 協力業者額 ÷ 0.75）。
 */
export const PLENUS_QUOTE_RATIO = 0.75;

/**
 * 売上（プレナス提出見積額）を算出する。
 * plenusQuoteAmount があればそれを採用。
 * 無ければ協力業者見積額(estimatedCost)から想定（÷0.75、四捨五入）。
 * どちらも無ければ 0。
 */
export function calcSales(
  plenusQuoteAmount: number | null | undefined,
  estimatedCost: number | null | undefined
): number {
  if (plenusQuoteAmount != null && plenusQuoteAmount > 0) {
    return plenusQuoteAmount;
  }
  const vendor = estimatedCost ?? 0;
  if (vendor > 0) {
    return Math.round(vendor / PLENUS_QUOTE_RATIO);
  }
  return 0;
}

/**
 * 原価（協力業者見積額 + 経費合計）を算出する。
 */
export function calcCost(
  estimatedCost: number | null | undefined,
  expensesTotal: number | null | undefined
): number {
  return (estimatedCost ?? 0) + (expensesTotal ?? 0);
}

export interface CaseProfit {
  sales: number;
  cost: number;
  grossProfit: number;
  /** 粗利率（小数。例: 0.25 = 25%）*/
  grossMargin: number;
  /** 売上がプレナス提出額の実値ではなく、協力業者額からの想定値か */
  salesIsEstimated: boolean;
}

/**
 * 案件1件の収支（売上・原価・粗利・粗利率）をまとめて算出する。
 */
export function calcCaseProfit(args: {
  plenusQuoteAmount: number | null | undefined;
  estimatedCost: number | null | undefined;
  expensesTotal: number | null | undefined;
}): CaseProfit {
  const sales = calcSales(args.plenusQuoteAmount, args.estimatedCost);
  const cost = calcCost(args.estimatedCost, args.expensesTotal);
  const grossProfit = sales - cost;
  const grossMargin = sales > 0 ? grossProfit / sales : 0;
  const salesIsEstimated =
    (args.plenusQuoteAmount == null || args.plenusQuoteAmount <= 0) && sales > 0;
  return { sales, cost, grossProfit, grossMargin, salesIsEstimated };
}
