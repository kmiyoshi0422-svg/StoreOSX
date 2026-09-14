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
    expect(classifyBlock).not.toContain("updatePhotoTypesAtomically");
    expect(source).toContain("applyClassifications: protectedProcedure");
    expect(source).toContain("updatePhotoTypesAtomically");
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
});
