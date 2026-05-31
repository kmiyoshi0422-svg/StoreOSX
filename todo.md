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
