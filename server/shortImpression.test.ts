import { describe, expect, it } from "vitest";
import {
  appendShortImpressionTemplate,
  PARTNER_SHORT_IMPRESSION_MAX_LENGTH,
  PARTNER_SHORT_IMPRESSION_TEMPLATES,
  PARTNER_SHORT_IMPRESSION_WARNING_LENGTH,
} from "../shared/short-impression";

describe("協力業者向け短文所感", () => {
  it("上限100文字・警告開始80文字で定義されている", () => {
    expect(PARTNER_SHORT_IMPRESSION_MAX_LENGTH).toBe(100);
    expect(PARTNER_SHORT_IMPRESSION_WARNING_LENGTH).toBe(80);
  });

  it("現調完了を含む定型文を提供する", () => {
    expect(PARTNER_SHORT_IMPRESSION_TEMPLATES).toContain("現調完了しました。");
    expect(PARTNER_SHORT_IMPRESSION_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it("既存文がある場合は改行して定型文を追記する", () => {
    expect(appendShortImpressionTemplate("写真確認済み。", "現調完了しました。"))
      .toBe("写真確認済み。\n現調完了しました。");
    expect(appendShortImpressionTemplate("", "現調完了しました。"))
      .toBe("現調完了しました。");
  });
});
