import { describe, expect, it } from "vitest";
import { buildDashboardOverview, selectPreferredConstructionDate, type DashboardCaseInput } from "../shared/dashboard";

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

  it("依頼日から14日以上経過した未完了案件と施工予定週を返す", () => {
    const result = buildDashboardOverview([
      {
        id: 10,
        requestNumber: "REQ-010",
        storeName: "店舗D",
        status: "施工待ち",
        urgency: "B",
        requestDate: new Date("2026-08-25T12:00:00+09:00"),
        constructionDate: new Date("2026-09-16T10:00:00+09:00"),
      },
      {
        id: 11,
        requestNumber: "REQ-011",
        storeName: "店舗E",
        status: "完了",
        urgency: "C",
        requestDate: new Date("2026-08-01T12:00:00+09:00"),
      },
      {
        id: 12,
        requestNumber: "REQ-012",
        storeName: "店舗F",
        status: "受付",
        urgency: "A",
        requestDate: new Date("2026-09-01T12:00:00+09:00"),
      },
    ], { includeFinancials: false, now: new Date("2026-09-12T15:00:00+09:00") });

    expect(result.overdueRequestCases).toHaveLength(1);
    expect(result.overdueRequestCases[0]).toMatchObject({
      id: 10,
      daysElapsed: 18,
    });
    expect(result.overdueRequestCases[0].constructionDate?.getDate()).toBe(16);
    expect(result.overdueRequestCases[0].constructionWeekStart?.getDate()).toBe(14);
    expect(result.overdueRequestCases[0].constructionWeekEnd?.getDate()).toBe(20);
  });

  it("14日経過でも施工予定日が未設定なら週情報をnullで返す", () => {
    const result = buildDashboardOverview([
      {
        id: 20,
        requestNumber: "REQ-020",
        storeName: "店舗G",
        status: "見積中",
        urgency: "B",
        requestDate: new Date("2026-08-20T12:00:00+09:00"),
      },
    ], { includeFinancials: false, now: new Date("2026-09-12T15:00:00+09:00") });

    expect(result.overdueRequestCases[0]).toMatchObject({
      id: 20,
      constructionDate: null,
      constructionWeekStart: null,
      constructionWeekEnd: null,
    });
  });
});

describe("selectPreferredConstructionDate", () => {
  it("未来日がある場合は今日以降で最も近い工事予定日を選ぶ", () => {
    const selected = selectPreferredConstructionDate(
      ["2026-09-01", "2026-09-20", "2026-09-15"],
      new Date("2026-09-12T12:00:00+09:00"),
    );
    expect(selected?.getDate()).toBe(15);
  });

  it("未来日がない場合は最新の過去予定日を選ぶ", () => {
    const selected = selectPreferredConstructionDate(
      ["2026-09-01", "2026-09-10"],
      new Date("2026-09-12T12:00:00+09:00"),
    );
    expect(selected?.getDate()).toBe(10);
  });
});
