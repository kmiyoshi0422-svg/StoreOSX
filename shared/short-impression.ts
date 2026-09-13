export const PARTNER_SHORT_IMPRESSION_MAX_LENGTH = 100;
export const PARTNER_SHORT_IMPRESSION_WARNING_LENGTH = 80;

export const PARTNER_SHORT_IMPRESSION_TEMPLATES = [
  "現調完了しました。",
  "写真をアップロードしました。",
  "見積作成中です。",
  "部材を手配中です。",
  "再訪して対応予定です。",
  "施工完了しました。",
] as const;

export function appendShortImpressionTemplate(current: string, template: string) {
  const trimmed = current.trim();
  return trimmed ? `${trimmed}\n${template}` : template;
}
