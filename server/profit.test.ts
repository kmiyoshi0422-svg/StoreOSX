import { describe, it, expect } from "vitest";
import { calcSales, calcCost, calcCaseProfit, PLENUS_QUOTE_RATIO } from "@shared/profit";

describe("v25: calcSales（売上＝プレナス提出見積額、フォールバック÷0.75）", () => {
  it("plenusQuoteAmount があればそれを売上として採用する", () => {
    expect(calcSales(100000, 60000)).toBe(100000);
    expect(calcSales(100000, null)).toBe(100000);
  });

  it("plenusQuoteAmount が未入力なら協力業者見積額÷0.75（四捨五入）で想定する", () => {
    // 75000 / 0.75 = 100000
    expect(calcSales(null, 75000)).toBe(100000);
    // 60000 / 0.75 = 80000
    expect(calcSales(undefined, 60000)).toBe(80000);
    // 端数: 10000 / 0.75 = 13333.33 -> 13333
    expect(calcSales(null, 10000)).toBe(13333);
  });

  it("どちらも無い/0以下なら0", () => {
    expect(calcSales(null, null)).toBe(0);
    expect(calcSales(0, 0)).toBe(0);
    expect(calcSales(0, null)).toBe(0);
  });

  it("PLENUS_QUOTE_RATIO は 0.75", () => {
    expect(PLENUS_QUOTE_RATIO).toBe(0.75);
  });
});

describe("v25: calcCost（原価＝協力業者見積額＋経費合計）", () => {
  it("協力業者見積額と経費を合算する", () => {
    expect(calcCost(60000, 5000)).toBe(65000);
  });

  it("null は0として扱う", () => {
    expect(calcCost(null, null)).toBe(0);
    expect(calcCost(60000, null)).toBe(60000);
    expect(calcCost(null, 5000)).toBe(5000);
  });
});

describe("v25: calcCaseProfit（売上・原価・粗利・粗利率）", () => {
  it("プレナス額あり：売上=プレナス額、原価=協力業者+経費、粗利=差", () => {
    const p = calcCaseProfit({
      plenusQuoteAmount: 100000,
      estimatedCost: 60000,
      expensesTotal: 5000,
    });
    expect(p.sales).toBe(100000);
    expect(p.cost).toBe(65000);
    expect(p.grossProfit).toBe(35000);
    expect(p.grossMargin).toBeCloseTo(0.35, 5);
    expect(p.salesIsEstimated).toBe(false);
  });

  it("プレナス額なし：協力業者額からの想定売上、salesIsEstimated=true", () => {
    const p = calcCaseProfit({
      plenusQuoteAmount: null,
      estimatedCost: 75000,
      expensesTotal: 0,
    });
    // 売上 = 75000 / 0.75 = 100000、原価 = 75000、粗利 = 25000
    expect(p.sales).toBe(100000);
    expect(p.cost).toBe(75000);
    expect(p.grossProfit).toBe(25000);
    expect(p.salesIsEstimated).toBe(true);
  });

  it("売上0なら粗利率は0、salesIsEstimatedはfalse", () => {
    const p = calcCaseProfit({
      plenusQuoteAmount: null,
      estimatedCost: null,
      expensesTotal: 0,
    });
    expect(p.sales).toBe(0);
    expect(p.cost).toBe(0);
    expect(p.grossProfit).toBe(0);
    expect(p.grossMargin).toBe(0);
    expect(p.salesIsEstimated).toBe(false);
  });

  it("経費だけで原価が膨らみ赤字になるケース", () => {
    const p = calcCaseProfit({
      plenusQuoteAmount: 50000,
      estimatedCost: 40000,
      expensesTotal: 20000,
    });
    // 売上50000, 原価60000, 粗利-10000
    expect(p.grossProfit).toBe(-10000);
    expect(p.grossMargin).toBeCloseTo(-0.2, 5);
  });
});
