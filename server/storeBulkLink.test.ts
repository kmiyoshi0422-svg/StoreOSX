import { describe, expect, it } from "vitest";
import { buildStoreBulkLinkPreview } from "../shared/storeBulkLink";

const stores = [
  { id: 1, storeCode: "HM-001", storeName: "ほっともっと 東京店" },
  { id: 2, storeCode: "YY-002", storeName: "やよい軒大阪店" },
];

describe("buildStoreBulkLinkPreview", () => {
  it("店舗コードを店舗名より優先する", () => {
    const result = buildStoreBulkLinkPreview([
      { id: 10, requestNumber: "R-10", storeCode: " hm-001 ", storeName: "別名" },
    ], stores);
    expect(result.candidates[0]).toMatchObject({ storeId: 1, matchType: "storeCode" });
  });

  it("店舗コードが一致しない場合は正規化した店舗名で照合する", () => {
    const result = buildStoreBulkLinkPreview([
      { id: 11, requestNumber: "R-11", storeCode: null, storeName: "やよい軒 大阪店" },
    ], stores);
    expect(result.candidates[0]).toMatchObject({ storeId: 2, matchType: "storeName" });
  });

  it("候補が複数ある場合は自動紐付けしない", () => {
    const result = buildStoreBulkLinkPreview(
      [{ id: 12, requestNumber: "R-12", storeCode: null, storeName: "重複店" }],
      [
        { id: 3, storeCode: null, storeName: "重複店" },
        { id: 4, storeCode: null, storeName: "重複 店" },
      ],
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(1);
  });

  it("未登録店舗は同じ店舗コード単位で新規マスタ候補にまとめる", () => {
    const result = buildStoreBulkLinkPreview([
      { id: 20, requestNumber: "R-20", storeCode: "NEW-1", storeName: "新店舗", brand: "ほっともっと" },
      { id: 21, requestNumber: "R-21", storeCode: "new-1", storeName: "新店舗 改装後", brand: "ほっともっと" },
    ], stores);
    expect(result.newStores).toHaveLength(1);
    expect(result.newStores[0].caseIds).toEqual([20, 21]);
  });
});
