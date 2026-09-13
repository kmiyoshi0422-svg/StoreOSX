import { describe, expect, it } from "vitest";
import {
  canAccessPrefecture,
  canManageAccess,
  canManageCases,
  canViewInternalFinancials,
  canViewProfit,
  applyFinancialVisibility,
  filterCasesByArea,
  maskProfitValues,
  stripInternalFinancialFields,
} from "../shared/accessPolicy";

describe("role and area access policy", () => {
  it("管理者と役員だけが社内金額を閲覧できる", () => {
    expect(canViewInternalFinancials("owner")).toBe(true);
    expect(canViewInternalFinancials("admin")).toBe(true);
    expect(canViewInternalFinancials("executive")).toBe(true);
    expect(canViewInternalFinancials("user")).toBe(false);
    expect(canViewInternalFinancials("partner")).toBe(false);
    expect(canViewInternalFinancials("customer")).toBe(false);
  });

  it("利益と粗利率は最高管理者だけが閲覧できる", () => {
    expect(canViewProfit("owner")).toBe(true);
    expect(canViewProfit("admin")).toBe(false);
    expect(canViewProfit("executive")).toBe(false);
    expect(canViewProfit("user")).toBe(false);
  });

  it("管理者向けレスポンスでは売上・原価を残し利益だけをマスクする", () => {
    expect(maskProfitValues({ revenue: 100, cost: 80, profit: 20, margin: 20 })).toEqual({
      revenue: 100,
      cost: 80,
      profit: null,
      margin: null,
    });
  });

  it("権限管理はowner/admin、案件操作はowner/admin/executive/userだけ", () => {
    expect(canManageAccess("owner")).toBe(true);
    expect(canManageAccess("admin")).toBe(true);
    expect(canManageAccess("executive")).toBe(false);
    expect(canManageCases("executive")).toBe(true);
    expect(canManageCases("user")).toBe(true);
    expect(canManageCases("partner")).toBe(false);
    expect(canManageCases("customer")).toBe(false);
  });

  it("selected設定では許可都道府県の案件だけを返す", () => {
    const user = { role: "user", areaAccessMode: "selected" as const, allowedPrefectures: '["福岡県","山口県"]' };
    expect(canAccessPrefecture(user, "福岡県")).toBe(true);
    expect(canAccessPrefecture(user, "東京都")).toBe(false);
    expect(filterCasesByArea([
      { id: 1, prefecture: "福岡県" },
      { id: 2, prefecture: "東京都" },
    ], user)).toEqual([{ id: 1, prefecture: "福岡県" }]);
  });

  it("社員向け案件から社内金額だけを除去する", () => {
    const masked = stripInternalFinancialFields({
      id: 1,
      estimatedCost: 100000,
      plenusQuoteAmount: 150000,
      actualCost: 80000,
      requestContent: "漏電修理",
    });
    expect(masked.estimatedCost).toBeNull();
    expect(masked.plenusQuoteAmount).toBeNull();
    expect(masked.actualCost).toBeNull();
    expect(masked.requestContent).toBe("漏電修理");
  });

  it("協力業者と顧客には承認状態にかかわらず社内金額を一切見せない", () => {
    const row = {
      estimatedCost: 75000,
      plenusQuoteAmount: 100000,
      actualCost: 70000,
      amountApproved: true,
    };
    const partner = applyFinancialVisibility(row, "partner");
    expect(partner.estimatedCost).toBeNull();
    expect(partner.plenusQuoteAmount).toBeNull();
    expect(partner.actualCost).toBeNull();
    const customer = applyFinancialVisibility(row, "customer");
    expect(customer.estimatedCost).toBeNull();
    expect(customer.plenusQuoteAmount).toBeNull();
  });
});
