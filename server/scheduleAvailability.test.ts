import { describe, expect, it } from "vitest";
import { buildScheduleAvailability, monthDateRange } from "../shared/scheduleAvailability";

describe("schedule availability", () => {
  it("月初・月末を正しく返す", () => {
    expect(monthDateRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("同一予定日の全案件数と選択業者の件数・案件を集計する", () => {
    const result = buildScheduleAvailability({
      month: "2026-10",
      partnerId: 5,
      cases: [
        { id: 1, requestNumber: "REQ-1", storeName: "店舗A", status: "施工待ち", partnerId: 5, contractorName: "業者A", constructionDate: "2026-10-20" },
        { id: 2, requestNumber: "REQ-2", storeName: "店舗B", status: "施工中", partnerId: 8, contractorName: "業者B", constructionDate: "2026-10-20" },
        { id: 3, requestNumber: "REQ-3", storeName: "店舗C", status: "完了", partnerId: 5, constructionDate: "2026-10-20" },
      ],
      routes: [],
    });
    const day = result.days.find((item) => item.date === "2026-10-20");
    expect(day).toMatchObject({ totalCount: 2, partnerCount: 1 });
    expect(day?.partnerCases[0]).toMatchObject({ caseId: 1, storeName: "店舗A" });
  });

  it("案件施工日がなければ工事ルート予定を補完し、編集対象は重複判定から除外する", () => {
    const result = buildScheduleAvailability({
      month: "2026-11",
      partnerId: 5,
      excludeCaseIds: [10],
      cases: [
        { id: 10, requestNumber: "REQ-10", storeName: "編集対象", status: "施工待ち", partnerId: 5 },
        { id: 11, requestNumber: "REQ-11", storeName: "既存予定", status: "施工待ち", partnerId: 5 },
      ],
      routes: [
        { caseId: 10, taskType: "construction", scheduledDate: "2026-11-05", partnerId: 5 },
        { caseId: 11, taskType: "construction", scheduledDate: "2026-11-05", partnerId: 5 },
      ],
    });
    const day = result.days.find((item) => item.date === "2026-11-05");
    expect(day).toMatchObject({ totalCount: 1, partnerCount: 1 });
    expect(day?.partnerCases.map((item) => item.caseId)).toEqual([11]);
  });
});
