// 業務フロー順のデフォルトチェックリストテンプレート
// 案件作成時に自動投入される

export type ChecklistPhase = "受付" | "現調" | "施工" | "完了";

export interface ChecklistTemplateItem {
  phase: ChecklistPhase;
  orderNo: number;
  title: string;
  description: string;
}

export const DEFAULT_CHECKLIST: ChecklistTemplateItem[] = [
  // ① 受付
  { phase: "受付", orderNo: 1, title: "依頼内容を確認", description: "プレナスシステムの依頼内容・写真を確認" },
  { phase: "受付", orderNo: 2, title: "緊急度を判断", description: "営業停止リスクの有無を確認し緊急度を設定" },
  { phase: "受付", orderNo: 3, title: "10万円ライン判定", description: "見積額の見込みを確認（10万円超は見積必要）" },
  { phase: "受付", orderNo: 4, title: "担当者アサイン", description: "現場管理者を決定" },
  { phase: "受付", orderNo: 5, title: "協力会社手配", description: "工事内容に合った業者を選定・連絡" },
  { phase: "受付", orderNo: 6, title: "店舗へ連絡", description: "依頼者へ対応予定日・担当者名を連絡" },
  { phase: "受付", orderNo: 7, title: "現調日程確定", description: "店舗営業時間を考慮し現調日を設定" },

  // ② 現調
  { phase: "現調", orderNo: 1, title: "店舗外観撮影", description: "正面・側面から店舗全景を撮影" },
  { phase: "現調", orderNo: 2, title: "店長・依頼者へ挨拶", description: "名刺交換・作業内容説明・立会い確認" },
  { phase: "現調", orderNo: 3, title: "不具合箇所の確認", description: "依頼者から直接状況をヒアリング" },
  { phase: "現調", orderNo: 4, title: "全景写真撮影", description: "不具合箇所が店舗のどの位置か分かる写真" },
  { phase: "現調", orderNo: 5, title: "近景写真撮影", description: "不具合の詳細が分かるアップ写真" },
  { phase: "現調", orderNo: 6, title: "メーカー・型番撮影", description: "銘板・ラベルを接写（部品発注用）" },
  { phase: "現調", orderNo: 7, title: "寸法・サイズ計測", description: "交換部品のサイズ・開口寸法等を計測" },
  { phase: "現調", orderNo: 8, title: "原因の特定", description: "経年劣化／外的要因／使用方法のいずれか判断" },
  { phase: "現調", orderNo: 9, title: "施工条件の確認", description: "作業スペース・電源・水源・搬入経路を確認" },
  { phase: "現調", orderNo: 10, title: "営業中作業の可否", description: "営業しながら作業可能か、閉店後が必要か" },
  { phase: "現調", orderNo: 11, title: "必要部材・数量整理", description: "交換部品名・品番・数量をメモ" },
  { phase: "現調", orderNo: 12, title: "見積必要情報の整理", description: "工事内容・人工・工期の概算" },
  { phase: "現調", orderNo: 13, title: "店長へ報告", description: "確認結果・今後の流れを説明" },

  // ③ 施工
  { phase: "施工", orderNo: 1, title: "施工前 店長挨拶", description: "作業内容・時間・影響範囲を伝える" },
  { phase: "施工", orderNo: 2, title: "施工前写真撮影", description: "施工箇所の全景＋近景（ビフォー）" },
  { phase: "施工", orderNo: 3, title: "養生", description: "床・壁・家具等の保護" },
  { phase: "施工", orderNo: 4, title: "安全確認", description: "電源OFF／ガス元栓／止水栓の確認" },
  { phase: "施工", orderNo: 5, title: "工具・材料確認", description: "必要な工具・部材が揃っているか" },
  { phase: "施工", orderNo: 6, title: "施工中写真撮影", description: "隠蔽部（壁内・天井裏）は必ず撮影" },
  { phase: "施工", orderNo: 7, title: "仕様通りの施工", description: "指定部材・指定工法で施工" },
  { phase: "施工", orderNo: 8, title: "施工後 動作確認", description: "通電／通水／運転テスト" },
  { phase: "施工", orderNo: 9, title: "施工後写真撮影", description: "施工前と同じアングルで撮影（アフター）" },
  { phase: "施工", orderNo: 10, title: "養生撤去・清掃", description: "養生材撤去、ゴミ・粉塵の清掃" },
  { phase: "施工", orderNo: 11, title: "産廃処理", description: "廃材の持ち帰り・適正処理" },
  { phase: "施工", orderNo: 12, title: "店長確認・説明", description: "完了報告、使い方説明、注意事項伝達" },

  // ④ 完了
  { phase: "完了", orderNo: 1, title: "施工前写真の確認", description: "全景A＋近景Bの施工前写真が揃っている" },
  { phase: "完了", orderNo: 2, title: "施工後写真の確認", description: "施工前と同じアングルの写真が揃っている" },
  { phase: "完了", orderNo: 3, title: "動作確認完了", description: "正常動作を確認済み" },
  { phase: "完了", orderNo: 4, title: "安全確認完了", description: "漏電／ガス漏れ／水漏れがない" },
  { phase: "完了", orderNo: 5, title: "写真台帳の作成", description: "写真台帳PDFを作成・確認" },
  { phase: "完了", orderNo: 6, title: "システム進捗更新", description: "プレナスシステムを「完了」に更新" },
  { phase: "完了", orderNo: 7, title: "完了報告書の提出", description: "報告書・写真台帳を提出" },
];

// 修理内容（大項目）プルダウン
export const CATEGORY_LARGE_OPTIONS = [
  "内外装・サッシ・建築",
  "電気",
  "給排水",
  "空調・冷凍",
  "厨房機器",
  "看板・サイン",
  "その他",
];

// 修理内容（中項目）プルダウン
export const CATEGORY_MEDIUM_OPTIONS: Record<string, string[]> = {
  "内外装・サッシ・建築": ["サッシ・自動ドア", "クロス補修", "床補修", "外壁補修", "建具", "防水"],
  電気: ["コンセント", "照明", "分電盤", "漏電調査", "LED化"],
  給排水: ["排水詰まり", "漏水修理", "給湯器", "グリストラップ", "蛇口"],
  "空調・冷凍": ["エアコン", "冷蔵庫", "冷凍庫", "製氷機"],
  厨房機器: ["フライヤー", "ガスコンロ", "スチームコンベクション", "ライスボイラー", "炊飯器"],
  "看板・サイン": ["看板照明", "看板破損", "サイン色褪せ"],
  その他: ["その他"],
};

/**
 * 案件の大項目（categoryLarge）から、推薦すべき協力会社カテゴリ（partner.category）へのマッピング
 */
export const CATEGORY_TO_PARTNER_CATEGORIES: Record<string, string[]> = {
  "内外装・サッシ・建築": ["内装", "建具", "外壁", "床", "防水"],
  電気: ["電気"],
  給排水: ["給排水"],
  "空調・冷凍": ["空調", "排気・換気"],
  厨房機器: ["厨房設備", "排気・換気"],
  "看板・サイン": ["看板"],
  その他: ["その他"],
};

/**
 * 中項目（categoryMedium）から協力会社カテゴリへの細分マッピング
 */
export const MEDIUM_TO_PARTNER_CATEGORIES: Record<string, string[]> = {
  "サッシ・自動ドア": ["建具"],
  クロス補修: ["内装"],
  床補修: ["床"],
  外壁補修: ["外壁"],
  建具: ["建具"],
  防水: ["防水"],
  グリストラップ: ["給排水"],
  排水詰まり: ["給排水"],
  漏水修理: ["給排水"],
  給湯器: ["給排水"],
  蛇口: ["給排水"],
  エアコン: ["空調"],
  冷蔵庫: ["空調"],
  冷凍庫: ["空調"],
  製氷機: ["空調"],
  フライヤー: ["厨房設備"],
  ガスコンロ: ["厨房設備"],
  スチームコンベクション: ["厨房設備"],
  ライスボイラー: ["厨房設備"],
  炊飯器: ["厨房設備"],
  看板照明: ["看板", "電気"],
  看板破損: ["看板"],
  サイン色褪せ: ["看板"],
  コンセント: ["電気"],
  照明: ["電気"],
  分電盤: ["電気"],
  漏電調査: ["電気"],
  LED化: ["電気"],
};

/**
 * 案件の大項目・中項目から推薦する協力会社カテゴリ配列を返す（中項目優先、なければ大項目）
 */
export function recommendPartnerCategories(
  categoryLarge?: string | null,
  categoryMedium?: string | null
): string[] {
  if (categoryMedium && MEDIUM_TO_PARTNER_CATEGORIES[categoryMedium]) {
    return MEDIUM_TO_PARTNER_CATEGORIES[categoryMedium];
  }
  if (categoryLarge && CATEGORY_TO_PARTNER_CATEGORIES[categoryLarge]) {
    return CATEGORY_TO_PARTNER_CATEGORIES[categoryLarge];
  }
  return [];
}
