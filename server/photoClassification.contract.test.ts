import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("施工写真AI分類の実装契約", () => {
  it("AI候補取得と確認後保存を別APIにし、候補取得だけではDBを変更しない", () => {
    const source = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
    const classifyBlock = source.slice(
      source.indexOf("classify: protectedProcedure"),
      source.indexOf("applyClassifications: protectedProcedure"),
    );
    expect(classifyBlock).toContain("classifyConstructionPhotos");
    expect(classifyBlock).not.toContain("applyPhotoClassificationsWithHistory");
    expect(source).toContain("applyClassifications: protectedProcedure");
    expect(source).toContain("applyPhotoClassificationsWithHistory");
    expect(source).toContain("assertCaseAccess(caseData, ctx.user)");
  });

  it("レビュー画面に写真・確信度・理由・個別修正・除外・確認保存を備える", () => {
    const source = fs.readFileSync(
      path.join(root, "client/src/components/photos/PhotoClassificationReviewDialog.tsx"),
      "utf8",
    );
    expect(source).toContain("AI写真分類の確認");
    expect(source).toContain("まだ保存されていません");
    expect(source).toContain("確信度 {suggestion.confidence}%");
    expect(source).toContain("低確信度を対象外にする");
    expect(source).toContain("確認した{includedSuggestions.length}枚を保存");
    expect(source).toContain("PHOTO_CLASSIFICATION_CATEGORIES.map");
  });

  it("写真タブから選択写真または全写真を20枚まで分類できる", () => {
    const source = fs.readFileSync(
      path.join(root, "client/src/pages/CaseDetailPhotosTab.tsx"),
      "utf8",
    );
    expect(source).toContain("PhotoClassificationReviewDialog");
    expect(source).toContain("selectedPhotoIds={Array.from(selectedIds)}");
    expect(source).toContain("canUseAiClassification &&");
  });

  it("写真タブにAI分類履歴・変更差分・競合保護付きUndoを備える", () => {
    const routerSource = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
    const tabSource = fs.readFileSync(
      path.join(root, "client/src/pages/CaseDetailPhotosTab.tsx"),
      "utf8",
    );
    const historySource = fs.readFileSync(
      path.join(root, "client/src/components/photos/PhotoClassificationHistoryDialog.tsx"),
      "utf8",
    );

    expect(routerSource).toContain("classificationHistory: protectedProcedure");
    expect(routerSource).toContain("undoClassification: protectedProcedure");
    expect(routerSource).toContain("undoPhotoClassificationRun");
    expect(tabSource).toContain("PhotoClassificationHistoryDialog");
    expect(historySource).toContain("AI写真分類の履歴");
    expect(historySource).toContain("変更前: {change.beforePhotoType}");
    expect(historySource).toContain("変更後: {change.afterPhotoType}");
    expect(historySource).toContain("現在値が変更済み");
    expect(historySource).toContain("この分類を元に戻す");
    expect(historySource).toContain("1枚でも現在値が変わっている場合は、全件を変更せず停止します");
  });
});
