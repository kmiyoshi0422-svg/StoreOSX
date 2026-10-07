import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { getAllUsers } from "./db";
import type { TrpcContext } from "./_core/context";
import { canAccessPrefecture } from "../shared/accessPolicy";

type AppUser = NonNullable<TrpcContext["user"]>;
function context(role: AppUser["role"]): TrpcContext {
  return {
    user: { id: 1, openId: "assignee-test", name: "担当者権限テスト", email: "assignee-test@example.invalid",
      role, loginMethod: "manus", areaAccessMode: "all", allowedPrefectures: null,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("社内担当者割当", () => {
  it("社員以上だけが候補を取得でき、外部ロールはAPI側で拒否される", async () => {
    for (const role of ["owner", "admin", "executive", "user"] as const) {
      const candidates = await appRouter.createCaller(context(role)).users.assignable();
      expect(candidates.every((candidate) => ["owner", "admin", "executive", "user"].includes(candidate.role))).toBe(true);
    }
    for (const role of ["partner", "customer"] as const) {
      await expect(appRouter.createCaller(context(role)).users.assignable()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  }, 30000);

  it("社内担当者の割当・解除が可能で、不正IDやエリア外・外部ユーザーへの割当を拒否する", async () => {
    const owner = appRouter.createCaller(context("owner"));
    const users = await getAllUsers();
    const staff = users.find((candidate) => candidate.role === "owner" || candidate.role === "admin");
    const partner = users.find((candidate) => candidate.role === "partner");
    const limited = users.find((candidate) => candidate.role === "user" && candidate.areaAccessMode === "selected");
    expect(staff).toBeDefined();
    const prefecture = limited ? (["北海道", "沖縄県", "福岡県", "東京都"] as const).find((area) => !canAccessPrefecture(limited, area)) ?? "福岡県" : "福岡県";
    const created = await owner.cases.create({ requestNumber: `TEST-ASSIGNEE-${Date.now()}`, brand: "その他", storeName: "担当割当テスト店", prefecture });
    try {
      await expect(owner.cases.update({ id: created.id, data: { assigneeId: staff!.id } })).resolves.toMatchObject({ success: true });
      expect((await owner.cases.get({ id: created.id }))?.assigneeId).toBe(staff!.id);
      await expect(owner.cases.update({ id: created.id, data: { assigneeId: 2147483000 } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      if (partner) await expect(owner.cases.update({ id: created.id, data: { assigneeId: partner.id } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      if (limited && !canAccessPrefecture(limited, prefecture)) {
        await expect(owner.cases.update({ id: created.id, data: { assigneeId: limited.id } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      }
      for (const role of ["partner", "customer"] as const) {
        await expect(appRouter.createCaller(context(role)).cases.update({ id: created.id, data: { assigneeId: staff!.id } })).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      expect((await owner.cases.get({ id: created.id }))?.assigneeId).toBe(staff!.id);
      await expect(owner.cases.update({ id: created.id, data: { assigneeId: null } })).resolves.toMatchObject({ success: true });
      expect((await owner.cases.get({ id: created.id }))?.assigneeId).toBeNull();
    } finally {
      await owner.cases.delete({ id: created.id });
    }
  }, 30000);
});
