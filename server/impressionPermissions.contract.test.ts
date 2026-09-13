import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

describe("所感保存権限のコード契約", () => {
  it("APIは所感保存とAI生成の両方で専用権限を検証する", () => {
    const source = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
    expect(source).toContain("includesSurveyImpression && !canEditSurveyImpression(ctx.user.role)");
    expect(source).toContain('message: "所感を保存する権限がありません"');
    expect(source).toContain('message: "所感を生成する権限がありません"');
    expect(source).not.toContain("'surveyImpression', 'surveyImpressionAuthor'");
  });

  it("現調報告書の編集欄は専用権限で表示制御する", () => {
    const source = fs.readFileSync(path.join(root, "client/src/pages/CaseReport.tsx"), "utf8");
    expect(source).toContain("const canEditImpression = canEditSurveyImpression(user?.role ?? \"\")");
    expect(source).toContain('reportType === "survey" && canEditImpression');
  });

  it("協力業者短文所感は正式所感と分離し200文字に制限する", () => {
    const routerSource = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
    const reportSource = fs.readFileSync(path.join(root, "client/src/pages/CaseReport.tsx"), "utf8");
    const detailSource = fs.readFileSync(path.join(root, "client/src/pages/CaseDetail.tsx"), "utf8");

    expect(routerSource).toContain('partnerNotes: z.string().trim().max(200');
    expect(reportSource).toContain('const isPartner = user?.role === "partner"');
    expect(reportSource).toContain("協力業者 短文所感");
    expect(reportSource).toContain("短文所感を保存");
    expect(reportSource).toContain("maxLength={200}");
    expect(detailSource).toContain("社内正式所感とは分けて管理されます");
  });
});
