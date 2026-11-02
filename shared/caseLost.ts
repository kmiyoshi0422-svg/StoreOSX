export const LOST_REASON_OPTIONS = [
  { value: "高額なため", label: "① 高額なため" },
  { value: "対応に不備", label: "② 対応に不備（遅いなど）" },
  { value: "別業者手配", label: "③ 別業者手配" },
  { value: "その他", label: "④ その他" },
] as const;
export type LostReason = typeof LOST_REASON_OPTIONS[number]["value"];
export const REVIVE_LOST_OPTION = "__revive_lost__";
