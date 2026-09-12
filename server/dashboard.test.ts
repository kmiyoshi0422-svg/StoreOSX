import { describe, expect, it } from "vitest";
import { buildDashboardOverview, isLeakageRelated, selectPreferredConstructionDate, type DashboardCaseInput } from "../shared/dashboard";

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

  it("未完了案件を3か月以上・1か月以上3か月未満・漏電関係に分ける", () => {
    const result = buildDashboardOverview([
      {
        id: 10,
        requestNumber: "REQ-010",
        storeName: "店舗D",
        status: "施工待ち",
        urgency: "B",
        requestDate: new Date("2026-06-12T12:00:00+09:00"),
        constructionDate: new Date("2026-09-16T10:00:00+09:00"),
      },
      {
        id: 11,
        requestNumber: "REQ-011",
        storeName: "店舗E",
        status: "見積中",
        urgency: "C",
        requestDate: new Date("2026-06-13T12:00:00+09:00"),
      },
      {
        id: 12,
        requestNumber: "REQ-012",
        storeName: "店舗F",
        status: "受付",
        urgency: "A",
        requestDate: new Date("2026-08-12T12:00:00+09:00"),
        requestContent: "厨房のブレーカーが落ちるため確認希望",
      },
      {
        id: 13,
        requestNumber: "REQ-013",
        storeName: "店舗G",
        status: "受付",
        urgency: "B",
        requestDate: new Date("2026-08-13T12:00:00+09:00"),
        categorySmall: "漏電",
      },
      {
        id: 14,
        requestNumber: "REQ-014",
        storeName: "店舗H",
        status: "完了",
        urgency: "B",
        requestDate: new Date("2026-05-01T12:00:00+09:00"),
        requestContent: "漏電調査",
      },
    ], { includeFinancials: false, now: new Date("2026-09-12T15:00:00+09:00") });

    expect(result.attentionCases.threeMonthsOrMore).toHaveLength(1);
    expect(result.attentionCases.threeMonthsOrMore[0]).toMatchObject({ id: 10, daysElapsed: 92 });
    expect(result.attentionCases.threeMonthsOrMore[0].constructionDate?.getDate()).toBe(16);
    expect(result.attentionCases.threeMonthsOrMore[0].constructionWeekStart?.getDate()).toBe(14);
    expect(result.attentionCases.threeMonthsOrMore[0].constructionWeekEnd?.getDate()).toBe(20);
    expect(result.attentionCases.oneToThreeMonths.map((item) => item.id)).toEqual([11, 12]);
    expect(result.attentionCases.leakageRelated.map((item) => item.id)).toEqual([12, 13]);
  });

  it("1か月以上でも施工予定日が未設定なら週情報をnullで返す", () => {
    const result = buildDashboardOverview([
      {
        id: 20,
        requestNumber: "REQ-020",
        storeName: "店舗I",
        status: "見積中",
        urgency: "B",
        requestDate: new Date("2026-07-20T12:00:00+09:00"),
      },
    ], { includeFinancials: false, now: new Date("2026-09-12T15:00:00+09:00") });

    expect(result.attentionCases.oneToThreeMonths[0]).toMatchObject({
      id: 20,
      constructionDate: null,
      constructionWeekStart: null,
      constructionWeekEnd: null,
    });
  });
});

describe("isLeakageRelated", () => {
  it.each([
    [{ requestContent: "漏電の疑いがあります" }],
    [{ requestContent: "ブレーカーが頻繁に落ちます" }],
    [{ notes: "絶縁抵抗を確認予定" }],
    [{ categorySmall: "ヒューズ交換" }],
  ])("漏電関連キーワードを検出する", (fields) => {
    expect(isLeakageRelated({
      id: 1,
      requestNumber: "REQ-LEAK",
      storeName: "店舗",
      status: "受付",
      urgency: "A",
      ...fields,
    })).toBe(true);
  });

  it("一般的な設備不具合は漏電関係に含めない", () => {
    expect(isLeakageRelated({
      id: 2,
      requestNumber: "REQ-NORMAL",
      storeName: "店舗",
      status: "受付",
      urgency: "B",
      requestContent: "水栓から水漏れしています",
    })).toBe(false);
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
