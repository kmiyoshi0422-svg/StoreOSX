import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const accessPolicy = read("shared/accessPolicy.ts");
const routerSource = read("server/routers.ts");
const dbSource = read("server/db.ts");
const casesListSource = read("client/src/pages/CasesList.tsx");
const caseDetailSource = read("client/src/pages/CaseDetail.tsx");
const profitTabSource = read("client/src/pages/CaseDetailProfitTab.tsx");
const reportsSource = read("client/src/pages/Reports.tsx");
const accessManagementSource = read("client/src/pages/AccessManagement.tsx");

describe("実ユーザー権限マトリクス契約", () => {
  it("最高管理者だけが利益を閲覧し、管理者は売上・原価までに限定される", () => {
    expect(accessPolicy).toContain('export function canViewProfit(role: string)');
    expect(accessPolicy).toContain('return role === "owner"');
    expect(routerSource).toContain('canViewProfit(ctx.user.role) ? result : maskProfitValues(result)');
    expect(reportsSource).toContain('const canViewProfit = user?.role === "owner"');
    expect(casesListSource).toContain('{canViewProfit && (');
    expect(caseDetailSource).toContain('canViewProfit={canViewProfit}');
    expect(profitTabSource).toContain('{canViewProfit && (');
  });

  it("システム所有者はログイン同期時もownerへ固定される", () => {
    expect(dbSource).toContain('user.openId === ENV.ownerOpenId');
    expect(dbSource).toContain('values.role = "owner"');
    expect(dbSource).toContain('updateSet.role = "owner"');
  });

  it("協力業者は全案件の概要のみ閲覧し、編集は担当・指定エリアに限定し、金額APIを利用できない", () => {
    expect(routerSource).toContain('user.role === "partner" ? rows : filterCasesByArea(rows, user)');
    expect(routerSource).toContain('editableIds.has');
    expect(routerSource).toContain('await assertCaseAccess(caseData, ctx.user)');
    expect(accessPolicy).not.toContain('original.amountApproved === true');
    expect(routerSource).toContain('message: "見積金額の閲覧権限がありません"');
    expect(accessManagementSource).toContain('全案件の概要・現場写真を閲覧');
    expect(accessManagementSource).toContain('金額・見積・経費は非表示');
  });
});
