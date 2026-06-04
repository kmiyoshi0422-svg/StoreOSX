import { describe, it, expect } from "vitest";
import {
  aggregateExpensesByUser,
  isWithinRange,
  EXPENSE_CATEGORIES,
  type ExpenseLike,
} from "../shared/expense-aggregate";

const names = new Map<number, string>([
  [1, "田中"],
  [2, "佐藤"],
]);

describe("aggregateExpensesByUser", () => {
  it("立替者別に合計・件数を集計する", () => {
    const rows: ExpenseLike[] = [
      { amount: 1000, category: "材料費", scope: "案件", uploadedBy: 1 },
      { amount: 2000, category: "交通費", scope: "案件", uploadedBy: 1 },
      { amount: 500, category: "消耗品", scope: "全体", uploadedBy: 2 },
    ];
    const res = aggregateExpensesByUser(rows, names);
    expect(res.grandTotal).toBe(3500);
    expect(res.count).toBe(3);
    const tanaka = res.byUser.find((u) => u.userId === 1)!;
    expect(tanaka.userName).toBe("田中");
    expect(tanaka.total).toBe(3000);
    expect(tanaka.count).toBe(2);
  });

  it("合計の降順で並ぶ", () => {
    const rows: ExpenseLike[] = [
      { amount: 100, scope: "案件", uploadedBy: 1 },
      { amount: 9000, scope: "案件", uploadedBy: 2 },
    ];
    const res = aggregateExpensesByUser(rows, names);
    expect(res.byUser[0].userId).toBe(2);
    expect(res.byUser[1].userId).toBe(1);
  });

  it("案件/全体の内訳を正しく分ける", () => {
    const rows: ExpenseLike[] = [
      { amount: 1000, scope: "案件", uploadedBy: 1 },
      { amount: 300, scope: "全体", uploadedBy: 1 },
    ];
    const res = aggregateExpensesByUser(rows, names);
    const u = res.byUser[0];
    expect(u.caseTotal).toBe(1000);
    expect(u.generalTotal).toBe(300);
    expect(u.total).toBe(1300);
  });

  it("scopeが案件/全体以外（未設定）は案件側に集計する", () => {
    const rows: ExpenseLike[] = [{ amount: 800, scope: null, uploadedBy: 1 }];
    const res = aggregateExpensesByUser(rows, names);
    expect(res.byUser[0].caseTotal).toBe(800);
    expect(res.byUser[0].generalTotal).toBe(0);
  });

  it("区分別の内訳を集計する", () => {
    const rows: ExpenseLike[] = [
      { amount: 1000, category: "車両費", scope: "全体", uploadedBy: 1 },
      { amount: 2000, category: "車両費", scope: "全体", uploadedBy: 1 },
      { amount: 500, category: "宿泊費", scope: "全体", uploadedBy: 1 },
    ];
    const res = aggregateExpensesByUser(rows, names);
    const u = res.byUser[0];
    expect(u.byCategory["車両費"]).toBe(3000);
    expect(u.byCategory["宿泊費"]).toBe(500);
    expect(u.byCategory["材料費"]).toBe(0);
  });

  it("未知の区分も加算される（byCategoryに動的キー）", () => {
    const rows: ExpenseLike[] = [
      { amount: 700, category: "謎費目", scope: "全体", uploadedBy: 1 },
    ];
    const res = aggregateExpensesByUser(rows, names);
    expect(res.byUser[0].byCategory["謎費目"]).toBe(700);
  });

  it("categoryが無い場合はその他に集計する", () => {
    const rows: ExpenseLike[] = [{ amount: 400, scope: "全体", uploadedBy: 1 }];
    const res = aggregateExpensesByUser(rows, names);
    expect(res.byUser[0].byCategory["その他"]).toBe(400);
  });

  it("uploadedByが無い場合は不明として集計する", () => {
    const rows: ExpenseLike[] = [{ amount: 250, scope: "全体", uploadedBy: null }];
    const res = aggregateExpensesByUser(rows, names);
    expect(res.byUser[0].userId).toBeNull();
    expect(res.byUser[0].userName).toBe("不明");
  });

  it("名前マップに無いユーザーはID:xで表示する", () => {
    const rows: ExpenseLike[] = [{ amount: 100, scope: "案件", uploadedBy: 99 }];
    const res = aggregateExpensesByUser(rows, names);
    expect(res.byUser[0].userName).toBe("ID:99");
  });

  it("amountがnullでもカウントされ合計には0加算", () => {
    const rows: ExpenseLike[] = [
      { amount: null, scope: "案件", uploadedBy: 1 },
      { amount: 500, scope: "案件", uploadedBy: 1 },
    ];
    const res = aggregateExpensesByUser(rows, names);
    expect(res.byUser[0].count).toBe(2);
    expect(res.byUser[0].total).toBe(500);
  });

  it("空配列のとき空の結果を返す", () => {
    const res = aggregateExpensesByUser([], names);
    expect(res.byUser).toEqual([]);
    expect(res.grandTotal).toBe(0);
    expect(res.count).toBe(0);
    expect(res.categories).toEqual([...EXPENSE_CATEGORIES]);
  });
});

describe("isWithinRange", () => {
  it("範囲指定なしは常にtrue", () => {
    expect(isWithinRange(1000)).toBe(true);
    expect(isWithinRange(null)).toBe(true);
  });
  it("from/toの範囲内ならtrue", () => {
    expect(isWithinRange(150, 100, 200)).toBe(true);
  });
  it("fromより小さいとfalse", () => {
    expect(isWithinRange(50, 100, 200)).toBe(false);
  });
  it("toより大きいとfalse", () => {
    expect(isWithinRange(250, 100, 200)).toBe(false);
  });
  it("日付なしレコードは範囲指定があると除外", () => {
    expect(isWithinRange(null, 100, 200)).toBe(false);
  });
});
