import { describe, expect, it } from "vitest";
import {
  calculateEstimate,
  type EstimateLine,
} from "../shared/estimateAssistant";
import {
  missingEstimateFields,
  resolveEstimateCandidates,
} from "../shared/estimateReview";

const line = (
  name: string,
  overrides: Partial<EstimateLine> = {}
): EstimateLine => ({
  name,
  specification: "",
  quantity: 1,
  unit: "式",
  unitPrice: 1200,
  source: "TEST候補",
  note: "",
  ...overrides,
});

describe("見積候補の一括レビュー", () => {
  const candidates = [
    { id: 1, line: line("鍵交換") },
    { id: 2, line: line("建具調整") },
    { id: 3, line: line("電気点検") },
  ];

  it("選択した候補だけ採用し、未選択候補は残して順序も維持する", () => {
    const selected = resolveEstimateCandidates(candidates, [1, 3], "adopt");
    expect(selected.adopted.map(item => item.name)).toEqual([
      "鍵交換",
      "電気点検",
    ]);
    expect(selected.remaining.map(item => item.id)).toEqual([2]);
    expect(candidates.map(item => item.id)).toEqual([1, 2, 3]);
    const final = resolveEstimateCandidates(selected.remaining, [2], "adopt");
    expect(final.adopted[0].name).toBe("建具調整");
    expect(final.remaining).toHaveLength(0);
  });

  it("除外は採用済みの別明細に影響せず、未選択はレビューへ残す", () => {
    const existing = [line("手入力")];
    const result = resolveEstimateCandidates(candidates, [2, 3], "exclude");
    expect(result.adopted).toEqual([]);
    expect(result.remaining.map(item => item.id)).toEqual([1]);
    expect(existing.map(item => item.name)).toEqual(["手入力"]);
    expect(
      resolveEstimateCandidates(candidates, [1, 2, 3], "exclude").remaining
    ).toEqual([]);
    expect(resolveEstimateCandidates(candidates, [], "adopt")).toMatchObject({
      remaining: candidates,
      adopted: [],
    });
  });
});

describe("見積明細の未入力警告", () => {
  it("数量・単位・単価の空欄と不正値を個別に警告して総額から除く", () => {
    const items = [
      line("数量不明", { quantity: null }),
      line("単位不明", { unit: " " }),
      line("単価不明", { unitPrice: null }),
      line("数量ゼロ", { quantity: 0 }),
      line("負の単価", { unitPrice: -1 }),
      line("確定", { quantity: 2, unitPrice: 1000 }),
    ];
    expect(items.map(missingEstimateFields)).toEqual([
      ["数量"],
      ["単位"],
      ["単価"],
      ["数量"],
      ["単価"],
      [],
    ]);
    expect(calculateEstimate(items)).toEqual({
      subtotal: 2000,
      tax: 200,
      total: 2200,
      missing: 5,
    });
  });

  it("0円の有効な単価は空欄ではなく、数量・単位は必要", () => {
    expect(missingEstimateFields(line("無償", { unitPrice: 0 }))).toEqual([]);
    expect(
      missingEstimateFields(
        line("未確定", { quantity: null, unit: "", unitPrice: null })
      )
    ).toEqual(["数量", "単位", "単価"]);
  });
});
