import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FIELD_MEMO_CATEGORIES,
  FIELD_MEMO_MAX_LENGTH,
  canCreateFieldMemo,
  canModifyFieldMemo,
  canViewFieldMemos,
} from "../shared/fieldMemos";

describe("field memos contract", () => {
  it("uses the approved five categories and 500-character limit", () => {
    expect(FIELD_MEMO_CATEGORIES).toEqual(["状況", "確認事項", "追加対応", "注意", "連絡"]);
    expect(FIELD_MEMO_MAX_LENGTH).toBe(500);
  });

  it.each(["owner", "admin", "user", "partner"])("allows %s to create", (role) => {
    expect(canCreateFieldMemo(role)).toBe(true);
  });

  it("allows executive to view but not create, and hides from customer", () => {
    expect(canViewFieldMemos("executive")).toBe(true);
    expect(canCreateFieldMemo("executive")).toBe(false);
    expect(canViewFieldMemos("customer")).toBe(false);
  });

  it("only allows the author to modify a memo", () => {
    expect(canModifyFieldMemo("admin", 10, 10)).toBe(true);
    expect(canModifyFieldMemo("owner", 1, 10)).toBe(false);
    expect(canModifyFieldMemo("partner", 20, 10)).toBe(false);
  });

  it("places the case-wide memo panel directly after photo upload and keeps photo memos separate", () => {
    const caseDetail = readFileSync(resolve("client/src/pages/CaseDetail.tsx"), "utf8");
    const photosTab = readFileSync(resolve("client/src/pages/CaseDetailPhotosTab.tsx"), "utf8");
    const panel = readFileSync(resolve("client/src/components/photos/CaseFieldMemosPanel.tsx"), "utf8");
    expect(photosTab.indexOf("<CaseFieldMemosPanel caseId={caseId} />"))
      .toBeGreaterThan(photosTab.indexOf("{/* Camera + Upload */}"));
    expect(photosTab.indexOf("<CaseFieldMemosPanel caseId={caseId} />"))
      .toBeLessThan(photosTab.indexOf("{/* View Controls */}"));
    expect(panel).toContain("案件全体の状況を時系列で記録します");
    expect(panel).toContain("写真固有の内容は各写真のメモ欄へ入力してください");
    expect(panel).toContain("FIELD_MEMO_MAX_LENGTH");
    expect(panel).toContain("記入者と日時は自動記録されます");
    expect(caseDetail).toContain('get("tab") === "photos"');
  });
});
