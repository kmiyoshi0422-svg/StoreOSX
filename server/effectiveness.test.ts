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

describe("v-kpi: reports.effectiveness プレナスKPI基準", () => {
  it("kpis オブジェクトに5つのKPI指標が含まれる", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness({ months: 6 });
    expect(result.kpis).toBeDefined();
    expect(result.kpis.urgentResponse).toHaveProperty("total");
    expect(result.kpis.urgentResponse).toHaveProperty("met");
    expect(result.kpis.urgentResponse).toHaveProperty("rate");
    expect(result.kpis.estimateSubmission).toHaveProperty("rate");
    expect(result.kpis.constructionCompletion).toHaveProperty("rate");
    expect(result.kpis.reportSubmission).toHaveProperty("rate");
    expect(result.kpis.noRevisit).toHaveProperty("rate");
  });

  it("trends 配列が months 分の月別データを返す", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness({ months: 3 });
    expect(result.trends).toHaveLength(3);
    for (const t of result.trends) {
      expect(t).toHaveProperty("key");
      expect(t).toHaveProperty("urgentRate");
      expect(t).toHaveProperty("estimateRate");
      expect(t).toHaveProperty("constructionRate");
      expect(t).toHaveProperty("reportRate");
      expect(t).toHaveProperty("noRevisitRate");
    }
  });

  it("summary に金額関連フィールドが含まれない", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness({ months: 6 });
    const s = result.summary as any;
    expect(s.totalRevenue).toBeUndefined();
    expect(s.totalCost).toBeUndefined();
    expect(s.totalProfit).toBeUndefined();
    expect(s.profitMargin).toBeUndefined();
    expect(s.estimatedAnnualSavings).toBeUndefined();
  });

  it("rate は 0〜100 の範囲内", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness({ months: 12 });
    for (const kpi of Object.values(result.kpis)) {
      expect((kpi as any).rate).toBeGreaterThanOrEqual(0);
      expect((kpi as any).rate).toBeLessThanOrEqual(100);
    }
  });

  it("workload 配列が返る", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.reports.effectiveness({ months: 6 });
    expect(Array.isArray(result.workload)).toBe(true);
  });
});
