import { describe, it, expect } from "vitest";
import {
  stageToStatus,
  statusToStage,
  syncStatusFromStage,
  syncStageFromStatus,
  resolveStageStatus,
} from "../shared/stageStatus";

describe("stageToStatus", () => {
  it("各ステージに対応する最低ステータスを返す", () => {
    expect(stageToStatus("未対応")).toBe("受付");
    expect(stageToStatus("現調済")).toBe("見積中");
    expect(stageToStatus("見積提出済")).toBe("施工待ち");
    expect(stageToStatus("承認済")).toBe("施工待ち");
  });
});

describe("statusToStage", () => {
  it("各ステータスに対応するステージを返す", () => {
    expect(statusToStage("受付")).toBe("未対応");
    expect(statusToStage("現調中")).toBe("未対応");
    expect(statusToStage("見積中")).toBe("現調済");
    expect(statusToStage("施工待ち")).toBe("見積提出済");
    expect(statusToStage("施工中")).toBe("見積提出済");
    expect(statusToStage("完了")).toBe("承認済");
    expect(statusToStage("クローズ")).toBe("承認済");
  });
});

describe("syncStatusFromStage（前進専用）", () => {
  it("ステージが進めばステータスも前進する", () => {
    expect(syncStatusFromStage("現調済", "受付")).toBe("見積中");
    expect(syncStatusFromStage("見積提出済", "受付")).toBe("施工待ち");
  });
  it("既にステータスが先行していれば巻き戻さない", () => {
    expect(syncStatusFromStage("現調済", "施工中")).toBe("施工中");
    expect(syncStatusFromStage("未対応", "見積中")).toBe("見積中");
  });
});

describe("syncStageFromStatus（前進専用）", () => {
  it("ステータスが進めばステージも前進する", () => {
    expect(syncStageFromStatus("見積中", "未対応")).toBe("現調済");
    expect(syncStageFromStatus("完了", "未対応")).toBe("承認済");
  });
  it("既にステージが先行していれば巻き戻さない", () => {
    expect(syncStageFromStatus("現調中", "承認済")).toBe("承認済");
    expect(syncStageFromStatus("受付", "見積提出済")).toBe("見積提出済");
  });
});

describe("resolveStageStatus", () => {
  it("ステージのみ変更 → ステータスが追従", () => {
    const r = resolveStageStatus({
      currentStage: "未対応",
      currentStatus: "受付",
      nextStage: "見積提出済",
    });
    expect(r).toEqual({ progressStage: "見積提出済", status: "施工待ち" });
  });

  it("ステータスのみ変更 → ステージが追従", () => {
    const r = resolveStageStatus({
      currentStage: "未対応",
      currentStatus: "受付",
      nextStatus: "完了",
    });
    expect(r).toEqual({ progressStage: "承認済", status: "完了" });
  });

  it("両方明示指定 → そのまま尊重（連動しない）", () => {
    const r = resolveStageStatus({
      currentStage: "未対応",
      currentStatus: "受付",
      nextStage: "現調済",
      nextStatus: "クローズ",
    });
    expect(r).toEqual({ progressStage: "現調済", status: "クローズ" });
  });

  it("変更なし → 現状維持", () => {
    const r = resolveStageStatus({
      currentStage: "現調済",
      currentStatus: "見積中",
    });
    expect(r).toEqual({ progressStage: "現調済", status: "見積中" });
  });

  it("ステージのみ変更だが先行ステータスは巻き戻さない", () => {
    const r = resolveStageStatus({
      currentStage: "未対応",
      currentStatus: "施工中",
      nextStage: "現調済",
    });
    expect(r).toEqual({ progressStage: "現調済", status: "施工中" });
  });
});
