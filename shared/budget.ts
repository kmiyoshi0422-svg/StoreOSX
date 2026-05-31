/**
 * 予算計算ロジック
 * 予算 = 見積金額 × 75%
 * 予実差分・予算消化率の判定基準として使用する
 */
export const BUDGET_RATIO = 0.75;

/**
 * 見積金額から予算（見積×75%）を算出する
 * 端数は切り捨て
 */
export function calcBudget(estimatedCost: number | null | undefined): number {
  if (!estimatedCost || estimatedCost <= 0) return 0;
  return Math.floor(estimatedCost * BUDGET_RATIO);
}

/**
 * 予算消化率（実績 / 予算）を返す。予算が0なら null
 */
export function budgetUsageRate(
  actualCost: number | null | undefined,
  estimatedCost: number | null | undefined
): number | null {
  const budget = calcBudget(estimatedCost);
  if (budget === 0) return null;
  return (actualCost ?? 0) / budget;
}
