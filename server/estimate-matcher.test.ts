import { describe, expect, it } from "vitest";
import {
  normalizeKey,
  scoreCandidates,
  topMatches,
  pickBestMatch,
  type MatcherCase,
} from "../shared/estimate-matcher";

describe("estimate-matcher: normalizeKey", () => {
  it("空白・ハイフン・スラッシュ・アンダースコア・全角空白を除去する", () => {
    expect(normalizeKey("285236-1")).toBe("2852361");
    expect(normalizeKey(" Plenus / 池袋_店 ")).toBe("plenus池袋店");
    expect(normalizeKey("")).toBe("");
    expect(normalizeKey(null)).toBe("");
    expect(normalizeKey(undefined)).toBe("");
  });
});

const sampleCases: MatcherCase[] = [
  {
    id: 1,
    requestNumber: "285236-1",
    storeName: "ほっともっと 渋谷店",
    requestContent: "厨房ガスコンロ修理",
    categoryLarge: "厨房",
    categoryMedium: "ガス",
    categorySmall: "コンロ",
  },
  {
    id: 2,
    requestNumber: "999999-9",
    storeName: "やよい軒 池袋店",
    requestContent: "エアコン交換",
    categoryLarge: "空調",
  },
  {
    id: 3,
    requestNumber: "111111-1",
    storeName: "ほっともっと 新宿南口店",
    requestContent: "客席照明LED化",
    categoryLarge: "電気",
  },
  {
    id: 4,
    requestNumber: null,
    storeName: "ほっともっと 渋谷店",
    requestContent: "看板メンテ",
  },
];

describe("estimate-matcher: scoreCandidates", () => {
  it("依頼番号の完全一致は最高スコアになる", () => {
    const scored = scoreCandidates(
      { requestNumber: "285236-1", caseTitle: null, storeName: null },
      sampleCases
    );
    expect(scored[0].caseId).toBe(1);
    expect(scored[0].score).toBeGreaterThanOrEqual(100);
  });

  it("依頼番号の部分一致もスコアに加算される", () => {
    const scored = scoreCandidates(
      { requestNumber: "285236", caseTitle: null, storeName: null },
      sampleCases
    );
    const best = scored[0];
    expect(best.caseId).toBe(1);
    expect(best.score).toBeGreaterThanOrEqual(100);
  });

  it("店舗名一致のみだと低スコア（30）になる", () => {
    const scored = scoreCandidates(
      { requestNumber: null, caseTitle: null, storeName: "やよい軒 池袋店" },
      sampleCases
    );
    expect(scored[0].caseId).toBe(2);
    expect(scored[0].score).toBe(30);
  });

  it("依頼番号＋店舗名が両方ヒットすると合計スコアになる", () => {
    const scored = scoreCandidates(
      {
        requestNumber: "285236-1",
        caseTitle: null,
        storeName: "ほっともっと 渋谷店",
      },
      sampleCases
    );
    expect(scored[0].caseId).toBe(1);
    expect(scored[0].score).toBeGreaterThanOrEqual(130);
  });

  it("案件名（caseTitle）が説明/カテゴリに含まれると+15される", () => {
    const scored = scoreCandidates(
      { requestNumber: null, caseTitle: "ガスコンロ", storeName: null },
      sampleCases
    );
    const top = scored[0];
    expect(top.caseId).toBe(1);
    expect(top.score).toBeGreaterThanOrEqual(15);
  });

  it("どのフィールドもヒットしない場合は全件 score=0 になる", () => {
    const scored = scoreCandidates(
      { requestNumber: "ABCDEFG", caseTitle: "存在しない件名", storeName: "未知店" },
      sampleCases
    );
    expect(scored.every((s) => s.score === 0)).toBe(true);
  });

  it("結果はスコア降順、同スコアはcaseId昇順で安定", () => {
    const scored = scoreCandidates(
      { requestNumber: null, caseTitle: null, storeName: "ほっともっと 渋谷店" },
      sampleCases
    );
    // case 1 と case 4 が両方+30
    const tied = scored.filter((s) => s.score === 30);
    expect(tied.map((s) => s.caseId)).toEqual([1, 4]);
  });

  it("空ケース配列を渡しても空配列を返す（落ちない）", () => {
    const scored = scoreCandidates(
      { requestNumber: "X", caseTitle: "Y", storeName: "Z" },
      []
    );
    expect(scored).toEqual([]);
  });
});

describe("estimate-matcher: topMatches / pickBestMatch", () => {
  it("topMatchesはscore=0を除外し上位N件のみ返す", () => {
    const scored = scoreCandidates(
      { requestNumber: null, caseTitle: null, storeName: "ほっともっと 渋谷店" },
      sampleCases
    );
    const top = topMatches(scored, 5);
    expect(top.every((s) => s.score > 0)).toBe(true);
    expect(top.length).toBeLessThanOrEqual(5);
  });

  it("topMatchesのlimit指定が効く", () => {
    const scored = scoreCandidates(
      { requestNumber: null, caseTitle: null, storeName: "ほっともっと 渋谷店" },
      sampleCases
    );
    const top = topMatches(scored, 1);
    expect(top.length).toBe(1);
  });

  it("pickBestMatchは依頼番号一致レベル(score>=100)のみ返す", () => {
    const scored = scoreCandidates(
      { requestNumber: "285236-1", caseTitle: null, storeName: null },
      sampleCases
    );
    const best = pickBestMatch(scored);
    expect(best?.caseId).toBe(1);
  });

  it("pickBestMatchは店舗一致のみ(score=30)ではnullを返す（自動確定しない）", () => {
    const scored = scoreCandidates(
      { requestNumber: null, caseTitle: null, storeName: "ほっともっと 渋谷店" },
      sampleCases
    );
    const best = pickBestMatch(scored);
    expect(best).toBeNull();
  });

  it("pickBestMatchは候補が空ならnullを返す", () => {
    expect(pickBestMatch([])).toBeNull();
  });
});
