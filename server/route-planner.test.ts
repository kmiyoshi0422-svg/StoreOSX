import { describe, it, expect } from "vitest";
import {
  deriveNextTask,
  distributeToTeams,
  haversineKm,
  nearestNeighborOrder,
  buildSchedule,
  type PlannerCase,
  type PlannerTask,
} from "../shared/route-planner";

const today = new Date("2026-06-01T00:00:00Z");

function mkCase(p: Partial<PlannerCase>): PlannerCase {
  return {
    id: 1,
    requestNumber: "TEST-1",
    storeName: "店舗",
    address: "東京都",
    latitude: null,
    longitude: null,
    urgency: "B",
    progressStage: "未対応",
    status: "受付",
    requestDate: new Date("2026-05-25T00:00:00Z"),
    surveyDate: null,
    constructionDate: null,
    ...p,
  };
}

describe("deriveNextTask", () => {
  it("未対応 → 現調タスクを生成し緊急度Sが最高スコア", () => {
    const t = deriveNextTask(mkCase({ urgency: "S", progressStage: "未対応" }), today);
    expect(t).not.toBeNull();
    expect(t!.taskType).toBe("survey");
    expect(t!.priorityScore).toBeGreaterThan(1000);
  });

  it("見積提出済 → 訪問不要なのでnull", () => {
    const t = deriveNextTask(mkCase({ progressStage: "見積提出済" }), today);
    expect(t).toBeNull();
  });

  it("承認済 → 工事タスク", () => {
    const t = deriveNextTask(
      mkCase({ progressStage: "承認済", surveyDate: new Date("2026-05-20") }),
      today
    );
    expect(t).not.toBeNull();
    expect(t!.taskType).toBe("construction");
  });

  it("完了/クローズはnull", () => {
    expect(deriveNextTask(mkCase({ status: "完了" }), today)).toBeNull();
    expect(deriveNextTask(mkCase({ status: "クローズ" }), today)).toBeNull();
  });

  it("滞留日数が長いほどスコアが高い", () => {
    const fresh = deriveNextTask(
      mkCase({ id: 1, requestDate: new Date("2026-05-30") }),
      today
    );
    const stale = deriveNextTask(
      mkCase({ id: 2, requestDate: new Date("2026-04-01") }),
      today
    );
    expect(stale!.priorityScore).toBeGreaterThan(fresh!.priorityScore);
  });
});

describe("distributeToTeams", () => {
  it("優先度順に交互配分される", () => {
    const tasks: PlannerTask[] = [
      { caseId: 1, requestNumber: "1", storeName: "S1", address: null, latitude: null, longitude: null, taskType: "survey", urgency: "S", progressStage: "未対応", staleDays: 0, priorityScore: 1100, reason: "" },
      { caseId: 2, requestNumber: "2", storeName: "S2", address: null, latitude: null, longitude: null, taskType: "survey", urgency: "A", progressStage: "未対応", staleDays: 0, priorityScore: 600, reason: "" },
      { caseId: 3, requestNumber: "3", storeName: "S3", address: null, latitude: null, longitude: null, taskType: "survey", urgency: "B", progressStage: "未対応", staleDays: 0, priorityScore: 200, reason: "" },
      { caseId: 4, requestNumber: "4", storeName: "S4", address: null, latitude: null, longitude: null, taskType: "survey", urgency: "C", progressStage: "未対応", staleDays: 0, priorityScore: 100, reason: "" },
    ];
    const { teamA, teamB } = distributeToTeams(tasks);
    expect(teamA.map((t) => t.caseId)).toEqual([1, 3]);
    expect(teamB.map((t) => t.caseId)).toEqual([2, 4]);
  });

  it("件数差は1件以内", () => {
    const tasks: PlannerTask[] = Array.from({ length: 7 }, (_, i) => ({
      caseId: i,
      requestNumber: `${i}`,
      storeName: `S${i}`,
      address: null,
      latitude: null,
      longitude: null,
      taskType: "survey" as const,
      urgency: "B" as const,
      progressStage: "未対応" as const,
      staleDays: 0,
      priorityScore: 100 - i,
      reason: "",
    }));
    const { teamA, teamB } = distributeToTeams(tasks);
    expect(Math.abs(teamA.length - teamB.length)).toBeLessThanOrEqual(1);
  });
});

describe("haversineKm + nearestNeighborOrder", () => {
  it("東京駅と新宿駅の距離は約6km", () => {
    const tokyo = { lat: 35.6812, lng: 139.7671 };
    const shinjuku = { lat: 35.6896, lng: 139.7006 };
    const d = haversineKm(tokyo, shinjuku);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(8);
  });

  it("近接順に並び替えされる", () => {
    const t = (id: number, lat: number, lng: number): PlannerTask => ({
      caseId: id, requestNumber: `${id}`, storeName: `S${id}`, address: null,
      latitude: lat, longitude: lng, taskType: "survey", urgency: "B", progressStage: "未対応",
      staleDays: 0, priorityScore: 100, reason: "",
    });
    // 1→3→2 が距離的に近い順
    const tasks = [t(1, 35.0, 139.0), t(2, 35.5, 139.5), t(3, 35.1, 139.1)];
    const ordered = nearestNeighborOrder(tasks);
    expect(ordered.map((x) => x.caseId)).toEqual([1, 3, 2]);
  });

  it("緯度経度なし案件は末尾", () => {
    const t = (id: number, lat: number | null, lng: number | null): PlannerTask => ({
      caseId: id, requestNumber: `${id}`, storeName: `S${id}`, address: null,
      latitude: lat, longitude: lng, taskType: "survey", urgency: "B", progressStage: "未対応",
      staleDays: 0, priorityScore: 100, reason: "",
    });
    const ordered = nearestNeighborOrder([t(1, 35.0, 139.0), t(2, null, null), t(3, 35.1, 139.1)]);
    expect(ordered[ordered.length - 1].caseId).toBe(2);
  });
});

describe("buildSchedule", () => {
  it("全体プランがチーム別に組まれ土日を回避", () => {
    const cases: PlannerCase[] = [
      { id: 1, requestNumber: "A", storeName: "S1", address: "x", latitude: 35.0, longitude: 139.0, urgency: "S", progressStage: "未対応", status: "受付", requestDate: new Date("2026-05-25"), surveyDate: null, constructionDate: null },
      { id: 2, requestNumber: "B", storeName: "S2", address: "x", latitude: 35.5, longitude: 139.5, urgency: "A", progressStage: "承認済", status: "施工待ち", requestDate: new Date("2026-05-20"), surveyDate: new Date("2026-05-22"), constructionDate: null },
      { id: 3, requestNumber: "C", storeName: "S3", address: "x", latitude: 35.1, longitude: 139.1, urgency: "B", progressStage: "見積提出済", status: "見積中", requestDate: new Date("2026-05-15"), surveyDate: null, constructionDate: null },
    ];
    const schedule = buildSchedule(cases, today);
    // 見積提出済はスケジュールから除外（提案されない）
    const all = [...schedule.teamA, ...schedule.teamB];
    expect(all.find((t) => t.caseId === 3)).toBeUndefined();
    expect(all).toHaveLength(2);
    // 全ての日付が土日でないこと
    for (const t of all) {
      const d = new Date(t.scheduledDate);
      expect(d.getDay()).not.toBe(0);
      expect(d.getDay()).not.toBe(6);
    }
  });
});
