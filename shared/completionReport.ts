/**
 * 施工完了報告書（参考PDF準拠）の共有定義。
 * - 会社・施工者・提出先は固定値。
 * - セクション本文は案件ごとにAI生成 + 手編集し、JSONで保存する。
 * - 金額は一切含めない。原因等の断定表現は禁止（不明な場合は空欄＝写真のみ）。
 */

// 会社・施工者・提出先の固定情報
export const COMPANY_INFO = {
  submitTo: "株式会社プレナス 御中",
  builder: "施工者",
  companyName: "株式会社小林工房",
  personName: "三好 慶",
  tel: "090-9240-1656",
  email: "kei@kobayashi-kobo.co.jp",
} as const;

// 施工前後評価表の1行
export type EvaluationRow = {
  item: string; // 評価項目
  before: string; // 施工前の状態
  after: string; // 施工後の状態
  judgment: string; // 判定（例：解消 / 適合）
};

// 採寸データの1行
export type MeasurementRow = {
  name: string; // 計測箇所
  value: string; // 実測値（単位込みの文字列。数値が無ければ空）
};

// 使用材料の1行
export type MaterialRow = {
  name: string; // 材料・部材名
  spec: string; // 規格・仕様（不明なら空）
  qty: string; // 数量（不明なら空）
};

// 施工手順の1行
export type ProcedureRow = {
  step: string; // 手順番号（例：1）
  detail: string; // 作業内容
};

// 点検計画の1行
export type InspectionRow = {
  timing: string; // 推奨時期
  target: string; // 点検対象
  note: string; // 内容・観点
};

// 周辺リスク評価の1行
export type RiskRow = {
  part: string; // 周辺部位
  risk: string; // 想定される連鎖リスク（断定せず可能性として記載）
  level: string; // 注意度（低 / 中 / 高 など）
};

// 写真キャプション（photoId と紐付け）
export type PhotoCaption = {
  photoId: number;
  caption: string; // 【写真N 確認内容】に入る短い説明（断定禁止・金額禁止）
};

/**
 * 完了報告書ドラフト本文。すべて文字列/配列で、未確定項目は空にできる。
 * AIは不明な点を断定せず、空欄のままにしてよい（その場合は写真のみ掲載）。
 */
export type CompletionReportContent = {
  workName: string; // 工事名（表紙・1行表示）
  statusBadge: string; // 緑バッジ文言（例：工事完了 / 損傷レベル：解消済）
  overview: string; // 1. 工事概要
  purpose: string; // 1-1. 施工目的
  scope: string; // 1-2. 工事範囲
  summary: string; // 2. 工事総評
  evaluations: EvaluationRow[]; // 3. 施工前後の状態評価
  measurements: MeasurementRow[]; // 5. 採寸データ
  materials: MaterialRow[]; // 6-1. 使用材料
  procedures: ProcedureRow[]; // 6-2. 実施工法・施工手順
  conclusion: string; // 7. 工事完了結論および次のアクション
  inspections: InspectionRow[]; // 8. 次回点検・予防保全プラン
  risks: RiskRow[]; // 9. 周辺部位の連鎖リスク評価
  photoCaptions: PhotoCaption[]; // 各写真の確認内容
};

// 空のドラフト（生成前/初期値）
export const EMPTY_COMPLETION_CONTENT: CompletionReportContent = {
  workName: "",
  statusBadge: "工事完了",
  overview: "",
  purpose: "",
  scope: "",
  summary: "",
  evaluations: [],
  measurements: [],
  materials: [],
  procedures: [],
  conclusion: "",
  inspections: [],
  risks: [],
  photoCaptions: [],
};

// 保存済みJSONを安全にパースし、欠損項目を空で補完する
export function parseCompletionContent(raw: string | null | undefined): CompletionReportContent {
  if (!raw) return { ...EMPTY_COMPLETION_CONTENT };
  try {
    const obj = JSON.parse(raw) as Partial<CompletionReportContent>;
    return {
      ...EMPTY_COMPLETION_CONTENT,
      ...obj,
      evaluations: obj.evaluations ?? [],
      measurements: obj.measurements ?? [],
      materials: obj.materials ?? [],
      procedures: obj.procedures ?? [],
      inspections: obj.inspections ?? [],
      risks: obj.risks ?? [],
      photoCaptions: obj.photoCaptions ?? [],
    };
  } catch {
    return { ...EMPTY_COMPLETION_CONTENT };
  }
}
