import { describe, expect, it } from "vitest";
import {
  detectPrefecture,
  prefectureLabel,
  prefectureSortIndex,
  resolveCasePrefecture,
  regionOfPrefecture,
  regionSortIndex,
  PREFECTURES,
  REGIONS,
  UNKNOWN_PREFECTURE,
  UNKNOWN_REGION,
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

describe("resolveCasePrefecture", () => {
  it("独立項目 prefecture を最優先する（住所と違っても）", () => {
    expect(
      resolveCasePrefecture({ prefecture: "東京都", address: "神奈川県横浜市" }),
    ).toBe("東京都");
  });

  it("prefecture が未設定なら住所から推定する", () => {
    expect(resolveCasePrefecture({ prefecture: null, address: "大阪府大阪市" })).toBe(
      "大阪府",
    );
    expect(resolveCasePrefecture({ prefecture: "", address: "福岡県福岡市" })).toBe(
      "福岡県",
    );
    expect(resolveCasePrefecture({ prefecture: "   ", address: "北海道札幌市" })).toBe(
      "北海道",
    );
  });

  it("住所未入力でも prefecture があれば分類できる", () => {
    expect(resolveCasePrefecture({ prefecture: "長野県", address: null })).toBe("長野県");
    expect(resolveCasePrefecture({ prefecture: "沖縄県", address: "" })).toBe("沖縄県");
  });

  it("prefectureも住所も不明なら未分類", () => {
    expect(resolveCasePrefecture({ prefecture: null, address: null })).toBe(
      UNKNOWN_PREFECTURE,
    );
    expect(resolveCasePrefecture({ prefecture: "", address: "住所未登録" })).toBe(
      UNKNOWN_PREFECTURE,
    );
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

describe("regionOfPrefecture", () => {
  it("代表的な県を正しい地方にマップする", () => {
    expect(regionOfPrefecture("東京都")).toBe("関東");
    expect(regionOfPrefecture("神奈川県")).toBe("関東");
    expect(regionOfPrefecture("大阪府")).toBe("近畿");
    expect(regionOfPrefecture("愛知県")).toBe("中部");
    expect(regionOfPrefecture("北海道")).toBe("北海道");
    expect(regionOfPrefecture("宮城県")).toBe("東北");
    expect(regionOfPrefecture("広島県")).toBe("中国");
    expect(regionOfPrefecture("香川県")).toBe("四国");
    expect(regionOfPrefecture("福岡県")).toBe("九州・沖縄");
    expect(regionOfPrefecture("沖縄県")).toBe("九州・沖縄");
  });

  it("全都道府県がいずれかの地方に属する", () => {
    for (const p of PREFECTURES) {
      expect(REGIONS).toContain(regionOfPrefecture(p) as never);
    }
  });

  it("未分類・不明なラベルは未分類地方", () => {
    expect(regionOfPrefecture(UNKNOWN_PREFECTURE)).toBe(UNKNOWN_REGION);
    expect(regionOfPrefecture("存在しない県")).toBe(UNKNOWN_REGION);
  });
});

describe("regionSortIndex", () => {
  it("北海道が先頭、未分類が最後", () => {
    expect(regionSortIndex("北海道")).toBe(0);
    expect(regionSortIndex(UNKNOWN_REGION)).toBe(REGIONS.length);
  });

  it("関東は近畿より前", () => {
    expect(regionSortIndex("関東")).toBeLessThan(regionSortIndex("近畿"));
  });
});
