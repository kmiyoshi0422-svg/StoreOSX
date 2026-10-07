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
      estimatedCost: 8800,
      plenusQuoteAmount: 12000,
      requesterPhone: "09000000000",
      notes: "社内限定記録",
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

  it("許可外案件の写真は閲覧可能だが、保存前に変更を拒否する", async () => {
    await expect(partner.photos.upload({ caseId: deniedCaseId, ...file })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storagePut).not.toHaveBeenCalled();
    expect((await partner.photos.listByCase({ caseId: deniedCaseId })).some(p => p.id === deniedPhotoId)).toBe(true);
    expect((await partner.photos.get({ id: deniedPhotoId })).id).toBe(deniedPhotoId);
    const rows = await partner.photos.listByCases({ caseIds: [allowedCaseId, deniedCaseId] });
    expect(rows.cases).toHaveLength(2);
    expect(rows.cases.every(row => row.estimatedCost == null && row.plenusQuoteAmount == null)).toBe(true);
  });

  it("写真更新・削除は許可外案件では拒否する", async () => {
    await expect(partner.photos.update({ id: deniedPhotoId, memo: "案件外変更" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.photos.delete({ id: deniedPhotoId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await owner.photos.get({ id: deniedPhotoId })).memo).not.toBe("案件外変更");
  });

  it("協力業者は全案件の概要のみを閲覧し、担当外の金額・社内情報を受け取らない", async () => {
    const all = await partner.cases.listSummary();
    const outside = all.find(item => item.id === deniedCaseId);
    expect(outside).toBeTruthy();
    expect(outside?.estimatedCost).toBeNull();
    expect(outside?.plenusQuoteAmount).toBeNull();
    const detail = await partner.cases.get({ id: deniedCaseId });
    expect(detail).toMatchObject({ id: deniedCaseId, estimatedCost: null, plenusQuoteAmount: null, notes: null, requesterPhone: null, partnerToken: null });
    const editable = await partner.cases.partnerEditableCaseIds();
    expect(editable).toContain(allowedCaseId);
    expect(editable).not.toContain(deniedCaseId);
    const checklist = await partner.checklist.listByCase({ caseId: deniedCaseId });
    expect(checklist.length).toBeGreaterThan(0);
    await expect(partner.checklist.toggle({ id: checklist[0].id, checked: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.checklist.updateMemo({ id: checklist[0].id, memo: "範囲外" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.cases.update({ id: deniedCaseId, data: { status: "現調中" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await owner.cases.get({ id: deniedCaseId }))?.status).toBe("受付");
  });

  it("顧客の閲覧範囲は拡張しない", async () => {
    const restrictedCustomer = appRouter.createCaller(context("customer", { areaAccessMode: "selected", allowedPrefectures: JSON.stringify(["福岡県"]) }));
    expect((await restrictedCustomer.cases.listSummary()).some(item => item.id === deniedCaseId)).toBe(false);
    await expect(restrictedCustomer.cases.get({ id: deniedCaseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("金額を含み得る経費・見積・資料には外部ロールから直接アクセスできない", async () => {
    await expect(partner.expenses.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.expenses.listByCase({ caseId: allowedCaseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.estimates.listByCase({ caseId: allowedCaseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.documents.list({ caseId: allowedCaseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.projectFolders.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.stores.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.storeMaster.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.storeEquipment.greaseTraps.list({ storeId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.appSettings.getAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.cases.listCompletedReports()).rejects.toMatchObject({ code: "FORBIDDEN" });
    const visibleUsers = await partner.users.list();
    expect(visibleUsers.length).toBeGreaterThan(0);
    expect(visibleUsers.every((user) => Object.keys(user).sort().join(",") === "email,id,name,role" && user.email === null)).toBe(true);
  });

  it("担当外案件の工程・報告書完了・ステータス履歴を直接変更できない", async () => {
    await expect(partner.schedules.listByCase({ caseId: deniedCaseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.statusLogs.listByCase({ caseId: deniedCaseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.schedules.create({ caseId: deniedCaseId, title: "担当外工程", startDate: "2026-10-08", endDate: "2026-10-08" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.cases.markReportComplete({ caseId: deniedCaseId, reportType: "survey" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.statusLogs.create({ caseId: deniedCaseId, toStatus: "完了" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.statusLogs.completeWithReport({ caseId: deniedCaseId, comment: "範囲外", photos: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.rainLeak.create({ caseId: deniedCaseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(partner.surveySkip.create({ caseId: deniedCaseId, reason: "その他" })).rejects.toMatchObject({ code: "FORBIDDEN" });
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
