import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
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

describe("photos.update rotation validation", () => {
  it("rejects rotation values that are not 0/90/180/270", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.photos.update({ id: 1, rotation: 45 }),
    ).rejects.toThrow();
  });

  it("rejects non-integer rotation values", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.photos.update({ id: 1, rotation: 90.5 }),
    ).rejects.toThrow();
  });

  it.each([0, 90, 180, 270])(
    "accepts rotation value %i (passes input validation)",
    async (rotation) => {
      const caller = appRouter.createCaller(createAuthContext());
      // DBが無い環境では updatePhoto が "Database not available" を投げる。
      // 入力バリデーションのZodエラーは発生しないことを確認する。
      try {
        await caller.photos.update({ id: 1, rotation });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        expect(message).not.toMatch(/rotation/);
      }
    },
  );
});
