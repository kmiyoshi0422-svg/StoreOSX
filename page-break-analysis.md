# PDF改ページ制御の分析

## CompletionReport (client/src/pages/CompletionReport.tsx)
- 各ページは `.report-page` クラス: width:210mm, min/max-height:297mm, padding:8mm 10mm, overflow:hidden, page-break-after:always
- ページ構成: 表紙(1) + 提出者(2) + 物件情報+概要(3) + 範囲+総評+評価(4) + 写真(n) + 後半まとめ(1)
- **問題点**: 後半ページ（採寸+材料+手順+結論+点検+リスク+署名）がすべて1ページに詰め込まれている
  - データが多い場合（材料10行+手順8行+点検5行+リスク5行）、overflow:hidden で下端が切れる
- **修正方針**: 後半セクションを動的に分割し、コンテンツ量に応じて複数ページに分ける
  - 各セクション（採寸/材料+手順/結論+点検+リスク+署名）を独立ページにするか、高さ見積もりで分割

## CaseReport (client/src/pages/CaseReport.tsx)
- 同様に .report-page で固定高さ297mm + overflow:hidden
- ページ構成: 表紙(1) + 物件テーブル+本文(2) + 写真(n) + 確認欄(1)
- **問題点**: 物件テーブル+本文ページで本文が長い場合に切れる可能性
- **修正方針**: 本文が長い場合に2ページに分割するロジックを追加

## documentPdf (client/src/lib/documentPdf.ts)
- jsPDF + html2canvas方式: HTML要素をcanvasに変換してPDFに貼り付け
- 見積書: 1ページ構成（テーブル行数が多い場合に切れる可能性）
- 完了報告書: 1ページ構成（同上）
- **修正方針**: テーブル行数が多い場合にページ分割するか、スケーリングで対応

## PhotoLedger / PhotoLedgerBatch
- 写真は2枚/ページで固定 → 改ページ問題なし
- 表紙は1ページ → 問題なし

## 優先修正箇所
1. CompletionReport 後半ページの動的分割（最も切れやすい）
2. CaseReport 本文ページの溢れ防止
3. documentPdf のテーブル行数制限
