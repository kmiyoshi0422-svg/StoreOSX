# PDF修正の問題分析

## 問題
1. 文字がちゃんとしていない（文字化け/レンダリング不正）
2. 文字が切れている
3. 写真がうつっていない

## 原因分析

### 文字の問題
- html2canvas はDOMをキャンバスに描画する際、Google Fontsのウェブフォント（Noto Sans JP / Noto Serif JP）が完全にロードされていないと
  フォールバックフォントで描画されたり、文字が正しくレンダリングされない
- `htmlToPDF` 関数ではオフスクリーンのDIVにHTMLを挿入してすぐにhtml2canvasを実行しているが、
  フォントの読み込み待ち（document.fonts.ready）を行っていない
- 写真台帳ページでも同様にフォント読み込み待ちがない

### 文字切れの問題
- documentPdf.ts の `buildQuoteHTML` / `buildCompletionHTML` で `width:794px` の固定幅コンテナを使用
- html2canvas でオフスクリーン描画する際、コンテナが `left: -9999px` に配置されるが、
  ブラウザのビューポートによっては要素の一部がクリップされる可能性がある
- 写真台帳のTailwindクラスベースのレイアウトも、オフスクリーン時に正しく計算されない可能性

### 写真非表示の問題
- 写真台帳: `toDataUrl` でfetchして dataURL に変換する処理はあるが、
  CORS/認証の問題やタイムアウトで失敗する可能性がある
- html2canvas の `useCORS: true` だけでは、認証が必要な画像（/manus-storage/）を取得できない
- 画像のdecode待ちはしているが、img.naturalWidth/Height が0のまま描画される可能性

## 修正方針
1. `document.fonts.ready` を待ってからhtml2canvasを実行
2. オフスクリーンコンテナを `visibility: hidden` + 実際のビューポート内に配置（クリップ防止）
3. 画像のdataURL変換を確実にし、失敗時のフォールバックを改善
4. html2canvas の `windowWidth` オプションを明示的に設定
5. 写真台帳の画像にcrossorigin属性を追加
