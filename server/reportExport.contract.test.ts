import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
describe('報告書PDF出力の操作契約', () => {
  for (const path of ['client/src/pages/CaseReport.tsx','client/src/pages/CompletionReport.tsx']) {
    it(`${path} は未プレビューのPDF出力を無効化せず、確認画面を開く`, () => {
      const code = source(path);
      expect(code).toContain('previewReady ? handleDownloadPDF() : setPreviewOpen(true)');
      expect(code).not.toContain('disabled={generating || !previewReady}');
      expect(code).toContain('if (!previewReady || !previewPages');
      expect(code).toContain('fullwidthExclusions.list.useQuery(undefined, { enabled: isInternal })');
    });
  }
  it('スマホの操作欄は折り返し、写真取得失敗は再試行可能で出力を許可しない', () => {
    const code = source('client/src/components/PdfPreviewModal.tsx');
    expect(code).toContain('flex flex-wrap items-center gap-2 min-w-0');
    expect(code).toContain('width: `${previewWidth}px`');
    expect(code).toContain('onClick={generatePreview}>再試行');
    expect(code).toContain('!pdfDownloadReady || loading || pages.length === 0');
    expect(code).toContain('strict: true');
  });
  it('社外PDF保存は社内履歴APIを呼ばず、内部ユーザーの履歴は維持', () => {
    const code = source('client/src/hooks/usePdfHistoryRecorder.ts');
    expect(code).toContain('user?.role === "partner" || user?.role === "customer"');
    expect(code).toContain('return { skipped: true }');
    expect(code).toContain('uploadMutation.mutateAsync');
  });
});
