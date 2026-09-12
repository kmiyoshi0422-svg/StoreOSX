import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getCaseById: vi.fn(),
  getPartnerById: vi.fn(),
  listPartners: vi.fn(),
  listSchedulesByCase: vi.fn(),
  listRouteAssignmentsForCase: vi.fn(),
  updateCase: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  updateRouteAssignment: vi.fn(),
  deleteRouteAssignment: vi.fn(),
  createPartnerAssignmentNotification: vi.fn(),
  listPartnerAssignmentNotificationsByUser: vi.fn(),
  markPartnerAssignmentNotificationRead: vi.fn(),
  markAllPartnerAssignmentNotificationsRead: vi.fn(),
  createStatusLog: vi.fn(),
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
    dbMocks.getCaseById.mockResolvedValue({ id: 101, requestNumber: "REQ-101", storeName: "テスト店舗", partnerId: null });
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
    dbMocks.listRouteAssignmentsForCase.mockResolvedValue([]);
    dbMocks.updateCase.mockResolvedValue(undefined);
    dbMocks.createSchedule.mockResolvedValue({ id: 77 });
    dbMocks.updateSchedule.mockResolvedValue(undefined);
    dbMocks.deleteSchedule.mockResolvedValue(undefined);
    dbMocks.updateRouteAssignment.mockResolvedValue(undefined);
    dbMocks.deleteRouteAssignment.mockResolvedValue(undefined);
    dbMocks.createPartnerAssignmentNotification.mockResolvedValue(1);
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
    expect(dbMocks.createPartnerAssignmentNotification).toHaveBeenCalledWith(expect.objectContaining({
      partnerId: 5,
      caseId: 101,
      notificationType: "assigned",
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

  it("施工業者を変更すると旧業者へ解除、新業者へ割当を通知する", async () => {
    dbMocks.getCaseById.mockResolvedValue({ id: 101, requestNumber: "REQ-101", storeName: "変更対象店", partnerId: 4 });
    const caller = appRouter.createCaller(createContext("admin"));
    await caller.dashboard.scheduleCase({ caseId: 101, constructionDate: "2026-11-06", partnerId: 5 });

    expect(dbMocks.createPartnerAssignmentNotification).toHaveBeenCalledWith(expect.objectContaining({
      partnerId: 4,
      notificationType: "cancelled",
    }));
    expect(dbMocks.createPartnerAssignmentNotification).toHaveBeenCalledWith(expect.objectContaining({
      partnerId: 5,
      notificationType: "assigned",
    }));
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

describe("dashboard.clearScheduleCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getCaseById.mockResolvedValue({
      id: 101,
      requestNumber: "REQ-101",
      storeName: "解除対象店",
      partnerId: 5,
    });
    dbMocks.listSchedulesByCase.mockResolvedValue([{ id: 33, title: "施工" }, { id: 34, title: "現調" }]);
    dbMocks.listRouteAssignmentsForCase.mockResolvedValue([{ id: 44, taskType: "construction" }, { id: 45, taskType: "survey" }]);
    dbMocks.updateCase.mockResolvedValue(undefined);
    dbMocks.deleteSchedule.mockResolvedValue(undefined);
    dbMocks.deleteRouteAssignment.mockResolvedValue(undefined);
    dbMocks.createPartnerAssignmentNotification.mockResolvedValue(1);
  });

  it("社員は施工予定・業者を解除し、施工工程だけ削除できる", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.dashboard.clearScheduleCase({ caseId: 101 })).resolves.toEqual({ success: true, caseId: 101 });

    expect(dbMocks.updateCase).toHaveBeenCalledWith(101, {
      constructionDate: null,
      partnerId: null,
      contractorName: null,
      contractorPic: null,
      contractorPhone: null,
    });
    expect(dbMocks.deleteSchedule).toHaveBeenCalledWith(33);
    expect(dbMocks.deleteSchedule).not.toHaveBeenCalledWith(34);
    expect(dbMocks.deleteRouteAssignment).toHaveBeenCalledWith(44);
    expect(dbMocks.deleteRouteAssignment).not.toHaveBeenCalledWith(45);
    expect(dbMocks.createPartnerAssignmentNotification).toHaveBeenCalledWith(expect.objectContaining({
      partnerId: 5,
      notificationType: "cancelled",
    }));
  });

  it("協力業者は解除できない", async () => {
    const caller = appRouter.createCaller(createContext("partner"));
    await expect(caller.dashboard.clearScheduleCase({ caseId: 101 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.updateCase).not.toHaveBeenCalled();
  });
});

describe("dashboard.bulkScheduleCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getCaseById.mockImplementation(async (id: number) => ({
      id,
      requestNumber: `REQ-${id}`,
      storeName: `店舗${id}`,
      partnerId: null,
    }));
    dbMocks.getPartnerById.mockResolvedValue({
      id: 5,
      name: "施工業者A",
      category: "電気",
      isActive: true,
      pic: null,
      picPhone: null,
      phone: null,
    });
    dbMocks.listSchedulesByCase.mockResolvedValue([]);
    dbMocks.listRouteAssignmentsForCase.mockResolvedValue([]);
    dbMocks.updateCase.mockResolvedValue(undefined);
    dbMocks.createSchedule.mockResolvedValue({ id: 77 });
    dbMocks.createPartnerAssignmentNotification.mockResolvedValue(1);
  });

  it("重複を除いた複数案件へ同じ予定日と業者を設定する", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.dashboard.bulkScheduleCases({
      caseIds: [101, 102, 101],
      constructionDate: "2026-12-01",
      partnerId: 5,
    });
    expect(result).toMatchObject({ successCount: 2, failedCount: 0, succeeded: [101, 102] });
    expect(dbMocks.updateCase).toHaveBeenCalledTimes(2);
    expect(dbMocks.createPartnerAssignmentNotification).toHaveBeenCalledTimes(2);
  });

  it("協力業者は一括設定できない", async () => {
    const caller = appRouter.createCaller(createContext("partner"));
    await expect(caller.dashboard.bulkScheduleCases({
      caseIds: [101],
      constructionDate: "2026-12-01",
      partnerId: 5,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.updateCase).not.toHaveBeenCalled();
  });
});

describe("dashboard partner assignment notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.listPartnerAssignmentNotificationsByUser.mockResolvedValue([
      { id: 1, caseId: 101, title: "新しい担当案件", readAt: null },
      { id: 2, caseId: 102, title: "予定変更", readAt: new Date("2026-09-12T12:00:00+09:00") },
    ]);
    dbMocks.markPartnerAssignmentNotificationRead.mockResolvedValue(true);
    dbMocks.markAllPartnerAssignmentNotificationsRead.mockResolvedValue(1);
  });

  it("協力業者本人へ通知一覧と未読件数を返す", async () => {
    const caller = appRouter.createCaller(createContext("partner"));
    await expect(caller.dashboard.partnerNotifications()).resolves.toMatchObject({
      unreadCount: 1,
      items: [{ id: 1 }, { id: 2 }],
    });
    expect(dbMocks.listPartnerAssignmentNotificationsByUser).toHaveBeenCalledWith(90, 30);
  });

  it("社員は協力業者向け通知を取得できない", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.dashboard.partnerNotifications()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("協力業者は個別・一括既読にできる", async () => {
    const caller = appRouter.createCaller(createContext("partner"));
    await expect(caller.dashboard.markPartnerNotificationRead({ id: 1 })).resolves.toEqual({ success: true });
    await expect(caller.dashboard.markAllPartnerNotificationsRead()).resolves.toEqual({ success: true, updated: 1 });
    expect(dbMocks.markPartnerAssignmentNotificationRead).toHaveBeenCalledWith(1, 90);
    expect(dbMocks.markAllPartnerAssignmentNotificationsRead).toHaveBeenCalledWith(90);
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

describe("dashboard lost and revive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getCaseById.mockResolvedValue({
      id: 101,
      requestNumber: "REQ-101",
      storeName: "失注対象店",
      status: "見積中",
      prefecture: "福岡県",
      partnerId: 5,
      constructionDate: new Date("2026-10-20T12:00:00+09:00"),
      preLostStatus: null,
    });
    dbMocks.updateCase.mockResolvedValue(undefined);
    dbMocks.createStatusLog.mockResolvedValue(1);
    dbMocks.createPartnerAssignmentNotification.mockResolvedValue(1);
  });

  it("社員は理由付きで失注にし、完了相当日時と直前状態を保存できる", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.dashboard.markCaseLost({
      caseId: 101,
      reason: "対応に不備",
      reasonDetail: "初動対応に時間を要した",
    })).resolves.toMatchObject({ success: true, caseId: 101, status: "失注" });

    expect(dbMocks.updateCase).toHaveBeenCalledWith(101, expect.objectContaining({
      status: "失注",
      completedAt: expect.any(Date),
      lostReason: "対応に不備",
      lostReasonDetail: "初動対応に時間を要した",
      lostAt: expect.any(Date),
      lostBy: 10,
      preLostStatus: "見積中",
    }));
    expect(dbMocks.createStatusLog).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: "見積中",
      toStatus: "失注",
    }));
    expect(dbMocks.createPartnerAssignmentNotification).toHaveBeenCalledWith(expect.objectContaining({
      partnerId: 5,
      notificationType: "cancelled",
    }));
  });

  it("その他を選んだ場合は補足理由を必須にする", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.dashboard.markCaseLost({
      caseId: 101,
      reason: "その他",
      reasonDetail: "",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.updateCase).not.toHaveBeenCalled();
  });

  it("失注案件を直前状態へ復活し、失注情報を解除できる", async () => {
    dbMocks.getCaseById.mockResolvedValue({
      id: 101,
      requestNumber: "REQ-101",
      storeName: "復活対象店",
      status: "失注",
      prefecture: "福岡県",
      partnerId: 5,
      constructionDate: new Date("2026-10-20T12:00:00+09:00"),
      preLostStatus: "施工待ち",
    });
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.dashboard.reviveLostCase({ caseId: 101 })).resolves.toMatchObject({
      success: true,
      status: "施工待ち",
    });
    expect(dbMocks.updateCase).toHaveBeenCalledWith(101, {
      status: "施工待ち",
      completedAt: null,
      lostReason: null,
      lostReasonDetail: null,
      lostAt: null,
      lostBy: null,
      preLostStatus: null,
    });
  });

  it("協力業者と顧客は失注・復活を操作できない", async () => {
    const partnerCaller = appRouter.createCaller(createContext("partner"));
    await expect(partnerCaller.dashboard.markCaseLost({ caseId: 101, reason: "高額なため" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const customerCaller = appRouter.createCaller(createContext("customer"));
    await expect(customerCaller.dashboard.reviveLostCase({ caseId: 101 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.updateCase).not.toHaveBeenCalled();
  });
});
