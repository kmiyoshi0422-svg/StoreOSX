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
