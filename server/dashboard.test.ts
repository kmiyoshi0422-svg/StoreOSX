import { describe, expect, it } from "vitest";
import { buildDashboardOverview, type DashboardCaseInput } from "../shared/dashboard";

const cases: DashboardCaseInput[] = [
  {
    id: 1,
    requestNumber: "REQ-001",
    storeName: "店舗A",
    status: "現調中",
    progressStage: "未対応",
    urgency: "S",
    surveyDate: new Date("2026-09-01"),
    revisitCount: 0,
    estimatedCost: 100_000,
    actualCost: 60_000,
  },
  {
    id: 2,
    requestNumber: "REQ-002",
    storeName: "店舗B",
    status: "完了",
    progressStage: "承認済",
    urgency: "B",
    surveyDate: new Date("2026-09-02"),
    revisitCount: 1,
    estimatedCost: 200_000,
    actualCost: 190_000,
  },
  {
    id: 3,
    requestNumber: "REQ-003",
    storeName: "店舗C",
    status: "受付",
    progressStage: "未対応",
    urgency: "A",
    estimatedCost: null,
    actualCost: null,
  },
];

describe("buildDashboardOverview", () => {
  it("案件KPI・ステータス・緊急度を実データから集計する", () => {
    const result = buildDashboardOverview(cases, { includeFinancials: false });

    expect(result.kpis).toMatchObject({
      total: 3,
      inProgress: 1,
      urgent: 2,
      completed: 1,
      noRevisitRate: 50,
      noRevisitCount: 1,
      surveyedCount: 2,
    });
    expect(result.statusBreakdown.find((row) => row.key === "完了")?.value).toBe(1);
    expect(result.urgencyBreakdown.find((row) => row.key === "S")?.value).toBe(1);
  });

  it("管理者向け財務情報は見積合計・75%予算・実績・差分を返す", () => {
    const result = buildDashboardOverview(cases, { includeFinancials: true });

    expect(result.financials).toEqual({
      totalEstimated: 300_000,
      totalBudget: 225_000,
      totalActual: 250_000,
      diff: 25_000,
    });
  });

  it("管理者以外には財務情報を返さない", () => {
    const result = buildDashboardOverview(cases, { includeFinancials: false });
    expect(result.financials).toBeNull();
  });
});
