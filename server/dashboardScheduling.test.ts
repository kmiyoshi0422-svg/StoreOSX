import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getCaseById: vi.fn(),
  getPartnerById: vi.fn(),
  listPartners: vi.fn(),
  listSchedulesByCase: vi.fn(),
  updateCase: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

import { appRouter } from "./routers";

type Role = NonNullable<TrpcContext["user"]>["role"];

function createContext(role: Role): TrpcContext {
  const now = new Date("2026-09-12T12:00:00+09:00");
  return {
    user: {
      id: role === "partner" ? 90 : 10,
      openId: `schedule-${role}`,
      email: `${role}@example.com`,
      name: role === "user" ? "社員" : role,
      loginMethod: "manus",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("dashboard.scheduleCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getCaseById.mockResolvedValue({ id: 101, storeName: "テスト店舗" });
    dbMocks.getPartnerById.mockResolvedValue({
      id: 5,
      name: "施工業者A",
      category: "電気",
      isActive: true,
      pic: "担当者",
      picPhone: "090-0000-0000",
      phone: "03-0000-0000",
    });
    dbMocks.listSchedulesByCase.mockResolvedValue([]);
    dbMocks.updateCase.mockResolvedValue(undefined);
    dbMocks.createSchedule.mockResolvedValue({ id: 77 });
    dbMocks.updateSchedule.mockResolvedValue(undefined);
    dbMocks.listPartners.mockResolvedValue([]);
  });

  it("社員は施工予定日と業者を保存し、施工工程を新規作成できる", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    const result = await caller.dashboard.scheduleCase({
      caseId: 101,
      constructionDate: "2026-10-20",
      partnerId: 5,
    });

    expect(result).toMatchObject({
      success: true,
      caseId: 101,
      partner: { id: 5, name: "施工業者A" },
    });
    expect(dbMocks.updateCase).toHaveBeenCalledWith(101, expect.objectContaining({
      constructionDate: new Date("2026-10-20T12:00:00+09:00"),
      partnerId: 5,
      contractorName: "施工業者A",
      contractorPic: "担当者",
      contractorPhone: "090-0000-0000",
    }));
    expect(dbMocks.createSchedule).toHaveBeenCalledWith(expect.objectContaining({
      caseId: 101,
      title: "施工",
      startDate: "2026-10-20",
      endDate: "2026-10-20",
      createdBy: 10,
    }));
  });

  it("既存の施工工程があれば日付を更新して重複作成しない", async () => {
    dbMocks.listSchedulesByCase.mockResolvedValue([{ id: 33, title: "施工" }]);
    const caller = appRouter.createCaller(createContext("admin"));

    await caller.dashboard.scheduleCase({
      caseId: 101,
      constructionDate: "2026-11-05",
      partnerId: 5,
    });

    expect(dbMocks.updateSchedule).toHaveBeenCalledWith(33, expect.objectContaining({
      startDate: "2026-11-05",
      endDate: "2026-11-05",
      status: "予定",
    }));
    expect(dbMocks.createSchedule).not.toHaveBeenCalled();
  });

  it("協力業者は施工予定を保存できない", async () => {
    const caller = appRouter.createCaller(createContext("partner"));

    await expect(caller.dashboard.scheduleCase({
      caseId: 101,
      constructionDate: "2026-10-20",
      partnerId: 5,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.updateCase).not.toHaveBeenCalled();
  });
});

describe("dashboard.schedulingOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.listPartners.mockResolvedValue([
      { id: 1, name: "有効業者", category: "電気", area: "福岡", isActive: true },
      { id: 2, name: "停止業者", category: "内装", area: null, isActive: false },
      { id: 3, name: "テスト電気業者", category: "電気", area: null, isActive: true },
    ]);
  });

  it("社員には有効な実業者だけを返し、停止・テスト業者は除外する", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.dashboard.schedulingOptions()).resolves.toEqual([
      { id: 1, name: "有効業者", category: "電気", area: "福岡" },
    ]);
  });

  it("協力業者には業者選択肢を返さない", async () => {
    const caller = appRouter.createCaller(createContext("partner"));
    await expect(caller.dashboard.schedulingOptions()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
