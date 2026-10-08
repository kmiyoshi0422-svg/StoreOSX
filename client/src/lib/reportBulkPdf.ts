import { BULK_REPORT_LIMIT, BULK_REPORT_MAX_BYTES } from '../../../shared/reportBulk';

type PdfEntry = { fileName: string; bytes: ArrayBuffer; pageCount: number };
/** 個別報告書の画像・署名をそのままページコピーし、圧縮・再描画で画質を落とさない。 */
export async function createMergedReportPdf(entries: ReadonlyArray<PdfEntry>, onProgress?: (message: string) => void): Promise<Blob> {
  if (entries.length < 2 || entries.length > BULK_REPORT_LIMIT) throw new Error(`報告書は2〜${BULK_REPORT_LIMIT}件を選択してください`);
  if (entries.reduce((n,e) => n+e.bytes.byteLength,0) > BULK_REPORT_MAX_BYTES) throw new Error('合計80MB以内で選択してください');
  const { PDFDocument } = await import('pdf-lib');
  const merged = await PDFDocument.create();
  merged.setTitle('Store OSX 一括報告書');
  merged.setProducer('Store OSX');
  for (let i=0; i<entries.length; i++) {
    const entry = entries[i];
    onProgress?.(`作成中… ${i+1} / ${entries.length}件のPDFを結合しています`);
    await new Promise(r=>setTimeout(r,0));
    try {
      const source = await PDFDocument.load(entry.bytes);
      if (!entry.pageCount || source.getPageCount() !== entry.pageCount) throw new Error('確認時のページ数と一致しません');
      if (merged.getPageCount()+source.getPageCount()>400) throw new Error('結合PDFは400ページ以内で選択してください');
      const pages = await merged.copyPages(source,source.getPageIndices());
      pages.forEach(page=>merged.addPage(page));
    } catch(e) { throw new Error(`${entry.fileName}の結合に失敗しました：${e instanceof Error ? e.message : 'PDFの破損・暗号化を確認してください'}`); }
  }
  onProgress?.('作成中… 結合PDFを仕上げています');
  await new Promise(r=>setTimeout(r,0));
  const bytes = await merged.save();
  if(bytes.byteLength>BULK_REPORT_MAX_BYTES) throw new Error('結合PDFが80MBを超えました。少ない件数でやり直してください');
  return new Blob([Uint8Array.from(bytes).buffer],{type:'application/pdf'});
}
