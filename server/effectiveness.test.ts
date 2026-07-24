import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("reports.effectiveness 効果測定ダッシュボード", () => {
  it("デフォルト12ヶ月の効果測定データを返す", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness();
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("processingSpeed");
    expect(result).toHaveProperty("costOptimization");
    expect(result).toHaveProperty("workload");
    expect(result).toHaveProperty("digitalization");
    expect(result).toHaveProperty("partnerPerformance");
  });

  it("summaryに必要なKPIフィールドが含まれる", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness();
    const { summary } = result;
    expect(summary).toHaveProperty("totalCases");
    expect(summary).toHaveProperty("completedCases");
    expect(summary).toHaveProperty("avgProcessingDays");
    expect(summary).toHaveProperty("totalRevenue");
    expect(summary).toHaveProperty("totalCost");
    expect(summary).toHaveProperty("totalProfit");
    expect(summary).toHaveProperty("profitMargin");
    expect(summary).toHaveProperty("partnerCount");
    expect(summary).toHaveProperty("activePartners");
    expect(summary).toHaveProperty("digitalRate");
    expect(summary).toHaveProperty("balanceScore");
    expect(summary).toHaveProperty("estimatedAnnualSavings");
    expect(typeof summary.totalCases).toBe("number");
    expect(typeof summary.balanceScore).toBe("number");
  });

  it("processingSpeedの各月にkey/totalDays/count/avgDaysがある", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness({ months: 6 });
    expect(result.processingSpeed.length).toBe(6);
    for (const row of result.processingSpeed) {
      expect(row).toHaveProperty("key");
      expect(row).toHaveProperty("totalDays");
      expect(row).toHaveProperty("count");
      expect(row).toHaveProperty("avgDays");
      expect(typeof row.avgDays).toBe("number");
    }
  });

  it("costOptimizationの各月にaccuracyRateがある", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness({ months: 3 });
    expect(result.costOptimization.length).toBe(3);
    for (const row of result.costOptimization) {
      expect(row).toHaveProperty("accuracyRate");
      expect(typeof row.accuracyRate).toBe("number");
    }
  });

  it("balanceScoreは0〜100の範囲", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness();
    expect(result.summary.balanceScore).toBeGreaterThanOrEqual(0);
    expect(result.summary.balanceScore).toBeLessThanOrEqual(100);
  });

  it("partnerPerformanceはcaseCount降順でソートされている", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness();
    for (let i = 1; i < result.partnerPerformance.length; i++) {
      expect(result.partnerPerformance[i - 1].caseCount).toBeGreaterThanOrEqual(result.partnerPerformance[i].caseCount);
    }
  });
});
