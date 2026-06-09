import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

describe("signatures router", () => {
  it("getByCase は配列を返す", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.signatures.getByCase({ caseId: 999999 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("未署名の案件×報告書種別では null を返す", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.signatures.get({
      caseId: 999999,
      reportType: "survey",
    });
    expect(result).toBeNull();
  });

  it("不正な reportType は入力バリデーションで拒否される", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      // @ts-expect-error invalid enum value for test
      caller.signatures.get({ caseId: 1, reportType: "invalid" }),
    ).rejects.toThrow();
  });

  it("save は reportType として survey/completion のみ受け付ける", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.signatures.save({
        caseId: 1,
        // @ts-expect-error invalid enum value for test
        reportType: "other",
        imageBase64: "data:image/png;base64,AAAA",
      }),
    ).rejects.toThrow();
  });
});
