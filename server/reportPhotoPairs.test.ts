import { describe, expect, it } from "vitest";
import { pairBeforeAfterPhotos } from "../shared/reportPhotoPairs";

describe("pairBeforeAfterPhotos", () => {
  it("同じ工事項目の施工前後を優先して対応付ける", () => {
    const pairs = pairBeforeAfterPhotos(
      [
        { id: 1, workItem: "客席天井" },
        { id: 2, workItem: "厨房壁" },
      ],
      [
        { id: 11, workItem: "厨房壁" },
        { id: 12, workItem: "客席天井" },
      ],
    );

    expect(pairs.map((pair) => [pair.before?.id, pair.after?.id])).toEqual([
      [1, 12],
      [2, 11],
    ]);
  });

  it("工事項目がない写真は登録順で対応付ける", () => {
    const pairs = pairBeforeAfterPhotos(
      [
        { id: 1, workItem: null },
        { id: 2, workItem: "" },
      ],
      [
        { id: 11, workItem: null },
        { id: 12, workItem: "" },
      ],
    );

    expect(pairs.map((pair) => [pair.before?.id, pair.after?.id])).toEqual([
      [1, 11],
      [2, 12],
    ]);
  });

  it("対応写真がない側はnullで保持し写真を捏造しない", () => {
    const pairs = pairBeforeAfterPhotos(
      [{ id: 1, workItem: "入口" }],
      [
        { id: 11, workItem: "入口" },
        { id: 12, workItem: "客席" },
      ],
    );

    expect(pairs).toEqual([
      {
        before: { id: 1, workItem: "入口" },
        after: { id: 11, workItem: "入口" },
        workItem: "入口",
      },
      {
        before: null,
        after: { id: 12, workItem: "客席" },
        workItem: "客席",
      },
    ]);
  });
});
