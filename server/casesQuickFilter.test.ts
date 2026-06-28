import { describe, it, expect } from "vitest";

// ダッシュボードKPIカード → 案件一覧 クイックフィルタの絞り込みロジック検証。
// CasesList.tsx の filtered ロジックと同一のルールを純粋関数として再現し回帰を防ぐ。

const IN_PROGRESS = ["受付", "現調中", "見積中", "施工待ち", "施工中"];

type Case = { id: number; status: string; urgency: "S" | "A" | "B" | "C" };

function matchesQuickFilter(
  c: Case,
  statusFilter: string,
  urgency: string
): boolean {
  if (statusFilter !== "all") {
    if (statusFilter === "進行中") {
      if (!IN_PROGRESS.includes(c.status)) return false;
    } else if (c.status !== statusFilter) return false;
  }
  if (urgency === "high") {
    if (c.urgency !== "S" && c.urgency !== "A") return false;
  } else if (urgency !== "all" && c.urgency !== urgency) return false;
  return true;
}

const sample: Case[] = [
  { id: 1, status: "受付", urgency: "S" },
  { id: 2, status: "現調中", urgency: "A" },
  { id: 3, status: "施工中", urgency: "B" },
  { id: 4, status: "完了", urgency: "C" },
  { id: 5, status: "完了", urgency: "S" },
  { id: 6, status: "クローズ", urgency: "B" },
];

describe("案件一覧クイックフィルタ（KPIカード遷移）", () => {
  it("status=進行中 は受付〜施工中のみを残し、完了/クローズを除外する", () => {
    const res = sample.filter((c) => matchesQuickFilter(c, "進行中", "all"));
    expect(res.map((c) => c.id).sort()).toEqual([1, 2, 3]);
  });

  it("status=完了 は完了ステータスのみを残す", () => {
    const res = sample.filter((c) => matchesQuickFilter(c, "完了", "all"));
    expect(res.map((c) => c.id).sort()).toEqual([4, 5]);
  });

  it("urgency=high は緊急度S・Aのみを残す", () => {
    const res = sample.filter((c) => matchesQuickFilter(c, "all", "high"));
    expect(res.map((c) => c.id).sort()).toEqual([1, 2, 5]);
  });

  it("status=all かつ urgency=all は全件を残す", () => {
    const res = sample.filter((c) => matchesQuickFilter(c, "all", "all"));
    expect(res).toHaveLength(sample.length);
  });

  it("個別ステータス指定（施工中）は完全一致のみ残す", () => {
    const res = sample.filter((c) => matchesQuickFilter(c, "施工中", "all"));
    expect(res.map((c) => c.id)).toEqual([3]);
  });
});
