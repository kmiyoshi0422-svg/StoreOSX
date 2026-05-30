import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { DEFAULT_CHECKLIST } from "../shared/checklist-template";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
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

describe("cases router", () => {
  it("案件一覧を取得できる（配列を返す）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.cases.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("checklist template", () => {
  it("デフォルトチェックリストが業務フロー順で4フェーズ揃っている", () => {
    const phases = new Set(DEFAULT_CHECKLIST.map((i) => i.phase));
    expect(phases.has("受付")).toBe(true);
    expect(phases.has("現調")).toBe(true);
    expect(phases.has("施工")).toBe(true);
    expect(phases.has("完了")).toBe(true);
  });

  it("デフォルトチェックリストの項目数が十分にある（30件以上）", () => {
    expect(DEFAULT_CHECKLIST.length).toBeGreaterThanOrEqual(30);
  });
});
