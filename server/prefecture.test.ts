import { describe, expect, it } from "vitest";
import {
  detectPrefecture,
  prefectureLabel,
  prefectureSortIndex,
  PREFECTURES,
  UNKNOWN_PREFECTURE,
} from "../shared/prefecture";

describe("detectPrefecture", () => {
  it("先頭が都道府県名なら判定できる", () => {
    expect(detectPrefecture("東京都千代田区1-1")).toBe("東京都");
    expect(detectPrefecture("北海道札幌市中央区")).toBe("北海道");
    expect(detectPrefecture("大阪府大阪市北区梅田")).toBe("大阪府");
    expect(detectPrefecture("京都府京都市下京区")).toBe("京都府");
  });

  it("郵便番号や先頭空白があっても判定できる", () => {
    expect(detectPrefecture("〒100-0001 東京都千代田区")).toBe("東京都");
    expect(detectPrefecture("1000001東京都千代田区")).toBe("東京都");
    expect(detectPrefecture("　神奈川県横浜市西区")).toBe("神奈川県");
  });

  it("判定できない住所は null", () => {
    expect(detectPrefecture("")).toBeNull();
    expect(detectPrefecture(null)).toBeNull();
    expect(detectPrefecture(undefined)).toBeNull();
    expect(detectPrefecture("住所未登録")).toBeNull();
  });

  it("似た接頭（鹿児島/宮崎など）も正しく区別する", () => {
    expect(detectPrefecture("鹿児島県鹿児島市")).toBe("鹿児島県");
    expect(detectPrefecture("宮崎県宮崎市")).toBe("宮崎県");
    expect(detectPrefecture("宮城県仙台市")).toBe("宮城県");
  });
});

describe("prefectureLabel", () => {
  it("判定できない場合は未分類ラベル", () => {
    expect(prefectureLabel("不明")).toBe(UNKNOWN_PREFECTURE);
    expect(prefectureLabel("福岡県福岡市")).toBe("福岡県");
  });
});

describe("prefectureSortIndex", () => {
  it("北海道が先頭、未分類が最後", () => {
    expect(prefectureSortIndex("北海道")).toBe(0);
    expect(prefectureSortIndex("沖縄県")).toBe(PREFECTURES.length - 1);
    expect(prefectureSortIndex(UNKNOWN_PREFECTURE)).toBe(PREFECTURES.length);
  });

  it("東京は神奈川より前", () => {
    expect(prefectureSortIndex("東京都")).toBeLessThan(prefectureSortIndex("神奈川県"));
  });
});
