import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
    role: "owner",
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
  const caller = appRouter.createCaller(createAuthContext());
  let caseId = 0;

  beforeAll(async () => {
    const created = await caller.cases.create({
      requestNumber: `TEST-SIGNATURE-${Date.now()}`,
      brand: "その他",
      storeName: "署名テスト店",
      workType: "修理",
      costBearer: "店舗",
      requestDate: new Date(),
    });
    caseId = created.id;
  });

  afterAll(async () => {
    if (caseId) await caller.cases.delete({ id: caseId });
  });

  it("getByCase は配列を返す", async () => {
    const result = await caller.signatures.getByCase({ caseId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("担当者と先方の署名スロットを独立して取得できる", async () => {
    const staff = await caller.signatures.get({
      caseId,
      reportType: "survey",
      signerRole: "staff",
    });
    const customer = await caller.signatures.get({
      caseId,
      reportType: "survey",
      signerRole: "customer",
    });
    expect(staff === null || staff.signerRole === "staff").toBe(true);
    expect(customer === null || customer.signerRole === "customer").toBe(true);
  });

  it("不正な reportType は入力バリデーションで拒否される", async () => {
    await expect(
      // @ts-expect-error invalid enum value for test
      caller.signatures.get({ caseId: 1, reportType: "invalid" }),
    ).rejects.toThrow();
  });

  it("save は reportType として survey/completion のみ受け付ける", async () => {
    await expect(
      caller.signatures.save({
        caseId: 1,
        // @ts-expect-error invalid enum value for test
        reportType: "other",
        imageBase64: "data:image/png;base64,AAAA",
      }),
    ).rejects.toThrow();
  });

  it("不正な signerRole は入力バリデーションで拒否される", async () => {
    await expect(caller.signatures.get({
      caseId,
      reportType: "survey",
      // @ts-expect-error invalid enum value for test
      signerRole: "outside",
    })).rejects.toThrow();
  });
});
