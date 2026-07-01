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

describe("自動保護（メール・URL・型番風トークン）", () => {
  it("メールアドレス内の数字は全角化しない", () => {
    expect(toFullWidthDigits("担当 abc123@example.com まで")).toBe(
      "担当 abc123@example.com まで",
    );
  });
  it("URL内の数字は全角化しない", () => {
    expect(toFullWidthDigits("https://example.com/path/12345")).toBe(
      "https://example.com/path/12345",
    );
  });
  it("英数字混在の型番風トークンは全角化しない", () => {
    // ABC-123X のように英字と数字が混在するトークンは保護
    expect(toFullWidthDigits("型番 ABC-123X を使用")).toBe("型番 ABC-123X を使用");
  });
  it("純粋な数字（現場番号・ページ番号）は全角化する", () => {
    expect(toFullWidthDigits("現場番号 12 の 3 ページ")).toBe(
      "現場番号 １２ の ３ ページ",
    );
  });
});

describe("除外辞書（exclusions）", () => {
  it("登録した語は全角化されない", () => {
    expect(toFullWidthDigits("商品 XYZ-9 を納品", ["XYZ-9"])).toBe(
      "商品 XYZ-9 を納品",
    );
  });
  it("登録していない数字は全角化される", () => {
    expect(toFullWidthDigits("商品 XYZ-9 を 5 個", ["XYZ-9"])).toBe(
      "商品 XYZ-9 を ５ 個",
    );
  });
  it("除外語内の括弧は保護される", () => {
    // 製品名に括弧が含まれるケースを保護
    const out = removeParentheses("製品 Model(A1) を確認", ["Model(A1)"]);
    expect(out.includes("Model(A1)")).toBe(true);
  });
  it("reportLabel でも除外辞書が反映される", () => {
    expect(reportLabel("型番 SN-2024 の登録", ["SN-2024"])).toBe(
      "型番 SN-2024 の登録",
    );
  });
});
