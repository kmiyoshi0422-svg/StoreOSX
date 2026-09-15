import { afterEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
type Role = AuthenticatedUser["role"];

function createContext(role: Role, options: Partial<AuthenticatedUser> = {}): TrpcContext {
  const now = new Date();
  const id = options.id ?? 994001;
  return {
    user: {
      id,
      openId: `field-memo-${role}-${id}`,
      email: `${role}-${id}@field-memo.example.com`,
      name: `現場メモ ${role}`,
      loginMethod: "manus",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      ...options,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const ownerCaller = appRouter.createCaller(createContext("owner", { id: 1, name: "現場メモ管理者" }));
const createdCaseIds: number[] = [];

async function createFixture() {
  const created = await ownerCaller.cases.create({
    requestNumber: `TEST-FIELD-MEMO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    brand: "その他",
    storeName: "現場メモテスト店",
    prefecture: "福岡県",
    workType: "修理",
    costBearer: "店舗",
    requestDate: new Date(),
  });
  createdCaseIds.push(created.id);
  return created.id;
}

afterEach(async () => {
  while (createdCaseIds.length > 0) {
    await ownerCaller.cases.delete({ id: createdCaseIds.pop()! });
  }
}, 30000);

describe("案件全体の現場メモ", () => {
  it("追加・時系列一覧・本人編集・本人削除ができる", async () => {
    const caseId = await createFixture();
    const first = await ownerCaller.fieldMemos.create({ caseId, category: "状況", body: "漏水跡を確認しました。" });
    const second = await ownerCaller.fieldMemos.create({ caseId, category: "連絡", body: "店舗責任者へ説明済みです。" });

    const list = await ownerCaller.fieldMemos.listByCase({ caseId });
    expect(list).toHaveLength(2);
    expect(list.map((memo) => memo.id)).toEqual([second.id, first.id]);
    expect(list[0]).toMatchObject({ authorUserId: 1, authorName: "現場メモ管理者", authorRole: "owner" });

    await expect(ownerCaller.fieldMemos.update({
      id: first.id,
      category: "確認事項",
      body: "漏水跡と天井材の浮きを確認しました。",
    })).resolves.toEqual({ success: true });

    const updated = await ownerCaller.fieldMemos.listByCase({ caseId });
    expect(updated.find((memo) => memo.id === first.id)).toMatchObject({
      category: "確認事項",
      body: "漏水跡と天井材の浮きを確認しました。",
    });

    await expect(ownerCaller.fieldMemos.delete({ id: first.id })).resolves.toEqual({ success: true });
    await expect(ownerCaller.fieldMemos.listByCase({ caseId })).resolves.toHaveLength(1);
  }, 30000);

  it("他人のメモは最高管理者でも編集・削除できない", async () => {
    const caseId = await createFixture();
    const userCaller = appRouter.createCaller(createContext("user", { id: 994002, name: "記入社員" }));
    const created = await userCaller.fieldMemos.create({ caseId, category: "注意", body: "通電中のため注意してください。" });

    await expect(ownerCaller.fieldMemos.update({ id: created.id, category: "状況", body: "上書き" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(ownerCaller.fieldMemos.delete({ id: created.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  }, 30000);

  it("許可エリアpartnerは追加でき、許可エリア外partnerは拒否される", async () => {
    const caseId = await createFixture();
    const allowed = appRouter.createCaller(createContext("partner", {
      id: 994003,
      name: "許可協力業者",
      areaAccessMode: "selected",
      allowedPrefectures: JSON.stringify(["福岡県"]),
    }));
    const denied = appRouter.createCaller(createContext("partner", {
      id: 994004,
      areaAccessMode: "selected",
      allowedPrefectures: JSON.stringify(["山口県"]),
    }));

    await expect(allowed.fieldMemos.create({ caseId, category: "追加対応", body: "追加部材を手配します。" }))
      .resolves.toMatchObject({ id: expect.any(Number) });
    await expect(denied.fieldMemos.listByCase({ caseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(denied.fieldMemos.create({ caseId, category: "状況", body: "閲覧不可" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  }, 30000);

  it("役員は閲覧のみ、顧客は一覧・追加とも拒否される", async () => {
    const caseId = await createFixture();
    await ownerCaller.fieldMemos.create({ caseId, category: "状況", body: "現場確認済みです。" });
    const executive = appRouter.createCaller(createContext("executive", { id: 994005 }));
    const customer = appRouter.createCaller(createContext("customer", { id: 994006 }));

    await expect(executive.fieldMemos.listByCase({ caseId })).resolves.toHaveLength(1);
    await expect(executive.fieldMemos.create({ caseId, category: "状況", body: "役員入力" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(customer.fieldMemos.listByCase({ caseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(customer.fieldMemos.create({ caseId, category: "状況", body: "顧客入力" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  }, 30000);

  it("500文字を超える現場メモを拒否する", async () => {
    const caseId = await createFixture();
    await expect(ownerCaller.fieldMemos.create({ caseId, category: "状況", body: "あ".repeat(501) }))
      .rejects.toBeTruthy();
  }, 30000);
});
