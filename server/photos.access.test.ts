import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { storagePut } from "./storage";

vi.mock("./storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./storage")>()),
  storagePut: vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` })),
}));

type User = NonNullable<TrpcContext["user"]>;
function context(role: User["role"], options: Partial<User> = {}): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: role === "owner" ? 1 : 990931,
      openId: `photos-access-${role}`,
      email: `${role}@photos-access.example.com`,
      name: role,
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

const owner = appRouter.createCaller(context("owner"));
const partner = appRouter.createCaller(context("partner", {
  areaAccessMode: "selected",
  allowedPrefectures: JSON.stringify(["福岡県"]),
}));
const customer = appRouter.createCaller(context("customer"));
const file = {
  fileName: "photo.jpg",
  fileBase64: "data:image/jpeg;base64,/9j/2Q==",
  mimeType: "image/jpeg",
  photoType: "現調" as const,
};

describe("写真APIの協力業者・顧客アクセス", () => {
  let allowedCaseId = 0;
  let deniedCaseId = 0;
  let allowedPhotoId = 0;
  let deniedPhotoId = 0;
  let partnerId = 0;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    allowedCaseId = (await owner.cases.create({
      requestNumber: `TEST-PHOTO-ACCESS-OK-${suffix}`,
      storeName: "写真権限テスト福岡店",
      prefecture: "福岡県",
      estimatedCost: 2100,
      plenusQuoteAmount: 3500,
    })).id;
    deniedCaseId = (await owner.cases.create({
      requestNumber: `TEST-PHOTO-ACCESS-NG-${suffix}`,
      storeName: "写真権限テスト山口店",
      prefecture: "山口県",
    })).id;
    partnerId = (await owner.partners.create({
      name: `写真権限テスト協力会社-${suffix}`,
    })).id;
    await owner.partners.update({ id: partnerId, data: { userId: 990932 } });
    await owner.cases.update({ id: allowedCaseId, data: { partnerId } });
    allowedPhotoId = (await owner.photos.upload({ caseId: allowedCaseId, ...file })).id;
    deniedPhotoId = (await owner.photos.upload({ caseId: deniedCaseId, ...file })).id;
  }, 30000);

  afterAll(async () => {
    if (allowedCaseId) await owner.cases.delete({ id: allowedCaseId });
    if (deniedCaseId) await owner.cases.delete({ id: deniedCaseId });
    if (partnerId) await owner.partners.delete({ id: partnerId });
  }, 30000);

  beforeEach(() => vi.mocked(storagePut).mockClear());

  it("許可エリアの協力業者は写真を追加・閲覧できる", async () => {
    const result = await partner.photos.upload({ caseId: allowedCaseId, ...file });
    expect(result.id).toEqual(expect.any(Number));
    expect((await partner.photos.listByCase({ caseId: allowedCaseId })).some((p) => p.id === result.id)).toBe(true);
    expect((await partner.photos.get({ id: result.id })).id).toBe(result.id);
  });

  it("エリア未指定の協力業者は担当案件だけに写真を追加できる", async () => {
    const assignedPartner = appRouter.createCaller(context("partner", { id: 990932 }));
    const result = await assignedPartner.photos.upload({ caseId: allowedCaseId, ...file });
    expect(result.id).toEqual(expect.any(Number));
    vi.mocked(storagePut).mockClear();
    await expect(assignedPartner.photos.upload({ caseId: deniedCaseId, ...file })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storagePut).not.toHaveBeenCalled();
  });

  it("許可外案件は保存前に拒否し、一覧・単件・一括取得でも漏らさない", async () => {
    await expect(partner.photos.upload({ caseId: deniedCaseId, ...file })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storagePut).not.toHaveBeenCalled();
    await expect(partner.photos.listByCase({ caseId: deniedCaseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.photos.get({ id: deniedPhotoId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.photos.listByCases({ caseIds: [allowedCaseId, deniedCaseId] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("写真更新・削除は許可外案件では拒否する", async () => {
    await expect(partner.photos.update({ id: deniedPhotoId, memo: "案件外変更" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.photos.delete({ id: deniedPhotoId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await owner.photos.get({ id: deniedPhotoId })).memo).not.toBe("案件外変更");
  });

  it("一括操作に許可外写真が混ざると全件非破壊で停止する", async () => {
    await expect(partner.photos.bulkUpdateType({ ids: [allowedPhotoId, deniedPhotoId], photoType: "施工後A" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await owner.photos.get({ id: allowedPhotoId })).photoType).toBe("現調");
    expect((await owner.photos.get({ id: deniedPhotoId })).photoType).toBe("現調");
  });

  it("協力業者への一括取得では社内金額を返さない", async () => {
    const result = await partner.photos.listByCases({ caseIds: [allowedCaseId] });
    expect(result.photos.length).toBeGreaterThan(0);
    expect(result.cases[0].estimatedCost).toBeNull();
    expect(result.cases[0].plenusQuoteAmount).toBeNull();
  });

  it("顧客は写真を変更できない", async () => {
    await expect(customer.photos.upload({ caseId: allowedCaseId, ...file })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(customer.photos.update({ id: allowedPhotoId, memo: "顧客変更" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(customer.photos.delete({ id: allowedPhotoId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(customer.photos.bulkUpdateType({ ids: [allowedPhotoId], photoType: "施工後A" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storagePut).not.toHaveBeenCalled();
  });
});
