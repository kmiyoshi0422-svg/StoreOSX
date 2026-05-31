import { describe, expect, it } from "vitest";
import { pickLatestEstimate, type EstimateRow } from "../shared/estimate-aggregator";

describe("estimate-aggregator: pickLatestEstimate", () => {
  it("候補が空ならnullを返す", () => {
    expect(pickLatestEstimate([])).toBeNull();
  });

  it("totalAmount=null/0は除外される", () => {
    const rows: EstimateRow[] = [
      { id: 1, totalAmount: null, createdAt: new Date("2025-05-01") },
      { id: 2, totalAmount: 0, createdAt: new Date("2025-06-01") },
    ];
    expect(pickLatestEstimate(rows)).toBeNull();
  });

  it("estimateDateが新しい方を採用する", () => {
    const rows: EstimateRow[] = [
      {
        id: 1,
        totalAmount: 100000,
        materialAmount: 60000,
        laborAmount: 40000,
        estimateDate: new Date("2025-04-15"),
        createdAt: new Date("2025-04-15"),
      },
      {
        id: 2,
        totalAmount: 150000,
        materialAmount: 90000,
        laborAmount: 60000,
        estimateDate: new Date("2025-05-20"),
        createdAt: new Date("2025-05-20"),
      },
    ];
    const picked = pickLatestEstimate(rows);
    expect(picked).not.toBeNull();
    expect(picked?.sourceId).toBe(2);
    expect(picked?.totalAmount).toBe(150000);
    expect(picked?.materialAmount).toBe(90000);
    expect(picked?.laborAmount).toBe(60000);
  });

  it("estimateDate無しの場合はcreatedAtで判定する", () => {
    const rows: EstimateRow[] = [
      {
        id: 1,
        totalAmount: 100000,
        createdAt: new Date("2025-04-15"),
      },
      {
        id: 2,
        totalAmount: 200000,
        createdAt: new Date("2025-06-01"),
      },
    ];
    const picked = pickLatestEstimate(rows);
    expect(picked?.sourceId).toBe(2);
    expect(picked?.totalAmount).toBe(200000);
  });

  it("estimateDate同日なら createdAtで判定する", () => {
    const rows: EstimateRow[] = [
      {
        id: 1,
        totalAmount: 100000,
        estimateDate: "2025-05-20",
        createdAt: new Date("2025-05-20T09:00:00Z"),
      },
      {
        id: 2,
        totalAmount: 120000,
        estimateDate: "2025-05-20",
        createdAt: new Date("2025-05-20T18:00:00Z"),
      },
    ];
    const picked = pickLatestEstimate(rows);
    expect(picked?.sourceId).toBe(2);
    expect(picked?.totalAmount).toBe(120000);
  });

  it("date情報が全く無ければidが大きい方を採用する（フォールバック）", () => {
    const rows: EstimateRow[] = [
      { id: 1, totalAmount: 50000 },
      { id: 5, totalAmount: 80000 },
      { id: 3, totalAmount: 70000 },
    ];
    const picked = pickLatestEstimate(rows);
    expect(picked?.sourceId).toBe(5);
    expect(picked?.totalAmount).toBe(80000);
  });

  it("文字列日時(ISO)も比較できる", () => {
    const rows: EstimateRow[] = [
      { id: 1, totalAmount: 100000, estimateDate: "2025-04-01" },
      { id: 2, totalAmount: 200000, estimateDate: "2025-08-01" },
    ];
    const picked = pickLatestEstimate(rows);
    expect(picked?.sourceId).toBe(2);
  });

  it("material/laborがnullの場合もnullで返す（既存値を上書きしないように呼び出し側で制御）", () => {
    const rows: EstimateRow[] = [
      {
        id: 1,
        totalAmount: 100000,
        materialAmount: null,
        laborAmount: null,
        createdAt: new Date(),
      },
    ];
    const picked = pickLatestEstimate(rows);
    expect(picked?.totalAmount).toBe(100000);
    expect(picked?.materialAmount).toBeNull();
    expect(picked?.laborAmount).toBeNull();
  });
});
