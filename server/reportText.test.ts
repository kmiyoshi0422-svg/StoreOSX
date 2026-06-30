import { describe, it, expect } from "vitest";
import {
  toFullWidthDigits,
  removeParentheses,
  reportLabel,
} from "../shared/reportText";

describe("toFullWidthDigits", () => {
  it("半角数字を全角数字へ変換する", () => {
    expect(toFullWidthDigits("1")).toBe("１");
    expect(toFullWidthDigits("2024-01-09")).toBe("２０２４-０１-０９");
  });
  it("数字以外はそのまま、数字だけ全角化する", () => {
    expect(toFullWidthDigits("Page 12 / 34")).toBe("Page １２ / ３４");
    expect(toFullWidthDigits("工事概要")).toBe("工事概要");
  });
  it("number型も受け付ける", () => {
    expect(toFullWidthDigits(7)).toBe("７");
  });
  it("null/undefinedは空文字", () => {
    expect(toFullWidthDigits(null)).toBe("");
    expect(toFullWidthDigits(undefined)).toBe("");
  });
});

describe("removeParentheses", () => {
  it("全角丸括弧を除去して中身を残す", () => {
    expect(removeParentheses("施工後の状態（After）")).toBe("施工後の状態　After");
  });
  it("半角丸括弧も除去する", () => {
    expect(removeParentheses("採寸データ(実測値)")).toBe("採寸データ　実測値");
  });
  it("括弧が無い文字列はそのまま", () => {
    expect(removeParentheses("工事総評")).toBe("工事総評");
  });
  it("空入力は空文字", () => {
    expect(removeParentheses("")).toBe("");
    expect(removeParentheses(null)).toBe("");
  });
  it("丸括弧 ( ) や （ ） を含まない結果になる", () => {
    const out = removeParentheses("施工写真（ビフォー・アフター）");
    expect(out.includes("（")).toBe(false);
    expect(out.includes("）")).toBe(false);
    expect(out.includes("(")).toBe(false);
    expect(out.includes(")")).toBe(false);
  });
});

describe("reportLabel", () => {
  it("全角数字化と括弧除去を同時に行う", () => {
    expect(reportLabel("4-1. 施工前の状態（Before）")).toBe("４-１. 施工前の状態　Before");
  });
  it("ページ表記を全角化する", () => {
    expect(reportLabel("Page 3 / 13")).toBe("Page ３ / １３");
  });
});
