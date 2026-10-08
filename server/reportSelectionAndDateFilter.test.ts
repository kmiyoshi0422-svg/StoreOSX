import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { CASE_DATE_FIELDS, matchesCaseDateFilter, validCaseDateRange, type CaseDateFilter } from '../shared/caseDateFilter';
import { createMergedReportPdf } from '../client/src/lib/reportBulkPdf';
import { parseBulkCompletionSelection, reportMergedPdfName } from '../shared/reportBulk';
import fs from 'node:fs';

const filter: CaseDateFilter = {field:'firstResponseDate',mode:'all',from:'',to:''};
describe('対応日検索',()=>{
 it('条件なしは日付未入力も保持',()=>expect(matchesCaseDateFilter({},filter)).toBe(true));
 it('初回対応実績を予定日・現調日から推測しない',()=>{
   const row={responsePlannedDate:'2026-10-08',surveyDate:'2026-10-08'};
   expect(matchesCaseDateFilter(row,{...filter,mode:'set'})).toBe(false);
   expect(matchesCaseDateFilter(row,{...filter,mode:'unset'})).toBe(true);
   expect(matchesCaseDateFilter(row,{...filter,field:'responsePlannedDate',mode:'set'})).toBe(true);
 });
 it('日本時間の暦日の開始終了を含み、UTC境界を取り違えない',()=>{
   const range={...filter,from:'2026-10-08',to:'2026-10-08'};
   expect(matchesCaseDateFilter({firstResponseDate:'2026-10-07T15:00:00Z'},range)).toBe(true);
   expect(matchesCaseDateFilter({firstResponseDate:'2026-10-08T14:59:59Z'},range)).toBe(true);
   expect(matchesCaseDateFilter({firstResponseDate:'2026-10-07T14:59:59Z'},range)).toBe(false);
   expect(matchesCaseDateFilter({firstResponseDate:'2026-10-08T15:00:00Z'},range)).toBe(false);
   expect(matchesCaseDateFilter({},range)).toBe(false);
 });
 it('片側指定と不正日付・逆転範囲・無効日付を判別',()=>{
   expect(matchesCaseDateFilter({firstResponseDate:'2026-10-09'},{...filter,from:'2026-10-08'})).toBe(true);
   expect(matchesCaseDateFilter({firstResponseDate:'2026-10-09'},{...filter,to:'2026-10-08'})).toBe(false);
   expect(validCaseDateRange({from:'2026-02-30',to:''})).toBe(false);
   expect(validCaseDateRange({from:'2026-10-09',to:'2026-10-08'})).toBe(false);
   expect(matchesCaseDateFilter({firstResponseDate:'bad'},{...filter,mode:'unset'})).toBe(true);
 });
 it('種類全5列をそれぞれ選んで比較する',()=>{
   for(const field of CASE_DATE_FIELDS){
     expect(matchesCaseDateFilter({[field.value]:'2026-10-08'},{...filter,field:field.value,from:'2026-10-08',to:'2026-10-08'})).toBe(true);
   }
 });
});
async function pdfEntry(name:string,width:number,pages:number){
 const doc=await PDFDocument.create();for(let i=0;i<pages;i++)doc.addPage([width+i,842]);
 const bytes=await doc.save();return {fileName:name,bytes:Uint8Array.from(bytes).buffer,pageCount:pages};
}
describe('完了報告書の結合PDF',()=>{
 it('選択順で全ページをコピー、サイズ・縦横・ページ数を保持',async()=>{
  const a=await pdfEntry('a.pdf',595,2), b=await pdfEntry('b.pdf',600,3), progress:string[]=[];
  const blob=await createMergedReportPdf([a,b],message=>progress.push(message));
  expect(blob.type).toBe('application/pdf');
  const doc=await PDFDocument.load(await blob.arrayBuffer());
  expect(doc.getPageCount()).toBe(5);
  expect(doc.getPages().map(p=>p.getWidth())).toEqual([595,596,600,601,602]);
  expect(progress[0]).toContain('1 / 2');expect(progress.at(-1)).toContain('仕上げ');
 });
 it('1件・9件・確認済みページ数の不一致・破損PDFを拒否',async()=>{
  const a=await pdfEntry('a.pdf',595,1);
  await expect(createMergedReportPdf([a])).rejects.toThrow('2〜8');
  await expect(createMergedReportPdf(Array(9).fill(a))).rejects.toThrow('2〜8');
  await expect(createMergedReportPdf([a,{...a,pageCount:2}])).rejects.toThrow('ページ数');
  await expect(createMergedReportPdf([a,{...a,bytes:Uint8Array.from([1,2,3]).buffer}])).rejects.toThrow('結合に失敗');
 });
 it('80MBの入力と400ページを超える結合を拒否',async()=>{
   const a=await pdfEntry('a.pdf',595,1);
   await expect(createMergedReportPdf([a,{...a,bytes:new ArrayBuffer(80*1024*1024)}])).rejects.toThrow('80MB');
   const many=await pdfEntry('many.pdf',595,400);
   await expect(createMergedReportPdf([many,a])).rejects.toThrow('400ページ');
 });
 it('ファイル名には店舗・件数・日本時間ダウンロード日を含める',()=>{
  expect(reportMergedPdfName([{caseId:1,storeName:'A/店',reportType:'施工完了報告書'},{caseId:2,storeName:'B店',reportType:'施工完了報告書'}],new Date('2026-10-07T15:01:00Z'))).toBe('A_店_ほか1案件_完了報告書一括_20261008_0001.pdf');
 });
 it('URL選択は正の整数8件以内・重複なし、権限はAPIへ任せる',()=>{
  expect(parseBulkCompletionSelection('12,34')).toEqual([12,34]);expect(parseBulkCompletionSelection(null)).toEqual([]);
  for(const text of ['1,1','1,x','-1,2','1,','1,2,3,4,5,6,7,8,9','1.5,2']) expect(()=>parseBulkCompletionSelection(text)).toThrow();
 });
});
describe('一覧と出力のUI安全契約',()=>{
 it('完了一覧のチェック選択を完了種別で引継ぎ、現調を完了出力しない',()=>{
  const s=fs.readFileSync('client/src/pages/CompletedReports.tsx','utf8');
  expect(s).toContain('reportType=completion&caseIds=');expect(s).toContain('disabled={!report.canCompletion}');expect(s).toContain('selectedVisible.length < 2');
 });
 it('予定実績日・失注を検索、保存中は重複実行防止、全件確認・再権限確認を維持',()=>{
  const list=fs.readFileSync('client/src/pages/CasesList.tsx','utf8');expect(list).toContain('matchesCaseDateFilter(c,');expect(list).toContain('<SelectItem value="失注">');
  const bulk=fs.readFileSync('client/src/pages/ReportBulkDownload.tsx','utf8');expect(bulk).toContain('busyRef.current');expect(bulk).toContain('verified.size !== reports.length');expect(bulk).toContain('await validate.mutateAsync(reports.map');expect(bulk).toContain('createMergedReportPdf(reports, setProgress)');
  const modal=fs.readFileSync('client/src/components/PdfPreviewModal.tsx','utf8');expect(modal).toContain('aria-busy="true"');expect(modal).toContain('作成中… A4');
 });
});
