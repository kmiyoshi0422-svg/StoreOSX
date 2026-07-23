import { describe, it, expect, vi } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  listCrossPartnerSchedules: vi.fn().mockResolvedValue([
    {
      id: 1,
      caseId: 10,
      title: "内装工事",
      startDate: "2026-07-20",
      endDate: "2026-07-30",
      status: "進行中",
      color: "#3b82f6",
      progress: 50,
      memo: null,
      storeName: "テスト店舗",
      requestNumber: "REQ-001",
      brand: "ほっともっと",
      partnerId: 1,
      contractorName: "テスト業者",
      urgency: "B",
      progressStage: "施工中",
    },
  ]),
  listCrossPartnerRoutes: vi.fn().mockResolvedValue([
    {
      id: 1,
      caseId: 10,
      team: "A",
      taskType: "survey",
      scheduledDate: "2026-07-25",
      assigneeId: null,
      notes: null,
      storeName: "テスト店舗",
      requestNumber: "REQ-001",
      brand: "ほっともっと",
      partnerId: 1,
      contractorName: "テスト業者",
      urgency: "B",
    },
  ]),
  toggleDocumentLock: vi.fn().mockResolvedValue(undefined),
  updateSchedule: vi.fn().mockResolvedValue(undefined),
}));

describe("Cross Schedule API", () => {
  it("listCrossPartnerSchedules returns schedule items with case info", async () => {
    const { listCrossPartnerSchedules } = await import("./db");
    const result = await listCrossPartnerSchedules("2026-07-01", "2026-07-31");
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("storeName", "テスト店舗");
    expect(result[0]).toHaveProperty("partnerId", 1);
    expect(result[0]).toHaveProperty("startDate", "2026-07-20");
    expect(result[0]).toHaveProperty("endDate", "2026-07-30");
  });

  it("listCrossPartnerRoutes returns route items with case info", async () => {
    const { listCrossPartnerRoutes } = await import("./db");
    const result = await listCrossPartnerRoutes("2026-07-01", "2026-07-31");
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("taskType", "survey");
    expect(result[0]).toHaveProperty("scheduledDate", "2026-07-25");
  });
});

describe("Document Lock", () => {
  it("toggleDocumentLock updates lock state", async () => {
    const { toggleDocumentLock } = await import("./db");
    await toggleDocumentLock(1, 1);
    expect(toggleDocumentLock).toHaveBeenCalledWith(1, 1);
  });

  it("toggleDocumentLock can unlock", async () => {
    const { toggleDocumentLock } = await import("./db");
    await toggleDocumentLock(1, 0);
    expect(toggleDocumentLock).toHaveBeenCalledWith(1, 0);
  });
});

describe("Schedule Update (Drag & Drop)", () => {
  it("updateSchedule accepts new start and end dates", async () => {
    const { updateSchedule } = await import("./db");
    await updateSchedule(1, { startDate: "2026-07-22", endDate: "2026-08-01" });
    expect(updateSchedule).toHaveBeenCalledWith(1, { startDate: "2026-07-22", endDate: "2026-08-01" });
  });
});
