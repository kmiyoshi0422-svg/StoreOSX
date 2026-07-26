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
- [x] CasesList の各案件カードに「出し見積額」「実行見積額」「粗利（率）」のミニブロックを追加
- [x] 粗利は出し−実行で計算（出し未入力かつ実行ありの場合は想定売上÷0.75ベースで算出し想定表示）
- [x] 粗利の符号で色分け（黒字=emerald / 赤字=red / 0=muted）
- [x] shared/profit.ts の calcCaseProfit を流用（expensesTotal=0で一覧用の即時粗利）
- [x] 型チェックOK・全テストPASS・チェックポイント保存

## v32 進捗ステージとステータスを連動
- [x] shared/stageStatus.ts に連動マッピング純粋関数を追加（stage→status, status→stage）
- [x] 連動関数の単体テストを追加（11件、双方向・逆行しない方針を検証）
- [x] サーバー cases.update でステージ/ステータスのどちらか変更時にもう片方を整合（明示指定がない場合のみ補完）
- [x] チェックリスト自動ステータス前進時に progressStage も連動更新
- [x] CaseDetail 編集UIでステージ選択時にステータスも追従（その逆も）
- [x] 型チェックOK・全194件PASS・チェックポイント保存

## v33 チームに複数メンバーを登録・選択できるように
- [x] drizzle schema に team_members テーブルを追加（team, userId, ユニーク制約）
- [x] pnpm drizzle-kit generate でマイグレーション生成→webdev_execute_sqlで適用
- [x] db.ts に listTeamMembers / setTeamMembers（差し替え）ヘルパ追加
- [x] routers.ts teamSettings に members の取得・更新を追加（list返却にmemberIds含める）
- [x] ScheduleBoard のチーム担当者ダイアログに「メンバー（複数選択可）」UIを追加
- [x] 型チェックOK・全197件PASS・チェックポイント保存

## v34 タスク担当の選択肢をチームメンバーに限定
- [x] ScheduleBoard でチーム別メンバーID集合を teamSettingsQ.data.A/B.memberIds から算出（buildTeamMemberIdSet）
- [x] タスク担当Selectの選択肢を所属チーム（item.team）のメンバーに絞り込む（filterAssigneeOptions）
- [x] 現担当がメンバー外（旧データ）の場合は現担当を選択肢に残すフォールバック
- [x] メンバー未設定チームは全ユーザーから選べるフォールバック
- [x] 純粋関数を shared/teamAssignee.ts に切り出し、テスト9件追加
- [x] 型チェックOK・チェックポイント保存

## v35 写真台帳PDFのTainted canvasエラー修正
- [x] 写真画像をPDF生成前にfetch→Blob→dataURLへ変換し、汚染源の外部画像をDOMから排除
- [x] 各imgのsrcをdataURLに差し替えた後にhtml2canvasを実行（finallyで元に戻す）
- [x] 画像読み込み完了を待つ（decode）
- [x] 取得失敗画像はプレースホルダ表示で生成継続
- [x] fileUrlが同一オリジン相対パス（/manus-storage/...）であることを確認
- [x] 型チェックOK・チェックポイント保存

## v36 EXIF回転補正と複数案件の写真台帳一括PDF
- [x] 写真アップロード処理の現状を調査（クライアント/サーバーどちらで処理しているか）
- [x] アップロード時にEXIF Orientationを読み取り、canvasで正立化してから保存
- [x] 既存写真の表示でも横倒しを防ぐ（必要に応じてimage-orientation: from-image / 表示側補正）
- [x] 複数案件を選択して写真台帳を一括PDF出力する画面を追加
- [x] 一括PDFは案件ごとにページ区切り（既存PhotoLedgerのレイアウトを流用）
- [x] 型チェックOK・全テストPASS・チェックポイント保存


## v37 現場調査報告書／施工完了報告書PDF（プレナス責任者サイン付き）
- [x] case_signatures テーブルを追加（caseId, reportType=survey|completion, signerName, signedAt, fileKey/fileUrl=署名画像）
- [x] drizzle-kit generate → webdev_execute_sql でマイグレーション適用
- [x] db.ts に署名の upsert / get（caseId+reportType）ヘルパを追加
- [x] routers.ts に signatures.save（署名画像をstoragePutでS3保存）/ signatures.getByCase を追加
- [x] 手書き署名パッド（canvas）コンポーネントを作成（指/マウス対応・クリア・確定）
- [x] CaseDetail に「現場調査報告書PDF」「施工完了報告書PDF」出力ボタンを追加
- [x] 現場調査報告書PDF：案件基本情報＋現調写真（photoType=現調/施工前系）＋署名欄
- [x] 施工完了報告書PDF：案件基本情報＋施工後写真（photoType=施工後系）＋署名欄
- [x] 署名はDB/S3に保存し、再出力時も同じ署名を埋め込む（PDF生成前にdataURL化）
- [x] 型チェックOK・全テストPASS（223件）・チェックポイント保存

## 案件一覧の県別表示
- [x] 住所→都道府県判定ユーティリティ（shared/prefecture.ts）＋テスト
- [x] CasesList に「県別表示」トグルと県フィルタを追加
- [x] 県別表示ON時に県見出し（県名＋件数）でカードをグルーピング表示
- [x] カード描画を共通化し通常表示と県別表示で再利用
- [x] 型チェック・全テストPASS（230件）・チェックポイント保存

## 都道府県を独立入力項目化
- [x] cases テーブルに prefecture カラムを追加しマイグレーション適用
- [x] 登録/編集API・zodバリデーションに prefecture を反映（未入力時は住所から自動補完）
- [x] 登録/編集フォームに都道府県セレクトを追加（住所からの自動推定補助つき）
- [x] 県別分類ロジックを prefecture カラム優先（無ければ住所判定）に変更
- [x] prefecture 優先の分類テストを追加・型チェックOK・全テストPASS（234件）・チェックポイント保存

## 県別表示を地方（エリア）単位で二段グルーピング＋折り畳み
- [x] 地方マッピングユーティリティ（regionOfPrefecture / regionSortIndex）＋テスト
- [x] CasesList を 地方→県 の二段グルーピングに改修
- [x] 地方ごとに折り畳み（アコーディオン）できるようにする
- [x] 型チェックOK・全テストPASS（239件）・チェックポイント保存

## 報告書の写真を後から編集できるようにする
- [x] 報告書画面に「掲載写真の管理」パネルを追加（プレビューには表示、PDFには出さない）
- [x] 写真の追加（ファイル選択／カメラ）— 報告書種別に応じた区分を初期選択
- [x] 写真の区分変更（差し替え相当：現調/施工前/施工後/設置状況など）
- [x] 写真の削除
- [x] 写真の並び替え（上下移動 orderNo 更新）
- [x] 型チェックOK・全テストPASS（239件）・チェックポイント保存

## 報告書写真管理の強化（次ステップ3点）
- [x] 各写真にコメント（工事項目/メモ）をその場で編集できる入力欄を追加
- [x] コメントを報告書PDF（プレビュー）にも反映
- [x] ドラッグ&ドロップで写真を並び替えできるUI（上下ボタンは維持）
- [x] 1ページあたりの掲載枚数（4枚/6枚）切替オプション
- [x] 型チェックOK・全テストPASS（239件）・チェックポイント保存

## 写真の拡大プレビュー（ライトボックス）
- [x] 共通ライトボックスコンポーネント（Lightbox）を作成（クリックで拡大、Esc/背景クリックで閉じる、複数枚は前後送り）
- [x] CaseDetail の写真グリッドに適用
- [x] CaseReport の管理パネル・PDFプレビュー写真に適用
- [x] 型チェックOK・全テストPASS（239件）・チェックポイント保存

## 不具合: PDFダウンロードで写真が写らない
- [x] 原因をブラウザで検証（credentials:"include"のため5xxリダイレクト先S3へのfetchがFailed to fetch）
- [x] toDataUrl の credentials を外し redirect:follow に修正
- [x] tRPC media.toDataUrl を追加しサーバーで base64 化するフォールバック化
- [x] inlineImages を堅牢化（直fetch→サーバーAPIの2段）
- [x] PDF生成で写真が出ることを検証・型チェック・全テストPASS・チェックポイント保存（本番ビルド成功・全245テストPASS、trpcVanillaエラーは過去キャッシュログで現在は未発生）

- [x] 写真の向き（回転）を変更できる機能
  - [x] photosテーブルに rotation カラム追加（マイグレーション適用）
  - [x] photos.update API で rotation を受付（0/90/180/270 バリデーション）
  - [x] 案件詳細の写真カードに回転ボタン＋表示反映
  - [x] 報告書（写真管理パネル）に回転ボタン＋表示反映
  - [x] ライトボックス拡大表示に回転反映
  - [x] 写真台帳PDF・一括台帳PDF・報告書PDFに回転反映
  - [x] rotation バリデーションの vitest を追加

## 写真回転UIの左右対応 + 報告書PDF様式統一
- [x] 写真カードに左回転ボタンを追加（案件詳細）
- [x] 写真管理パネルに左回転ボタンを追加（報告書）
- [x] 左右の回転方向が直感的に分かるUI（左右アイコン並列）
- [x] 左回転で 0→270→180→90→0 と循環する状態管理
- [x] 報告書PDFの左右余白を狭め本文領域を広く（括弧・数字のズレ解消、余白14mm×12mm）
- [x] 報告書PDFを参考様式（現地調査報告書）に近い体裁へ統一（濃紺帯見出し・整列表）
- [x] 印刷して手書きサインする運用に対応（未署名でも崩れない確認欄＝責任者/先方の記入枠）
- [x] 型チェック・全テストPASS（245件）・チェックポイント保存

## 案件マップ：完了案件の除外（DBは保持）
- [x] マップのピン・一覧から「完了」「クローズ」案件を除外
- [x] 除外件数の表示と、完了案件も表示するトグルの追加
- [x] DBは削除せず保持されることをコメント・UIで明示
- [x] 型チェック・全テストPASS（245件）・チェックポイント保存

## ダッシュボードKPIカードから案件一覧へ遷移
- [x] 案件一覧をURLクエリ(status/urgency)で初期フィルタ可能にする
- [x] 案件一覧にステータス絞り込み（進行中/完了など）を追加
- [x] アクティブフィルタのチップ表示とクリアボタン
- [x] ダッシュボードの4KPIカードをクリック可能にし該当一覧へ遷移
- [x] 型チェック・全テストPASS（250件）・チェックポイント保存

## 報告書PDFのA4縦統一と様式見直し
- [x] 報告書PDFを全ページA4縦固定で出力（report-pageを210×297mmに正確固定、出力595×842pt）
- [x] 1ページ目の情報表・見出し・余白を見本PDFに近い体裁へ再調整（flex縦レイアウトで確認欄を下部固定）
- [x] 写真ページをA4縦内に収まる固定高グリッドへ（object-containで切れない、perPageに応じた行高固定）
- [x] 工事完了報告書と現地調査報告書の両方で同じA4縦基準を適用（両方で比率1.414確認）
- [x] 署名欄・確認欄を手書き運用しやすい寸法へ再調整
- [x] 型チェック・全テストPASS（250件）・チェックポイント保存

## 参考PDF所見の保存
- [x] 見本PDFのレイアウト要点を notes に保存し、改修基準として参照可能にした

## 施工完了報告書のビフォーアフター比較を自動組み込み
- [x] 完了報告書で現調(施工前)写真と施工後写真を比較ペア化するロジックを追加
- [x] ペアリングは工事項目(workItem)優先、無ければ出現順、片側欠落は「該当なし」プレースホルダ
- [x] 完了報告書の写真ページを左=施工前/右=施工後の比較レイアウトに（A4縦固定高）
- [x] 写真管理パネルに現調/施工前の写真区分を追加し、施工前写真の取り込み導線を整理
- [x] 現場調査報告書(survey)は従来の羅列を維持
- [x] ペアリング純粋関数のユニットテスト追加（server/beforeAfter.test.ts）
- [x] 型チェック・全テストPASS（264件）・チェックポイント保存

## 完了報告書の写真管理に施工前/施工後のグループ見出しを追加
- [x] 写真管理パネルで完了報告書時に「BEFORE 施工前（現調）」「AFTER 施工後」のグループ見出し（枚数バッジ付）を表示
- [x] 各グループ内でドラッグ＆ドロップ/上下ボタン並び替えができるようにする
- [x] グループをまたいだ移動（区分Select変更）で区分(photoType)とグループが更新される（実機検証済）
- [x] 空グループは「ここにドラッグすると「施工後」に移します」のドロップ受け皿を表示
- [x] survey（現場調査報告書）は従来の単一リストを維持
- [x] 自動ビフォーアフター比較の残存ロジック(buildBeforeAfterPairs等)を完全撤去し羅列に統一
- [x] 型チェック【PASS】・全テストPASS【250件】・検証データ復旧・チェックポイント保存

## 完了報告書を参考PDF（株式会社小林工房テンプレート）に統一
- [x] 会社・施工者・提出先を固定値で埋め込み（shared/completionReport.ts の COMPANY_INFO）
- [x] AI本文生成（reportDraft.generate）：金額に触れず、断定が必要な原因は空欄、写真キャプション短文を自動生成
- [x] 生成結果は case_report_drafts に保存し再読込でも保持（get/save）
- [x] 完了報告書専用コンポーネント CompletionReport.tsx を新規作成しルート差し替え
- [x] 参考PDF準拠の全13ページ構成（表紙→提出者→物件情報/工事概要→工事範囲/評価表→Before/Process/After写真→採寸/材料/手順→結論/点検/周辺リスク）
- [x] 各セクション・採寸・材料・手順・点検計画・周辺リスクは行追加/編集可、空欄は非表示
- [x] 写真は現調=Before/施工中=Process/施工後=After に区分、グループ見出し＆D&D維持
- [x] 型チェック【PASS】・全テストPASS【7件のreportDraftテスト含む】・実機でAI生成/保存/永続化/レイアウト確認

## 名前・会社名・数字全角化・括弧除去（ユーザー指示）
- [x] 「下川」→「三好 慶」確認（既に三好 慶／株式会社小林工房で設定済み・残存なし）
- [x] 完了報告書PDFの章番号・ページ番号を全角数字に統一（SectionBar/PageFrame）
- [x] 完了報告書PDFの丸括弧を除去（見出し・本文・キャプション既定文）
- [x] 現場調査報告書（CaseReport）PDFの数字全角化・丸括弧除去
- [x] AIプロンプト（routers.ts）も括弧不使用で生成するよう調整
- [x] reportTextユーティリティとvitest追加（11件）
- [x] 型チェック・LSPエラーなし、全テスト268件PASS確認

## 他のPDF出力画面の表記統一（ユーザー指示）
- [x] 見積書PDF（documentPdf.ts buildQuoteHTML）の数字全角化・丸括弧除去（金額・税率・見積番号・工事種別区切り）
- [x] 完了報告書PDF（documentPdf.ts buildCompletionHTML）の数字全角化・丸括弧除去
- [x] 写真台帳（PhotoLedger.tsx）表紙・ページ番号・キャプションの全角化・括弧除去
- [x] 写真台帳一括（PhotoLedgerBatch.tsx）表紙・ページ番号・キャプション・一覧UIの全角化・括弧除去
- [x] 保存ファイル名の数字も全角に統一
- [x] 型チェック・全テスト268件PASS確認

## 全角化の除外辞書機能（ユーザー指示）
- [x] reportTextにメールアドレス・URL・型番風トークンの自動保護ロジックを追加
- [x] ユーザー登録の除外語リストを受け取り、該当部分を半角のまま保持する仕組みを実装
- [x] 除外辞書のDBテーブル（fullwidth_exclusions）を追加しマイグレーション適用
- [x] tRPC（一覧・追加・削除）を追加
- [x] 除外辞書の管理UIページを追加しナビに登録
- [x] 各PDF出力（documentPdf/PhotoLedger/PhotoLedgerBatch/CompletionReport/CaseReport）で除外辞書を読み込んで適用
- [x] reportText用vitestを更新（保護ケース追加、全19件PASS）
- [x] 型チェック・全テスト276件PASS確認
- [x] ブラウザで登録・一覧・削除・プレビュー動作確認

## 画面表示の丸括弧除去（システム全体で統一）（ユーザー指示）
- [x] 画面表示のユーザー可視テキストの丸括弧を精査（コメント・正規表現・IME判定など内部コードは除外）
- [x] 予実サマリー「予算・見積×75%」の括弧除去（Home/BudgetActual）
- [x] ダッシュボード・BudgetActual・MonthlyReport・Reports等の表示ラベルの括弧除去
- [x] 各一覧・取込画面（CasesList/CaseDetail/CsvImport/Partners/CasePdfImport/PartnerImport/PartnerView/StoresList/Workload/EstimateImport/ExpenseImport/CasesMap/ExpenseByUser/ScheduleBoard等）の表示テキストの括弧除去
- [x] 型チェック・全テスト276件PASS確認
- [x] ナビゲーション・サイドバー表示を確認

## 全PDF出力をA4縦・余白狭めに統一（ユーザー指示）
- [x] CompletionReport: padding 14mm→08mm 10mm
- [x] CaseReport: padding 14mm 12mm→08mm 10mm、写真グリッド高さ248mm→265mm
- [x] documentPdf（見積書・完了報告書HTML→PDF）: padding 48px→24px
- [x] PhotoLedger / PhotoLedgerBatch: 印刷時padding 20mm 18mm→08mm 10mm、画面表示p-12/p-10→p-6
- [x] 型チェック・全276テストPASS確認

## PDF内フォントサイズ・行間・パディング最適化（ユーザー指示）
- [x] documentPdf: body 13px→14px, th/td py-1→2, 見出し 16px→18px, 行間 leading-[1.7]
- [x] CompletionReport: SectionBar 13→14px, Body 11→11.5px, InfoRow 10→11px, ヘッダー 9→10px, フッター 8→9px, タイトル 30→32px
- [x] CaseReport: SectionBand 13→14px, テーブル 12→12.5px, th/td py-1.5→2, 本文 leading-[1.7], タイトル 26→28px, 写真キャプション 11→11.5px
- [x] PhotoLedger/Batch: 写真情報 text-xs→13px, ラベル 9→9.5px, LedgerRow dt 10→10.5px / dd sm→14px, タイトル 3xl→32px
- [x] 型チェック・全276テストPASS確認

## PDF改ページ位置の最適化（ユーザー指示）
- [x] CompletionReport: 後半セクション（採寸〜署名）を動的ページビン詰め分割（tailSections配列＋PAGE_CONTENT_HEIGHT_MM=260mmで分割）
- [x] CaseReport: 1ページ目を本文長さで動的2ページ分割（800文字超または15行超で分割）
- [x] documentPdf（見積書・完了報告書HTML→PDF）: htmlToPDF関数を複数ページ分割対応に改修（キャンバス高さがA4超の場合に自動分割）
- [x] PhotoLedger/Batch: 固定高グリッド＋perPage連動で既にページ境界での切れなし（対応済み）
- [x] 型チェック・全276テストPASS確認

## 写真区分に「施工中」追加（ユーザー指示）
- [x] 写真のphase enum に「process」を追加（DB schema）
- [x] 写真区分セレクトボックスに「施工中」選択肢を追加（フロントエンド）
- [x] CompletionReport/PhotoLedgerで「施工中」写真を正しく表示
- [x] CaseReport写真区分でも「施工中」を選択可能に

## 現調報告書に「所感」欄追加（ユーザー指示）
- [x] cases テーブルに surveyImpression（所感テキスト）と surveyImpressionAuthor（記入者）カラム追加
- [x] 現調報告書（CaseReport）UIに所感の自由記入テキストエリア追加
- [x] 所感欄にAI文章生成ボタンを追加
- [x] 記入者を自由入力できるテキストフィールドを追加
- [x] 所感をPDF出力に反映（「所感」セクションバンド＋本文＋記入者名表示）

## 完了報告書 グループ内写真DnD並び替え（ユーザー指示）
- [x] BEFORE/施工中/AFTERの各グループ内でドラッグ＆ドロップによる写真並び替えを実装
- [x] ドラッグ中のビジュアルフィードバック（ドラッグ対象の半透明化+縮小、ドロップ先のハイライト+拡大、挿入位置インジケーター）
- [x] ドロップ後にorderNoを更新してサーバーに永続化
- [x] 型チェック・全276テストPASS確認

## タッチ操作DnD対応（ユーザー指示）
- [x] スマホ・タブレットでロングプレス→ドラッグで写真並び替え可能にする
- [x] タッチ中のビジュアルフィードバック（振動・ハイライト）
- [x] 既存のデスクトップDnDと共存させる

## 所感AI生成プロンプトカスタマイズ（ユーザー指示）
- [x] app_settingsテーブルにAI生成設定（トーン・文章量）を保存
- [x] 設定画面にAI生成のトーン選択（丁寧/標準/簡潔）と文章量（短め/標準/長め）を追加
- [x] 所感AI生成時に設定を反映したプロンプトを使用

## 記入者プリセット登録（ユーザー指示）
- [x] app_settingsテーブルに記入者プリセットリストを保存
- [x] 設定画面で記入者名のマスタ登録（追加/削除）UI
- [x] 所感欄の記入者入力をドロップダウン（プリセット選択）＋自由入力の併用に変更

## 施工中写真タイムスタンプ（ユーザー指示）
- [x] photosテーブルにtakenAtカラム追加（撮影日時）
- [x] 施工中写真アップロード時にtakenAtを自動記録（アップロード時刻）
- [x] 案件詳細の写真カードに撮影日時を表示

## 施工中写真タイムライン表示（ユーザー指示）
- [x] 案件詳細の写真タブに「タイムライン」ビュー切替を追加
- [x] 施工中写真をtakenAt順に縦型タイムラインで表示（日時・写真・メモ）
- [x] タイムラインのビジュアルデザイン（縦線+ノード+カード）

## 写真一括区分変更（ユーザー指示）
- [x] 写真カードに選択チェックボックスを追加
- [x] 「全選択」「選択解除」ボタン
- [x] 選択した写真の区分を一括変更するアクションバー（BEFORE/施工中/AFTER選択）
- [x] サーバーに一括更新APIを追加（photos.bulkUpdateType）

## 所感テンプレート登録・挿入（ユーザー指示）
- [x] app_settingsに所感テンプレートリストを保存
- [x] 設定画面にテンプレート登録UI（追加・削除）
- [x] 所感入力欄にテンプレートボタンを追加（ワンクリック挿入）

## タイムライン日付グルーピング（ユーザー指示）
- [x] 施工中写真をtakenAtの日付でグループ化するロジックを追加
- [x] 同日の写真をまとめて「YYYY年MM月DD日（曜日）」の日付ヘッダーでグループ化
- [x] 各日付グループ内に複数の写真カードをグリッド表示
- [x] 日付グループ間に縦線を引き、日付ノード（日付入り円）→写真カード群の構造
- [x] takenAtがnullの写真は「日時不明」グループとして末尾に表示
- [x] グループ間の経過日数を表示

## 案件詳細スケジュール（工程管理）タブ追加（ユーザー指示）
- [x] case_schedulesテーブル追加（caseId, title, startDate, endDate, status, color, memo, orderNo）
- [x] DBマイグレーション適用
- [x] tRPCルーター追加（schedules.listByCase / create / update / delete）
- [x] 案件詳細にスケジュールタブを追加
- [x] 工程をガントチャート風に横棒で表示（日付軸）
- [x] 工程の追加・編集・削除UI
- [x] 工程のステータス管理（予定/進行中/完了）
- [x] 型チェック・テストPASS

## 工程スケジュール進捗率表示（ユーザー指示）
- [x] case_schedulesテーブルにprogressカラム（int, 0-100）を追加
- [x] tRPCルーターのcreate/updateにprogress対応追加
- [x] ScheduleTabフォームに進捗率スライダー追加
- [x] ガントチャートのバー内に進捗率を色分けで視覚表示
- [x] 工程一覧リストにも進捗率を表示
- [x] 型チェック・テストPASS

## ガントチャートドラッグ&ドロップ（ユーザー指示）
- [x] ガントバーの左右ドラッグで全体移動（開始日・終了日を同時にシフト）
- [x] バー左端ドラッグで開始日変更
- [x] バー右端ドラッグで終了日変更
- [x] ドラッグ中のビジュアルフィードバック（プレビュー表示）
- [x] ドロップ時にupdateMutで日付をサーバーに保存
- [x] 型チェック・テストPASS

## PDF出力バグ修正（ユーザー報告） ✅完了
- [x] 文字化け修正: document.fonts.ready待ちを全PDF生成箇所に追加
- [x] 文字切れ修正: sr-onlyコンテナをposition:fixed+opacity:0に変更
- [x] 写真非表示修正: inlineImages共通ヘルパーに統一（credentials:omit+サーバーフォールバック）
- [x] html2canvasオプション最適化（windowWidth, allowTaint:false）
- [x] 写真台帳・現調報告書・完了報告書・工事完了報告書・見積書すべてに適用
- [x] 型チェック・テストPASS（276件）

## PDFプレビュー機能追加（ユーザー指示） ✅完了
- [x] 共通PDFプレビューモーダルコンポーネントを作成
- [x] 写真台帳（PhotoLedger）にプレビューボタン追加
- [x] 現調報告書（CaseReport）にプレビューボタン追加
- [x] 工事完了報告書（CompletionReport）にプレビューボタン追加
- [x] 写真台帳一括（PhotoLedgerBatch）にプレビューボタン追加
- [x] プレビューモーダルからPDFダウンロードも可能に
- [x] 型チェック・テストPASS（276件）

## PDFプレビューに印刷ボタン追加（ユーザー指示） ✅完了
- [x] PdfPreviewModalに印刷ボタンを追加
- [x] 新しいウィンドウでA4レイアウトの印刷プレビューを開き、ブラウザ印刷ダイアログを呼び出す
- [x] 全ページを印刷対応（page-break-afterで自動改ページ）
- [x] 型チェック・テストPASS（276件）

## PDFプレビューのズーム機能強化（ユーザー指示） ✅完了
- [x] ズーム範囲を25%〜400%に拡大（従来50%〜200%）
- [x] ズームプリセットドロップダウン追加（50/75/100/125/150/200/300%）
- [x] Ctrl+マウスホイールでスムーズズーム対応
- [x] Ctrl++/-/0キーボードショートカット対応
- [x] ズーム時にドラッグでパン（表示位置移動）可能
- [x] 「幅に合わせる」ボタン追加（Maximize2アイコン）
- [x] ズーム時にヒントバー表示（操作方法ガイド）
- [x] プレビュー生成品質をscale:2に向上（文字の細部確認用）
- [x] 型チェック・テストPASS（276件）

## 現調報告書の所感欄を最後に移動（ユーザー指示） ✅完了
- [x] 所感欄を確認欄の後（最後）に移動し、途切れないようにする
- [x] 型チェック・テストPASS（276件）

## テストデータ削除・タブ表示修正（ユーザー指示） ✅完了
- [x] テスト案件29件を削除（関連写真・見積書・スケジュール・経費も削除）
- [x] テスト協力会社30件を削除
- [x] 案件詳細タブの文字かぶりを修正（grid-cols-7 → flex flex-wrap 2行折り返し）
- [x] 型チェック・テストPASS（276件）

## タブ横スクロール化・Googleカレンダー連動調査（ユーザー指示）
- [x] 案件詳細タブを横スクロール可能なデザインに変更（スマホ対応）
- [x] Googleカレンダー連動の実現可能性を調査・提案

## Googleカレンダー連動・ICS方式・モバイル最適化（ユーザー指示）
- [x] ICSフィードエンドポイント実装（/api/calendar/feed/:token.ics）
- [x] 案件別・全件のICSフィード生成
- [x] カレンダー購読URL表示・Googleカレンダー追加ボタンUI
- [x] ガントチャートのモバイル最適化（横スクロール・タッチ操作改善）
- [x] タブ内コンテンツ全体のモバイルレイアウト調整

## AI工程表自動生成（ユーザー指示）
- [x] サーバー側：案件情報+チェックリストからAI工程提案するtRPCプロシージャ実装
- [x] LLMに渡すプロンプト設計（現場調査報告書+依頼案件情報→工程リスト）
- [x] フロントエンド：工程タブに「AI提案」ボタン追加
- [x] 提案結果のプレビュー・一括登録UI

## AI工程提案プレビュー編集・D&D・エクスポート・スキル作成（ユーザー指示）
- [x] AI工程表生成プロセスを再利用可能なスキルとして作成
- [x] AI提案プレビュー画面でタスク内容・日程を直接編集可能に
- [x] ガントチャートのドラッグ＆ドロップ（スマホ対応）で日程変更・期間調整
- [x] 工程表のPDF/画像エクスポート機能

## 工程テンプレート・エクスポートヘッダー・ガントステータス・スキル作成（ユーザー指示）
- [x] 工程テンプレートのDBスキーマ追加（schedule_templates テーブル）
- [x] 工程テンプレート保存・一覧取得・適用のtRPCプロシージャ
- [x] 工程テンプレートのフロントエンドUI（保存ボタン・テンプレート選択パネル）
- [x] エクスポートPDF/画像に案件名・住所・施工期間ヘッダーを自動挿入
- [x] ガントチャートの各バーにステータスアイコン・進捗率表示を追加
- [x] プロセスを再利用可能なスキルとして作成

## ステータスクリック切替・テストデータ削除・原価手入力（ユーザー指示）
- [x] テスト案件・テスト協力会社データを削除
- [x] ガントチャートのステータスアイコンクリックで予定→進行中→完了を直接切り替え
- [x] 案件に原価を手入力できるフィールドを追加（経費タブに「原価入力」ボタン＋フォーム、人件費・現調費カテゴリ追加）

## 収支欄に管理費・現場経費入力＋案件一覧表示切替ボタン（ユーザー指示）
- [x] 収支欄に管理費・現場経費を手入力できる機能を追加
- [x] 案件一覧の表示を1発で変更できるボタンを作成（カード/コンパクト/テーブルの3モード）

## 案件一覧でステータスを直接変更できるUI（ユーザー指示）
- [x] 案件一覧ページ（カード/コンパクト/テーブル各モード）にステータス変更ドロップダウンを追加
- [x] ログインユーザー（自社スタッフ）のみステータス変更可能（protectedProcedure）
- [x] 協力会社公開ページ（/partner-view/[token]）からはステータス変更不可
- [x] テストデータ削除

## 見積書OCR読取→Excel出力機能（ユーザー指示）
- [x] 紙の見積書（写真/PDF）をアップロードしてAIで明細行レベルのデータを抽出
- [x] 抽出結果をプレビュー表示（項目名・数量・単価・金額・備考など）
- [x] 抽出データをExcel（.xlsx）ファイルとしてダウンロード出力
- [x] 既存の見積書取込ページ（/estimates/import）に統合またはサイドバーに新メニュー追加
- [x] テストデータ削除

## OCR読取結果を既存案件に紐付けて保存→予実反映（ユーザー指示）
- [x] EstimateOcrExcel画面に案件選択ドロップダウンを追加
- [x] 「案件に保存」ボタンを追加し、extractAndCreate相当の処理でDB登録
- [x] 保存時にestimatedCost/materialAmount/laborAmountを案件に自動反映（pickLatestEstimate）
- [x] 保存成功後のフィードバック表示

## 金額閲覧を自社スタッフのみに制限（ユーザー指示）
- [x] サーバー側：partnerViewルーターから金額データ（見積金額・予算・実績等）を除外
- [x] フロントエンド：PartnerView画面から金額表示を除去

## 雨漏り調査チェックリスト機能（ユーザー指示）
- [x] DBスキーマ：rain_leak_inspectionsテーブル（案件紐付け、表紙情報、総括所見）
- [x] DBスキーマ：rain_leak_check_itemsテーブル（各チェック項目の記録：有無/緊急度/メモ/写真番号）
- [x] DBスキーマ：rain_leak_route_estimations→ inspectionのJSONフィールドで実装
- [x] サーバー側：チェックリスト作成・取得・更新のtRPCプロシージャ
- [x] フロントエンド：雨漏り調査チェックリスト入力画面（室内/天井裏/外部の各セクション）
- [x] フロントエンド：浸入経路推定セクション→ inspectionのJSONフィールドで保存
- [x] フロントエンド：総括所見セクション
- [x] フロントエンド：サイドバーからアクセス
- [x] サイドバーにメニュー追加

## 案件詳細チェックリスト一括チェック機能（ユーザー指示）
- [x] フェーズ単位（受付/現調/施工/完了）で一括チェックボタンを追加
- [x] 全項目チェック済み時は「解除」ボタンを表示
- [x] サーバー側：bulkToggleプロシージャを追加（ステータス自動遷移対応）

## 一括チェック確認ダイアログ（ユーザー指示）
- [x] 一括チェック・解除ボタン押下時に確認ダイアログを表示してから実行

## 案件ドキュメント管理機能（図面・仕様書格納）（ユーザー指示）
- [x] DBスキーマ：documentsテーブル（案件紐付け、ファイル名、カテゴリ、S3キー等）
- [x] サーバー側：ドキュメントアップロード・一覧取得・削除のtRPCプロシージャ
- [x] フロントエンド：案件詳細に「図面・資料」タブを追加
- [x] カテゴリ分け（図面/仕様書/その他）でフィルタ可能
- [x] ファイルプレビュー・ダウンロード対応

## ダッシュボードに資料DB庫セクション（ユーザー指示）
- [x] サーバー側：全ドキュメント一覧取得API（案件名付き、検索・カテゴリフィルタ対応）
- [x] フロントエンド：ダッシュボードまたはサイドバーに「資料DB庫」ページを追加
- [x] 案件横断でドキュメントを検索・フィルタ・プレビュー・ダウンロード可能

## 南高江店 報告書PDF出力が遅い問題（ユーザー指示）
- [x] 写真枚数が多い場合のPDF生成を最適化（html2canvasのscale縮小、逐次処理+進捗表示）
- [x] PDF生成中の進捗バー表示を追加（「ページ X/Y 処理中...」）

## 横断工程スケジュール（ユーザー指示）
- [x] サーバー側：案件の日程データ（依頼日・施工日・ステータス・担当者）を横断取得するAPI
- [x] フロントエンド：ガントチャート形式の横断工程表ページを実装
- [x] フィルタ機能（ステータス・担当者・県・ブランド）
- [x] 月/週表示切替
- [x] ステータス色分け・進捗バー表示
- [x] サイドバーにメニュー追加

## 横断工程表ドラッグ＆ドロップ日程変更（ユーザー指示）
- [x] 工程バーのドラッグ＆ドロップで開始日・終了日を変更可能にする
- [x] ドラッグ中のビジュアルフィードバック（バー移動プレビュー）
- [x] ドロップ後にschedules.updateミューテーションで永続化

## 工程表PDF/画像エクスポート（ユーザー指示）
- [x] 横断工程表のPDFエクスポート機能を追加
- [x] ヘッダーに案件情報（施工期間・業者名）を自動印字
- [x] 画像（PNG）エクスポートも対応

## Googleカレンダー同期（ユーザー指示）
- [x] 横断工程表UIにGoogleカレンダー購読URLを表示するセクションを追加
- [x] 既存のICSフィード機能を横断工程表UIから利用可能にする
- [x] トークン生成・コピー機能をUI上に配置

## 資料DB庫直接アップロード＋鍵機能（ユーザー指示）
- [x] 資料DB庫ページに直接アップロードボタンを追加（案件選択付き）
- [x] documentsテーブルにisLocked(boolean)カラムを追加
- [x] ロック/アンロック切替UIを追加（自社スタッフのみ操作可能）
- [x] ロックされたドキュメントは協力会社から閲覧不可にする

## 横断工程表バー端リサイズ（ユーザー指示）
- [x] 工程バーの左右端にリサイズハンドルを追加
- [x] 左端ドラッグで開始日変更、右端ドラッグで終了日変更
- [x] リサイズ中のビジュアルフィードバック（幅変化プレビュー）
- [x] ドロップ後にschedules.updateで永続化

## ロック済みドキュメントのパートナー非表示（ユーザー指示）
- [x] パートナーポータルのドキュメント取得APIでisLocked=1を除外
- [x] パートナー向け画面でロック済みドキュメントが表示されないことを確認

## PDFヘッダーに自社情報+住所追加（ユーザー指示）
- [x] PDFヘッダーに自社情報（三好 慶 09092401656）を印字
- [x] 案件ごとの住所情報をヘッダーに追加
- [x] レイアウト調整（情報が見やすく配置されるように）

## リサイズ中リアルタイム日付ツールチップ（ユーザー指示）
- [x] リサイズ中に変更後の開始日/終了日をツールチップでリアルタイム表示
- [x] ドラッグ中のバー付近にフローティングラベルを表示

## PDFヘッダーにロゴ画像追加（ユーザー指示）
- [x] 自社ロゴ画像をPDFヘッダー左上に配置
- [x] ロゴ+自社情報+案件住所のレイアウト調整

## パートナーポータル ドキュメント一覧UI（ユーザー指示）
- [x] パートナーポータル画面にドキュメント一覧セクションを追加
- [x] ファイル名・カテゴリ・日付を表示
- [x] ダウンロードボタンでファイルをダウンロード可能にする

## 横断工程表 Undo（元に戻す）ボタン（ユーザー指示）
- [x] ドラッグ/リサイズ操作前の状態を記録するundo履歴スタックを実装
- [x] ツールバーにUndoボタンを追加（操作履歴がある時のみ有効化）
- [x] Undoクリックで直前の変更をサーバーに反映して元に戻す

## 横断工程表ズームイン/ズームアウト（ユーザー指示）
- [x] 日/週/月単位の表示粒度切替機能を追加
- [x] ズームレベルに応じてヘッダーラベルと列幅を調整

## Todayラインハイライト強化（ユーザー指示）
- [x] 本日の縦線をより目立つ色・太さ・ラベル付きに改善

## Ctrl+Z/Y ショートカット＋Redoボタン（ユーザー指示）
- [x] Ctrl+ZでUndo、Ctrl+YでRedo実行
- [x] Redo履歴スタックを追加
- [x] ツールバーにRedoボタンを配置

## 資料DB庫 共通資料対応（ユーザー指示）
- [x] documentsテーブルのcaseIdをNULL許容に変更（共通資料はcaseId=NULL）
- [x] documentsテーブルにtagsカラム（JSON配列）を追加してカテゴリ/タグ分類
- [x] サーバーAPI: 共通資料の一覧取得・アップロード・タグ更新
- [x] 資料DB庫UIに「共通資料」タブを追加（案件紐づきと切替）
- [x] 共通資料アップロード時にカテゴリ選択（担当者一覧/仕様書/施工対象一覧/その他）
- [x] 案件詳細ページに「関連共通資料」セクションを追加
- [x] 共通資料にタグを付けて案件詳細から関連タグで絞り込み表示

## プロジェクトフォルダ機能（ユーザー指示）
- [x] project_foldersテーブル追加（id, name, description, createdAt, updatedAt）
- [x] project_folder_casesテーブル追加（folderId, caseId）- 案件グループ紐づけ
- [x] project_folder_documentsテーブル追加（folderId, documentId）- 共通資料紐づけ
- [x] サーバーAPI: フォルダCRUD・案件/資料の紐づけ管理
- [x] 資料DB庫UIにプロジェクトフォルダ一覧・作成・編集機能を追加
- [x] 案件詳細ページで所属プロジェクトフォルダの共通資料のみ表示

## バージョン管理機能（ユーザー指示）
- [x] document_versionsテーブル追加（id, documentId, version, fileKey, fileUrl, fileSize, uploadedBy, createdAt）
- [x] 同名ファイル更新時に旧版をversionsに保存してから新版で上書き
- [x] バージョン履歴表示UI（各ドキュメントの履歴一覧・旧版ダウンロード）

## 全文検索機能（ユーザー指示）
- [x] サーバーAPI: ファイル名・メモ・タグを横断検索するプロシージャ
- [x] 資料DB庫UIに検索バーを追加（リアルタイム絞り込み）
- [x] 検索結果にハイライト表示

## 横断工程表 2パターン表示（ユーザー指示）
- [x] 「業者ベース」（現在）と「案件ベース」の2ビューをタブで切替可能にする
- [x] 案件ベースビュー：案件を行にして、担当者（社内スタッフ）と工程バーを表示
- [x] 案件ベースビューでもドラッグ/リサイズ/Undo/Redo/ズーム/PDF出力を共通で利用可能にする

## 案件ベースビュー フィルター機能（ユーザー指示）
- [x] 担当者フィルタ（assigneeFilter）のstate追加とfilteredCaseRowsへの絞り込みロジック追加
- [x] ブランドフィルタ（brandFilter）のstate追加とfilteredCaseRowsへの絞り込みロジック追加
- [x] ツールバーに担当者セレクト・ブランドセレクトUI追加（viewMode === "case"の時のみ表示）

## 効果測定ダッシュボード（ユーザー指示）
- [x] サーバーAPI: 効果測定用の集計プロシージャ（reports.effectiveness）を追加
- [x] 案件処理速度: 受付→完了の平均日数推移（月別）
- [x] コスト最適化: 予実差異の改善率・見積精度向上
- [x] 担当者稼働率: 担当者別ワークロード可視化・偏り解消率
- [x] デジタル化進捗: PDF取込数・写真台帳生成数・紙→デジタル移行件数
- [x] 協力会社パフォーマンス: 発注先多様化・単価比較・品質スコア
- [x] ダッシュボードUI: グラフ・KPIカード・トレンドチャートで可視化
- [x] サイドバーに「効果測定」メニューを追加
- [x] ROI試算セクション: 導入前後の比較・コスト削減額の自動算出

## 効果測定ダッシュボード プレナスKPI基準に再構築（ユーザー指示）
- [x] サーバーAPI: プレナスKPI基準の集計ロジックに変更
  - KPI1: 至急案件の当日/翌日一次対応率
  - KPI2: 依頼日から7日以内の見積書提出率
  - KPI3: 承認後10日以内の施工完了率
  - KPI4: 施工完了から5日以内の完了報告書提出率
  - KPI5: 現場再訪ゼロ率（一発完了率）
- [x] フロントエンド: ダッシュボードUIをKPI達成率中心に再構築
- [x] 金額表示は含めない（利益・売上・コスト等）

## 効果測定ダッシュボード PDFエクスポート（ユーザー指示）
- [x] PDFエクスポートボタンをダッシュボードヘッダーに追加
- [x] html2canvas + jsPDF でダッシュボード全体をA4 PDF化
- [x] 報告書ヘッダー（タイトル・対象期間・出力日・提出先）を自動付与
- [x] 金額表示なし（既存KPI基準を維持）
- [x] 印刷用レイアウト調整（余白・フォントサイズ・改ページ）

## KPIアラート機能（ユーザー指示）
- [x] サーバーAPI: KPI期限が迫っている/超過している案件を取得するプロシージャを追加
- [x] ダッシュボード（Home）にKPIアラートセクションを追加（期限超過・期限間近の案件リスト）
- [x] 各アラートから案件詳細へのリンク
- [x] 緊急度に応じた色分け（超過=赤、残り2日以内=黄）

## 現場再訪なし達成率の可視化（ユーザー指示）
- [x] casesテーブルにrevisitCount（再訪回数）カラムを追加
- [x] サーバーAPI: 再訪記録の更新プロシージャ（cases.markRevisit）
- [x] 案件詳細UIに再訪回数の表示・記録ボタンを追加
- [x] ダッシュボード（Home）に「再訪ゼロ率」KPIカードを追加
- [x] 効果測定ダッシュボードのKPI5と連動（route_assignments + revisitCount）

## 再訪理由記録機能（ユーザー指示）
- [x] revisit_logsテーブルを追加（caseId, reason, note, createdAt, createdBy）
- [x] サーバーAPI: cases.addRevisit（理由付き再訪記録）/ cases.listRevisitLogs
- [x] 案件詳細の再訪カードに理由選択ダイアログ（部材不足・追加依頼・手直し・その他）
- [x] 再訪履歴のタイムライン表示
- [x] revisitCount自動インクリメント（addRevisit時）

## ロール分離・協力業者アクセス制御（ユーザー指示）
- [x] userテーブルのroleを拡張（owner / admin / partner）
- [x] 自社メンバー判定（三好慶=owner、中川悠弥・野口直人・新藤雅樹=admin）→ 野口を協力業者位置付けに変更
- [x] casesテーブルにamountApproved（金額公開承認）フラグを追加
- [x] サーバーAPI: partnerロールは自分が担当する案件のみ取得可能に制限
- [x] サーバーAPI: partnerロールには金額情報をamountApproved=trueの場合のみ返す
- [x] フロントエンド: partnerロールで金額関連UIを非表示
- [x] フロントエンド: 金額承認カード（owner/adminが「協力業者に公開する」ボタンで制御）
- [x] 協力業者専用ポータル（partnerロールログイン時は担当案件のみ表示、メニュー制限）
- [x] サイドバーをロール別に表示制御（効果測定等はadmin以上のみ、協力業者には不要なメニュー非表示）
- [x] 協力会社編集ダイアログに「ログインユーザー紐付け」フィールド追加

## 野口を協力業者位置付けに変更（ユーザー指示）
- [x] 野口直人のroleをpartnerに変更（DB更新）

## 協力業者は案件全件閲覧可能に変更（ユーザー指示）
- [x] partnerロールの案件フィルタリングを解除（全案件閲覧可能に）
- [x] filterCasesForPartner関数の呼び出しを削除（list/listForMap/listMinimal/get）
- [x] 金額非表示制御はそのまま維持（amountApproved=trueの案件のみ金額表示）

## 協力業者が担当案件のステータスを変更可能に（ユーザー指示）
- [x] cases.updateプロシージャでpartnerロールのステータス変更を許可（status/progressStageのみ、他フィールドはFORBIDDEN）
- [x] partnerが変更可能なステータス: 全ステータス（受付/現調中/見積中/施工待ち/施工中/完了/クローズ）
- [x] フロントエンド: 案件詳細InfoTabにpartner専用ステータス変更Selectを追加（編集ボタンは非表示）
- [x] 案件一覧のステータスSelectはpartnerでもそのまま使用可能

## ステータス変更履歴タイムライン＋完了時写真・コメント（ユーザー指示）
- [x] DBスキーマ: statusLogsテーブル作成（caseId, userId, userName, fromStatus, toStatus, comment, photoUrls, createdAt）
- [x] マイグレーションSQL実行
- [x] サーバー: statusLogs.listByCase / statusLogs.create プロシージャ
- [x] サーバー: cases.updateのステータス変更時にstatusLogを自動記録
- [x] サーバー: 完了報告用プロシージャ（写真アップロード＋コメント＋ステータス変更を一括処理）
- [x] フロントエンド: 案件詳細にステータス変更タイムラインUIを追加（「履歴」タブ）
- [x] フロントエンド: 完了ステータス変更時に写真・コメント入力ダイアログを表示
- [x] テスト実行・動作確認（286テスト全パス）

## バグ修正: partnerに報告書ボタンが表示されない（ユーザー報告）
- [x] 現場調査報告書・施工完了報告書ボタンをpartnerにも表示するよう修正（見積書のみ非表示のまま）

## partner制限の修正: プレナス提出見積額のみ非表示に（ユーザー指示）
- [x] CaseDetail: partnerのタブ非表示を全て解除（見積書・収支・経費タブも表示）
- [x] CaseDetail: partnerの金額マスクを解除し、plenusQuoteAmountのみ非表示に
- [x] CasesList: partnerの金額マスクを解除し、plenusQuoteAmountのみ非表示に
- [x] サーバー: partnerの金額マスクロジックをplenusQuoteAmountのみに変更
- [x] amountApprovedの金額承認カードUIを削除（不要になった）
- [x] 経費取込メニューをpartnerにも表示
- [x] 店舗履歴タブをpartnerにも表示
- [x] 収支タブのレイアウト調整（partner向けに不要な余白解消・ラベル最適化）

## partnerが緊急度タグとステータスを変更可能に（ユーザー指示）
- [x] サーバー: cases.updateのpartner許可フィールドにurgencyを追加
- [x] フロントエンド: PartnerStatusChangerに緊急度変更Selectを追加
- [x] CasesList.tsxのステータス変更はpartnerでもそのまま動作可能（サーバー側で許可済み）

## 協力業者用の備考・作業メモ欄を追加（ユーザー指示）
- [x] DBスキーマ: casesテーブルにpartnerNotesカラム（text）を追加
- [x] サーバー: cases.updateのpartner許可フィールドにpartnerNotesを追加
- [x] フロントエンド: 案件詳細InfoTabにPartnerNotesCardコンポーネントを追加
- [x] owner/adminも閲覧可能（編集はpartnerのみ）で情報共有を実現

## 作業メモに最終更新日時・更新者名を表示（ユーザー指示）
- [x] DBスキーマ: casesテーブルにpartnerNotesUpdatedAt, partnerNotesUpdatedByカラムを追加
- [x] サーバー: partnerNotes更新時に自動でupdatedAt/updatedByを記録
- [x] フロントエンド: PartnerNotesCardに最終更新日時と更新者名を表示
