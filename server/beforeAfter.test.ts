import { describe, it, expect } from "vitest";
import {
  isBeforeType,
  isAfterType,
  buildBeforeAfterPairs,
  paginatePairs,
  type PairablePhoto,
} from "../shared/beforeAfter";

// テスト用の写真生成ヘルパ
function ph(
  id: number,
  photoType: string,
  orderNo: number,
  workItem: string | null = null,
): PairablePhoto {
  return { id, photoType, orderNo, workItem };
}

describe("isBeforeType / isAfterType", () => {
  it("ビフォー区分を正しく判定する", () => {
    expect(isBeforeType("現調")).toBe(true);
    expect(isBeforeType("施工前A")).toBe(true);
    expect(isBeforeType("施工前B")).toBe(true);
    expect(isBeforeType("施工後A")).toBe(false);
    expect(isBeforeType("設置状況")).toBe(false);
    expect(isBeforeType("その他")).toBe(false);
  });

  it("アフター区分を正しく判定する", () => {
    expect(isAfterType("施工後A")).toBe(true);
    expect(isAfterType("施工後B")).toBe(true);
    expect(isAfterType("設置状況")).toBe(true);
    expect(isAfterType("現調")).toBe(false);
    expect(isAfterType("施工前A")).toBe(false);
    expect(isAfterType("メーカー型番")).toBe(false);
  });
});

describe("buildBeforeAfterPairs", () => {
  it("同一工事項目のビフォー/アフターをペア化する", () => {
    const pairs = buildBeforeAfterPairs([
      ph(1, "現調", 0, "玄関ドア"),
      ph(2, "施工後A", 1, "玄関ドア"),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].workItem).toBe("玄関ドア");
    expect(pairs[0].before?.id).toBe(1);
    expect(pairs[0].after?.id).toBe(2);
  });

  it("複数の工事項目をそれぞれペア化する（出現順）", () => {
    const pairs = buildBeforeAfterPairs([
      ph(1, "現調", 0, "玄関ドア"),
      ph(2, "現調", 1, "窓サッシ"),
      ph(3, "施工後A", 2, "玄関ドア"),
      ph(4, "施工後A", 3, "窓サッシ"),
    ]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].workItem).toBe("玄関ドア");
    expect(pairs[0].before?.id).toBe(1);
    expect(pairs[0].after?.id).toBe(3);
    expect(pairs[1].workItem).toBe("窓サッシ");
    expect(pairs[1].before?.id).toBe(2);
    expect(pairs[1].after?.id).toBe(4);
  });

  it("同一工事項目で複数枚ある場合は orderNo 昇順で突き合わせる", () => {
    const pairs = buildBeforeAfterPairs([
      ph(2, "現調", 5, "外壁"),
      ph(1, "現調", 1, "外壁"),
      ph(4, "施工後A", 6, "外壁"),
      ph(3, "施工後A", 2, "外壁"),
    ]);
    expect(pairs).toHaveLength(2);
    // orderNo 昇順: before [1,2], after [3,4]
    expect(pairs[0].before?.id).toBe(1);
    expect(pairs[0].after?.id).toBe(3);
    expect(pairs[1].before?.id).toBe(2);
    expect(pairs[1].after?.id).toBe(4);
  });

  it("片側しか存在しない場合は他方を null にする", () => {
    const pairs = buildBeforeAfterPairs([
      ph(1, "現調", 0, "玄関ドア"),
      ph(2, "施工後A", 1, "窓サッシ"),
    ]);
    expect(pairs).toHaveLength(2);
    const door = pairs.find((p) => p.workItem === "玄関ドア")!;
    expect(door.before?.id).toBe(1);
    expect(door.after).toBeNull();
    const window = pairs.find((p) => p.workItem === "窓サッシ")!;
    expect(window.before).toBeNull();
    expect(window.after?.id).toBe(2);
  });

  it("工事項目が未設定の写真は出現順で突き合わせる", () => {
    const pairs = buildBeforeAfterPairs([
      ph(1, "現調", 0),
      ph(2, "現調", 1),
      ph(3, "施工後A", 2),
      ph(4, "施工後A", 3),
    ]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].workItem).toBe("");
    expect(pairs[0].before?.id).toBe(1);
    expect(pairs[0].after?.id).toBe(3);
    expect(pairs[1].before?.id).toBe(2);
    expect(pairs[1].after?.id).toBe(4);
  });

  it("ビフォー/アフター以外の区分は無視する", () => {
    const pairs = buildBeforeAfterPairs([
      ph(1, "現調", 0, "玄関ドア"),
      ph(2, "メーカー型番", 1, "玄関ドア"),
      ph(3, "その他", 2, "玄関ドア"),
      ph(4, "施工後A", 3, "玄関ドア"),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].before?.id).toBe(1);
    expect(pairs[0].after?.id).toBe(4);
  });

  it("工事項目ありのペアを未設定ペアより先に並べる", () => {
    const pairs = buildBeforeAfterPairs([
      ph(1, "現調", 0), // 未設定
      ph(2, "施工後A", 1), // 未設定
      ph(3, "現調", 2, "玄関ドア"),
      ph(4, "施工後A", 3, "玄関ドア"),
    ]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].workItem).toBe("玄関ドア");
    expect(pairs[1].workItem).toBe("");
  });

  it("空配列では空のペアを返す", () => {
    expect(buildBeforeAfterPairs([])).toEqual([]);
  });

  it("両側とも欠けるペアは生成しない（未設定の余りが片側のみ）", () => {
    const pairs = buildBeforeAfterPairs([
      ph(1, "現調", 0),
      ph(2, "現調", 1),
      ph(3, "施工後A", 2),
    ]);
    // before 2枚, after 1枚 → 2ペア（2枚目の after は null）
    expect(pairs).toHaveLength(2);
    expect(pairs[1].before?.id).toBe(2);
    expect(pairs[1].after).toBeNull();
  });
});

describe("paginatePairs", () => {
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      workItem: `w${i}`,
      before: ph(i, "現調", i),
      after: ph(i + 100, "施工後A", i),
    }));

  it("pairsPerPage 組ごとに分割する", () => {
    const pages = paginatePairs(mk(5), 2);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toHaveLength(2);
    expect(pages[1]).toHaveLength(2);
    expect(pages[2]).toHaveLength(1);
  });

  it("ちょうど割り切れる場合", () => {
    const pages = paginatePairs(mk(6), 3);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(3);
    expect(pages[1]).toHaveLength(3);
  });

  it("空入力では空配列を返す", () => {
    expect(paginatePairs([], 2)).toEqual([]);
  });
});
