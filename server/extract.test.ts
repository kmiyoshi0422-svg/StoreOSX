import { describe, it, expect } from "vitest";
import {
  contentToText,
  stripCodeFences,
  extractFirstJsonObject,
  parseLlmJson,
  parseAmount,
} from "@shared/extract";

describe("v26: contentToText", () => {
  it("文字列はそのまま返す", () => {
    expect(contentToText('{"a":1}')).toBe('{"a":1}');
  });

  it("配列の text 部分を連結する", () => {
    expect(
      contentToText([{ type: "text", text: '{"a":' }, { type: "text", text: "1}" }])
    ).toBe('{"a":1}');
  });

  it("文字列要素の配列も連結する", () => {
    expect(contentToText(["foo", "bar"])).toBe("foobar");
  });

  it("不明な型は空文字を返す", () => {
    expect(contentToText(null)).toBe("");
    expect(contentToText(undefined)).toBe("");
    expect(contentToText(42)).toBe("");
  });
});

describe("v26: stripCodeFences", () => {
  it("```json ... ``` を除去する", () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("言語指定なしの ``` も除去する", () => {
    expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("フェンスがなければそのまま", () => {
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe("v26: extractFirstJsonObject", () => {
  it("前後に説明文があってもJSONオブジェクトを抜き出す", () => {
    const text = 'はい、抽出結果です:\n{"requestNumber":"285236-1"}\n以上です。';
    expect(extractFirstJsonObject(text)).toBe('{"requestNumber":"285236-1"}');
  });

  it("ネストした波括弧を正しく扱う", () => {
    const text = 'noise {"a":{"b":1},"c":2} tail';
    expect(extractFirstJsonObject(text)).toBe('{"a":{"b":1},"c":2}');
  });

  it("文字列リテラル内の波括弧を無視する", () => {
    const text = '{"note":"これは{波括弧}を含む"}';
    expect(extractFirstJsonObject(text)).toBe('{"note":"これは{波括弧}を含む"}');
  });

  it("エスケープされたダブルクォートを正しく扱う", () => {
    const text = '{"q":"a\\"b","x":1}';
    expect(extractFirstJsonObject(text)).toBe('{"q":"a\\"b","x":1}');
  });

  it("オブジェクトが無ければ null", () => {
    expect(extractFirstJsonObject("no json here")).toBeNull();
  });
});

describe("v26: parseLlmJson", () => {
  it("素のJSONをパースする", () => {
    expect(parseLlmJson('{"requestNumber":"1","storeName":"店"}')).toEqual({
      requestNumber: "1",
      storeName: "店",
    });
  });

  it("コードフェンス付きJSONをパースする", () => {
    expect(parseLlmJson('```json\n{"storeName":"小郡店"}\n```')).toEqual({
      storeName: "小郡店",
    });
  });

  it("前後に説明文が混在していてもパースする", () => {
    const text = '了解しました。以下が抽出結果です。\n{"urgency":"A"}\nご確認ください。';
    expect(parseLlmJson(text)).toEqual({ urgency: "A" });
  });

  it("コードフェンス＋説明文の複合でもパースする", () => {
    const text = 'はい:\n```json\n{"workType":"修理","storeCode":"123"}\n```\n以上';
    expect(parseLlmJson(text)).toEqual({ workType: "修理", storeCode: "123" });
  });

  it("壊れたJSONは null を返す（例外を投げない）", () => {
    expect(parseLlmJson('{"a": }')).toBeNull();
    expect(parseLlmJson("これはJSONではありません")).toBeNull();
  });

  it("空文字は null を返す", () => {
    expect(parseLlmJson("")).toBeNull();
    expect(parseLlmJson("   ")).toBeNull();
  });

  it("配列はオブジェクトでないため null を返す", () => {
    expect(parseLlmJson("[1,2,3]")).toBeNull();
  });
});

describe("v30: parseAmount", () => {
  it("カンマ・円記号付き文字列を整数化する", () => {
    expect(parseAmount("¥1,200,000")).toBe(1200000);
    expect(parseAmount("350,000円")).toBe(350000);
  });

  it("全角数字を半角化して整数化する", () => {
    expect(parseAmount("１２３４")).toBe(1234);
    expect(parseAmount("２５０，０００")).toBe(250000);
  });

  it("数値はそのまま（小数は切り捨て）", () => {
    expect(parseAmount(350000)).toBe(350000);
    expect(parseAmount(1200.99)).toBe(1200);
  });

  it("空文字・null・記号のみは null", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount("円")).toBeNull();
    expect(parseAmount("-")).toBeNull();
  });

  it("負値や不正値は null", () => {
    expect(parseAmount(-100)).toBeNull();
    expect(parseAmount("-5000")).toBeNull();
    expect(parseAmount(NaN)).toBeNull();
  });

  it("装飾を含む通常入力をパースできる", () => {
    expect(parseAmount(" 350000 ")).toBe(350000);
    expect(parseAmount("¥０")).toBe(0);
  });
});
