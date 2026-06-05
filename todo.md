# プレナス現場チェックブック - TODO

## 機能要件

- [x] データベーススキーマ設計（cases, checklist_items, photos）
- [x] DB Migration生成 & 適用
- [x] DBクエリヘルパー実装（server/db.ts）
- [x] tRPCルーター実装（cases, checklist, photos）
- [x] エレガントデザインのテーマ設定（ネイビー＋オフホワイト、Noto Sans/Serif JP）
- [x] DashboardLayoutを活用した全体レイアウト（日本語ナビ）
- [x] 案件一覧ダッシュボード（KPI・最近の案件カード）
- [x] 案件一覧ページ（検索・ステータス／緊急度フィルタ）
- [x] 案件新規登録フォーム（プレナスシステム項目対応）
- [x] 案件詳細ページ（タブ式：基本情報/チェックリスト/写真）
- [x] 業務フロー順チェックリスト（受付→現調→施工→完了、合計39項目）
- [x] チェック状態の永続化（メモ機能付き）
- [x] 写真アップロード機能（S3経由、複数枚対応）
- [x] 写真に工事項目（種別・大項目・作業内容・メモ）紐付け
- [x] 写真台帳PDF生成（印刷用CSS、A4・2枚／ページ）
- [x] 写真台帳印刷・PDF保存ボタン
- [x] レスポンシブ対応（スマホ・タブレット・PC）
- [x] vitestテスト（cases router・checklist template）

## 追加機能（v2）

- [x] DBスキーマ拡張：estimatedMaterialCost / estimatedLaborCost / actualCost / actualMaterialCost / actualLaborCost / invoiceNumber / surveyDate / constructionDate / completedAt
- [x] CSV一括インポート機能（/cases/import）
- [x] 見積書PDF出力（jsPDF + html2canvas）
- [x] 完了報告書PDF出力（ステータス「完了」で有効化）
- [x] 予実管理ページ（/budget）・予実サマリー・案件別一覧・予実編集ダイアログ
- [x] ダッシュボード（Home）に予実サマリーを追加
- [x] 案件一覧からワンクリックで写真台帳を開けるように
- [x] vitest追加（summary, bulkImportの3テスト）、全テストPASS
- [x] 担当者割当機能（案件詳細で社内担当者を選択、一覧で表示）
- [x] 「自分の案件」フィルタ（案件一覧に「担当者」選択・未割当・個人別フィルタを追加）

## 追加機能（v3）

- [x] ステータス自動遷移：チェックリストフェーズ全チェックで自動進行（受付→現調中、現調→見積中、施工→完了、完了→クローズ）、UIにトースト通知
- [x] 写真直撮りモード：environmentカメラ起動、タグ（現調/施工前A/B/施工後A/B/設置状況/メーカー型番）選択付きアップロード
- [x] 月次レポート：月別・店舗別集計・予実サマリー・CSV（BOM付UTF-8）ダウンロード
- [x] v3関連テスト追加（monthlyReportと自動遷移と1テストずつ、全テスト9件PASS）

## 追加機能（v4）

- [x] DBスキーマ拡張：partnersテーブル、cases.partnerId（v4で完了）
- [x] 協力会社マスタAPI（v4で完了）
- [x] 協力会社マスタ画面（v4で完了）
- [x] 案件詳細で協力会社を選択（v4で完了）
- [x] ワンタップ電話発信（v4で完了）
- [x] partnersテスト追加（v4で完了）

## v4完了

- [x] partnersテーブル＋cases.partnerIdカラム追加（DBマイグレ済）
- [x] 協力会社CRUD API（list/get/create/update/delete）
- [x] 協力会社マスタ画面（業種別バッジ・検索・絞込・追加/編集/削除）
- [x] 案件詳細での協力会社選択UI
- [x] ワンタップ電話発信（tel:リンクで代表・担当者携帯両方対応）
- [x] partners CRUDテスト追加、全10件PASS

## 追加機能（v5）

- [x] 業種自動推薦：案件の大項目・中項目から協力会社カテゴリをマッピング、PartnerSelectで推薦バッジと「推薦だけ表示/全業者表示」トグル
- [x] 協力会社の発注履歴API（partners.history）：案件一覧・案件数・完了件・見積・実績・ステータス別集計
- [x] 協力会社詳細ページ /partners/:id：基本情報 + サマリー4カード + ステータス別 + 案件テーブル
- [x] 協力会社一覧から詳細へのリンクボタン
- [x] v5テスト追加4件、全テスト14件PASS

## 追加機能（v6） ✅完了

- [x] 予実サマリーを管理者のみに表示（Homeの予実セクション・サイドバーメニュー・APIガード・AdminOnlyコンポーネント）
- [x] 予算 = 見積金額 × 75% の自動計算（shared/budget.tsで共通化、client/server両方で使用）
- [x] 予算消化率・差分を予算基準に統一（Home/BudgetActual/MonthlyReportに予算カラムと「予算（見積×75%）」表記を追加）
- [x] テスト追加4件、全テスト18件PASS（予算75%計算・一般ユーザーFORBIDDEN・summary・monthlyReport・差分ロジック）
## アプリ名変更（v7） ✅完了

- [x] アプリ名を「Store OSX」に変更（client/index.html title・ログイン画面・サイドバーヘッダ・Homeヒーロー）

## 追加機能（v8） ✅完了

- [x] 提供されたPDF（修理依頼システム）構造を解析、抽出フィールドを確定
- [x] PDFからの案件自動登録：アップロード→LLM抽出→プレビュー編集→登録（/cases/import-pdf）
- [x] 協力会社マスタのインポート：写真（OCR）・Excel・PDFから一括登録（/partners/import）
- [x] partners.bulkCreate / cases.uploadPdf テスト追加
- [x] 全テストPASS（22件）

## 追加機能（v9） ✅完了

- [x] estimatesテーブル追加（caseId, fileKey, url, mimeType, totalAmount, materialAmount, laborAmount, note, uploadedBy, createdAt）
- [x] 見積書アップロード（PDF/画像）+ LLMで金額抽出 → caseに紐付け
- [x] cases.estimatedCost の自動更新（見積書の合計金額）
- [x] 協力業者向け公開ページ /partner-view/[token]
- [x] 案件詳細にトークン生成ボタン＋共有リンクコピー
- [x] 進捗ステータス4区分（未対応 / 現調済 / 見積提出済 / 承認済）を導入：既存statusと別軸の progressStage 列を追加
- [x] 案件一覧をタブでフォルダ分け（未対応 / 現調済 / 見積提出済 / 承認済 / 全て）
- [x] 案件一覧の各行に担当者アバター＋名前バッジを表示（未割当は警告色）
- [x] vitest追加：estimates list / partnerView / 75%計算 / バリデーション
- [x] 全テストPASS（30件）

## 追加機能（v10）同一店舗の複数案件を可視化 ✅完了

- [x] 案件一覧の各カードに「同店舗 N件」バッジ
- [x] バッジクリックで同店舗の案件一覧ダイアログを表示
- [x] 「複数案件を抱える店舗」サマリーセクションをタブ下に表示
- [x] storeCode優先/フォールバックstoreNameの集約ロジックとvitest

## 追加機能（v11）店舗一覧画面 ✅完了

- [x] stores.list ルーターを追加
- [x] /stores ルートと StoresList ページを追加
- [x] サイドバーに「店舗一覧」リンクを追加
- [x] 検索/ソート/タブ（全店舗/複数案件/進行中あり）対応
- [x] vitest 追加・全テストPASS（38件）

## 追加機能（v12）担当2名の最適ルート提案＋編集可能スケジュール盤 ✅完了

- [x] route_assignments テーブルを追加（cases.lat/lngも追加・マイグレーション適用済）（caseId, team(A/B), date, sequence, taskType(survey/construction), notes, assigneeId）
- [x] サーバー: routes.suggest（推進スコアリング→チーム振分け→近接順ツアー→日付スケジューリング）（候補案件→住所ジオコード→2チーム振り分け+巡回順最適化→提案返却）
- [x] サーバー: routes.list / upsert / remove / applySuggestion（割り当て編集API）
- [x] サーバー: routes.geocodeMissing 案件の住所→緯度経度キャッシュ（cases.lat/lng列追加）
- [x] フロント: ScheduleBoardをHomeに追加
- [x] 提案一括反映・行単位編集・追加ボタン
- [x] vitest: route-planner 11件追加、全テストPASS（49件）

## 追加機能（v13）チーム担当者の割り当て ✅完了

- [x] team_settingsテーブル追加とマイグレーション
- [x] サーバー: teamSettings.list / upsert
- [x] applySuggestionでチームの代表担当者を自動でassigneeIdに設定
- [x] ScheduleBoardにチーム設定ダイアログ・チームヘッダアバター・タスク担当アバター・個別Select
- [x] vitest 4件追加・全テストPASS（53件）

## 追加機能（v14）スケジュール盤のドラッグ＆ドロップ ✅完了

- [x] HTML5 DnD でタスクを別チーム/別日付パネルへ移動
- [x] ドロップ先強調（リング+背景）/ ドラッグ中の不透明度低下 / 同位置ドロップは無視
- [x] ドロップ先末尾に sequence を自動付与、移動成功/失敗トースト
- [x] vitest 4件追加（routes.upsert の入力バリデーション）・全テストPASS（57件）

## 追加機能（v15）DnDで距離・所要時間自動再計算 ✅完了

- [x] 各チーム×日付パネルに総移動距離(km)と所要時間目安を表示
- [x] DnD後にlist再取得→useMemoで距離自動再計算（リアルタイム反映）
- [x] 未ジオコード件数を警告バッジで表示
- [x] ヘッダに「総距離 N.N km」サマリーを追加
- [x] vitest 5件追加（haversine対称性・東京駅↔横浜駅の妥当性等）・全テストPASS（62件）

## 追加機能（v16）担当者別ワークロード可視化 ✅完了

- [x] サーバー: workload.list ルーターを追加
- [x] /workload ページ + サイドバーメニューを追加（横棒グラフ + KPIカード + テーブル）
- [x] 期間プリセット（今週/向こう2週間/今月）で切替可能
- [x] 偏り警告：件数差≥3 または 距離差≥30km で「偏りあり」バッジ
- [x] vitest 4件追加・全テストPASS（66件）、ScheduleBoardのlat/lng読み取りバグも修正

## 追加機能（v17）見積書一括取込＋個別案件収支 ✅完了

- [x] estimates.extractAndMatch：PDF/画像をLLMで全項目抽出→既存案件と一致度スコアリング
- [x] estimates.bulkSave：複数見積書をまとめて保存（caseId確定分だけ）
- [x] /estimates/import ページ：複数ファイル→AI抽出→マッチテーブル→一括コミット
- [x] サイドバーに「見積書取込」リンクを追加
- [x] 案件詳細に「収支」タブ（売上・原価・粗利・粗利率と予実差）
- [x] vitest 8件追加・全テストPASS（78件）

## 追加機能（v18）見積書AI抽出→案件収支自動反映 ✅完了

- [x] pickLatestEstimate を純粋関数として shared/estimate-aggregator.ts に分離
- [x] estimates.uploadFile / update / bulkSave すべてで「同一案件の最新見積」を採用するロジックに統一
- [x] aggregator vitest 8件追加・全テストPASS（100件）

## 追加機能（v19）月別実績・担当者別成績・経費取込

- [x] expenses テーブル追加
- [x] cases.actualCost を expenses 合計で自動同期
- [x] expenses.uploadFile + extractAndMatch：AIで金額/業者/日付/カテゴリ/案件を抽出して自動振り分け
- [x] expenses.bulkSave / list / listByCase / listUnmatched / update / delete（いずれも syncCaseActualCost で cases.actualCost を再計算）
- [x] /expenses/import ページ（D&D 複数取込→マッチ表→一括登録）
- [x] 案件詳細に「経費」タブ（一覧表示・削除）
- [x] reports.monthly：月別 売上(見積×75%) / 原価(経費合計) / 粗利 / 件数 / 完了件数
- [x] reports.byAssignee：担当者別 件数 / 売上 / 原価 / 粗利 / 粗利率
- [x] /reports ページ（月別タブ＋担当者別タブ・BarChart/LineChart）＋サイドバー追加
- [x] vitest 13件追加（expense-router・reports.monthly・reports.byAssignee・集計ロジック）、全113件PASS

## v20 テストデータ整理＋UIブラッシュアップ

- [x] テスト案件（TEST-/AUTO-/SAMPLE-/履歴テスト/HIST-）と関連レコード（photos/estimates/expenses/route_assignments/partners）を全削除
- [x] 主要ページの見づらい箇所を洗い出し（薄字 muted-foreground/40, /60, text-[10px] のラベル、コントラスト、空状態）
- [x] 共通PageHeaderコンポーネントを新規作成し Reports/ExpenseImport に適用
- [x] 主要ページ（Home/CasesList/StoresList/Partners/CaseDetail写真・経費タブ）の空状態をアイコン＋見出し＋説明文の3段に統一
- [x] StoresList の極小ラベル（text-[10px]→text-[11px] font-medium）と KPI ラベルを読みやすく
- [x] Reports/CaseDetail経費の表に hover:bg-muted/30, font-medium ヘッダを適用
- [x] ログイン画面の説明文を text-foreground/80 に強化
- [x] vitest 全113件PASS確認、チェックポイント v20=ee016c4e 保存

## v22 案件マップ（住所をピン表示）

- [x] 案件マップページ /cases/map を新規作成（MapView利用、CasesMap.tsx）
- [x] cases.list の lat/lng を使い AdvancedMarkerElement（雫型SVGピン）で表示、複数時は fitBounds
- [x] lat/lng 未取得分は routes.geocodeMissing を呼ぶ「位置情報を取得」ボタン（未取得件数バッジ付き）
- [x] 左サイドリスト↔地図ピンを連動（focusCaseで panTo+zoom+InfoWindow、選択中ハイライト）
- [x] 緊急度でピン色分け（S赤/A橙/B黄/C緑）、凡例表示、位置未取得は警告アイコン付きで一覧に表示
- [x] 検索（店舗/依頼番号/住所）・緊急度・進捗フィルタ
- [x] DashboardLayout サイドバーに「案件マップ」追加 + App.tsx ルート登録
- [x] 型チェック OK、vitest v22 5件追加全118件PASS、テスト残骸をDBから再授清

## v23 案件マップ ピンずれ修正＋InfoWindow編集ボタン

- [x] 広域ズーム時のピンずれを修正：pinSvgの translate(-50%,-100%) を削除し、createPinElement（line-height:0/display:block）で AdvancedMarkerElement の既定アンカー（下端中央）に任せた
- [x] InfoWindowを setContent(DOM) 方式に変更し「案件詳細を編集→」ボタンを追加、clickで setLocation(`/cases/${id}`)
- [x] 型チェック OK、vitest全118件PASS、テスト残骸をDBから再授清

## v24 案件マップ吹き出し 現場向けクイックアクション

- [x] CaseRow に storePhone を追加（cases.list が返す店舗電話を利用）
- [x] InfoWindow に「電話する」（tel:）ボタンを追加（有効な番号がある時のみ表示）
- [x] InfoWindow に「地図アプリで開く」（Googleマップ経路案内、住所優先・無ければ座標）ボタンを追加
- [x] URL生成ロジックを shared/map-actions.ts に純粋関数として切り出し（normalizePhone / buildTelHref / buildMapDirectionsHref）
- [x] vitest 7件追加（v24）、全125件PASS、テスト残骸をDBから再清掃

## v25 案件詳細にプレナス提出見積額・協力業者見積額の入力

- [x] cases に plenusQuoteAmount（プレナス提出見積額＝売上）カラムを追加しマイグレーション適用（0008_fast_veda.sql）
- [x] cases.update に plenusQuoteAmount / estimatedCost（協力業者額）を手入力で保存できるよう対応
- [x] 案件詳細「収支」タブに金額入力カード（プレナス提出額・協力業者額・原価＝協力業者額＋経費）を追加
- [x] 粗利＝プレナス提出額−原価。プレナス額未入力時は協力業者額÷0.75でフォールバック表示
- [x] 写真と金額が同じ収支タブで一覧できるよう配置
- [x] 収支計算ロジックを shared/profit.ts に純粋関数として切り出し（calcSales / calcCost / calcCaseProfit）
- [x] reports.monthly を新定義に修正（売上＝プレナス提出額、原価＝協力業者額＋経費）
- [x] reports.byAssignee を新定義に修正（同上）
- [x] Reports.tsx の説明文・空状態文言を新定義に更新
- [x] vitest追加（profit.test.ts 13件・cases.test.ts の新定義テスト）、型チェック OK、全138件PASS
- [x] テスト残骸（TEST-/HIST-/AUTO- 案件とテストパートナー）をDBから削除、チェックポイント保存

## v26 PDF案件取込のエラー対策（堅牢化）

- [x] LLM応答のJSONパースを堅牢化（Markdownコードフェンスや前後説明文を除去してから抽出）
- [x] パース失敗時はエラーにせず、抽出できた範囲＋手入力可能な状態（parseFailedフラグ＋rawText）にフォールバック
- [x] LLM応答が空のときは「読み取れませんでした」と分かりやすいメッセージを返す
- [x] parseFailed 時はフロントで警告トーストを出して手入力フォームを開く（CasePdfImport.tsx）
- [x] 抽出ロジック（contentToText / stripCodeFences / extractFirstJsonObject / parseLlmJson）を shared/extract.ts の純粋関数に切り出し
- [x] vitest追加（extract.test.ts 19件：コードフェンス/説明文混在/壊れたJSON/空応答/ネスト）
- [x] 型チェック OK、全157件PASS、テスト残骸をDBから削除、チェックポイント保存

## v27 PDF内の現況写真を自動抽出して保存

- [x] Node専用環境での抽出方式を検証（pdfjs-dist で埋め込み画像取得 + jpeg-js でJPEGエンコード、実物PDFで4枚抽出確認）
- [x] サーバー: server/_core/pdfImages.ts に extractPdfEmbeddedImages(buffer) を実装（pdfjs-dist+jpeg-js、200px未満除外・上限枚数・重複除去）
- [x] サーバー: cases.extractPhotosFromPdf 手続きを追加（fileKey受取→画像抽出→storagePut→photos(現調)へ保存→保存結果返す）
- [x] フロント: 案件登録後に自動で現況写真抽出を実行し、抽出枚数をトースト表示
- [x] フロント: 抽出した現況写真をサムネイル一覧でプレビュー、各写真に削除ボタン（楽観的更新）
- [x] 案件詳細の写真タブから閲覧できる（現調タイプで保存、E2E検証でlistByCase確認済）
- [x] vitest追加（pdfImages.test.ts 4件：実物PDFで4枚抽出/最小サイズ除外/maxImages制限/画像なしPDF）
- [x] 型チェック OK、全161件PASS、本番経路のE2E検証もOK（テスト残骸は自動削除）、チェックポイント保存

## v28 経費の案件/全体の入れ分け・費目拡張・立替者別集計・カメラ取込

- [x] expensesスキーマに scope（"案件" | "全体"）を追加（デフォルト"案件"）
- [x] category を拡張：材料費/外注費/交通費/消耗品/その他 に加え 車両費/宿泊費/接待交際費 を追加
- [x] マイグレーション生成→SQL適用（scope列ADD＋category enum拡張、既存データは scope="案件" 互換）
- [x] db: createExpenseでscope保存、listExpensesForAggregation、syncCaseActualCostをscope=案件に限定
- [x] サーバー: expenses.saveGeneral（全体経費保存、案件不要、scope=全体固定）手続きを追加
- [x] サーバー: expenses.byUser（期間・案件/全体内訳・区分内訳つき、立替者別合計、管理者のみ）手続きを追加
- [x] 集計ロジックを shared/expense-aggregate.ts の純粋関数に切り出し（aggregateExpensesByUser/isWithinRange）
- [x] フロント: 経費取込で各行を「案件 / 全体」で切替、全体は案件未選択でも登録可（bulkSave/saveGeneralに振り分け）
- [x] フロント: 取込に「カメラで撮影」を追加（capture属性でスマホカメラ起動）
- [x] フロント: 立替者別経費レポート画面を追加（期間切替・KPI・立替者カード・区分マトリクス、管理者のみ）
- [x] vitest追加（expense-aggregate.test.ts 16件）、型チェック OK、全177件PASS、本番経路E2E検証OK（残骸削除）、チェックポイント保存

## v29 案件詳細のPDFダウンロードでoklchエラー修正

- [x] 原因特定: html2canvas が Tailwind4 の oklch 色（継承CSS変数含む）を解釈できずエラー
- [x] html2canvas を oklch 対応の html2canvas-pro に置き換え
- [x] documentPdf.ts（見積書・完了報告書）のimportを差し替え
- [x] PhotoLedger.tsx（写真台帳）のimportを差し替え
- [x] 型チェックOK・本番ビルド成功・サーバー再起動
- [x] 実ブラウザ検証: oklch継承要素を html2canvas-pro でエラーなく canvas 生成（696x406）
- [x] 検証用ファイル削除・チェックポイント保存
## v30 PDF案件取込画面に見積金額（出し見積・実行指値）の手入力を追加
- [x] CasePdfImport.tsx の Extracted 型に plenusQuoteAmount（出し見積）と estimatedCost（実行指値）を追加（string管理）
- [x] 抽出結果フォームに「プレナス出し見積額」「実行（指値）見積額」の数値入力欄を追加（任意・円単位・空欄でも登録可）
- [x] handleRegister で createMutation に plenusQuoteAmount / estimatedCost / is10mYen を含めて送信
- [x] extractFromPdf の LLM スキーマ・プロンプトに見積金額の抽出指示を追加（読み取れた場合は自動入力）
- [x] shared に金額文字列→数値の純粋関数 parseAmount を追加しテスト（全角・カンマ・円記号許容、計25件に拡充）
- [x] 型チェックOK・全183件PASS・チェックポイント保存

## v31 案件一覧に出し/実行/粗利を表示
- [ ] CasesList の各案件カードに「出し見積額」「実行見積額」「粗利（率）」のミニブロックを追加
- [ ] 粗利は出し−実行で計算（出し未入力かつ実行ありの場合は想定売上÷0.75ベースで算出し想定表示）
- [ ] 粗利の符号で色分け（黒字=emerald / 赤字=red / 0=muted）
- [ ] shared/profit.ts の calcCaseProfit を流用（expensesTotal=0で一覧用の即時粗利）
- [ ] 型チェックOK・全テストPASS・チェックポイント保存
