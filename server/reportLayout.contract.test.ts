import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("報告書の統一標準レイアウト契約", () => {
  const standardSource = fs.readFileSync(
    path.join(root, "client/src/components/reports/StandardReportLayout.tsx"),
    "utf8",
  );
  const surveySource = fs.readFileSync(
    path.join(root, "client/src/pages/CaseReport.tsx"),
    "utf8",
  );
  const completionSource = fs.readFileSync(
    path.join(root, "client/src/components/reports/UnifiedCompletionReportPages.tsx"),
    "utf8",
  );
  const completionPageSource = fs.readFileSync(
    path.join(root, "client/src/pages/CompletionReport.tsx"),
    "utf8",
  );

  it("現地調査報告書は統一標準ヘッダー・セクション・全ページフッターを使用する", () => {
    expect(surveySource).toContain("StandardDocumentHeader");
    expect(surveySource).toContain("StandardSectionBand");
    expect(surveySource).toContain("StandardReportFooter");
    expect(surveySource).toContain("totalReportPages");
    expect(standardSource).toContain('data-report-layout="standard"');
  });

  it("工事完了報告書は統一標準ページとBefore／After横並び比較を使用する", () => {
    expect(completionPageSource).toContain("UnifiedCompletionReportPages");
    expect(completionSource).toContain("pairBeforeAfterPhotos");
    expect(completionSource).toContain('data-before-after-pair="true"');
    expect(completionSource).toContain("BEFORE｜施工前");
    expect(completionSource).toContain("AFTER｜施工後");
    expect(completionSource).toContain("grid grid-cols-2 gap-3");
  });

  it("対応写真がない場合は未登録表示にし、存在しない写真を生成しない", () => {
    expect(completionSource).toContain("対応する{color === \"before\" ? \"施工前\" : \"施工後\"}写真は登録されていません");
    expect(completionSource).toContain("写真未登録のため、単独写真として掲載しています。");
    expect(completionSource).toContain("存在しない写真は生成せず");
  });

  it("現地調査・完了報告書の最終ページに電子サインと手書き署名欄を必ず残す", () => {
    expect(surveySource).toContain("<SignatureBlock signature={signature} />");
    expect(completionSource).toContain("<StandardSignatureBlock signature={signature} />");
    expect(standardSource).toContain('data-report-signature="true"');
    expect(standardSource).toContain("保存済みサイン");
    expect(standardSource).toContain("手書きサイン");
    expect(standardSource).toContain("先方確認サイン");
  });

  it("サイン登録・再署名・削除の既存操作を維持する", () => {
    expect(surveySource).toContain("<SignaturePad");
    expect(surveySource).toContain("サインし直す");
    expect(surveySource).toContain("deleteSig.mutate");
    expect(completionPageSource).toContain("<SignaturePad");
    expect(completionPageSource).toContain("サインし直す");
    expect(completionPageSource).toContain("deleteSig.mutate");
  });
});
