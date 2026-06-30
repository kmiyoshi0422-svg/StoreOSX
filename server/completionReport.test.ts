import { describe, it, expect } from "vitest";
import {
  parseCompletionContent,
  EMPTY_COMPLETION_CONTENT,
  COMPANY_INFO,
  type CompletionReportContent,
} from "../shared/completionReport";

describe("completionReport: parseCompletionContent", () => {
  it("null/undefined/空文字は空のcontentを返す", () => {
    expect(parseCompletionContent(null)).toEqual(EMPTY_COMPLETION_CONTENT);
    expect(parseCompletionContent(undefined)).toEqual(EMPTY_COMPLETION_CONTENT);
    expect(parseCompletionContent("")).toEqual(EMPTY_COMPLETION_CONTENT);
  });

  it("不正なJSONは空のcontentにフォールバックする", () => {
    expect(parseCompletionContent("{壊れた")).toEqual(EMPTY_COMPLETION_CONTENT);
    expect(parseCompletionContent("not json")).toEqual(EMPTY_COMPLETION_CONTENT);
  });

  it("欠損した配列項目は空配列で補完される", () => {
    const partial = JSON.stringify({ overview: "外壁の補修を実施" });
    const result = parseCompletionContent(partial);
    expect(result.overview).toBe("外壁の補修を実施");
    expect(result.evaluations).toEqual([]);
    expect(result.measurements).toEqual([]);
    expect(result.materials).toEqual([]);
    expect(result.procedures).toEqual([]);
    expect(result.inspections).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.photoCaptions).toEqual([]);
    // 未指定の文字列項目は空文字
    expect(result.purpose).toBe("");
    expect(result.conclusion).toBe("");
  });

  it("完全なcontentはそのまま保持される（ラウンドトリップ）", () => {
    const full: CompletionReportContent = {
      workName: "外壁補修工事",
      statusBadge: "工事完了",
      overview: "外壁の一部補修を実施しました。",
      purpose: "美観と防水性の維持のため。",
      scope: "店舗北面外壁。",
      summary: "施工は計画どおり完了しました。",
      evaluations: [{ item: "外壁", before: "汚損あり", after: "清掃済", judgment: "解消" }],
      measurements: [{ name: "補修範囲", value: "2.0m" }],
      materials: [{ name: "シーリング材", spec: "変成シリコン", qty: "2本" }],
      procedures: [{ step: "1", detail: "既存撤去" }],
      conclusion: "工事は完了しました。",
      inspections: [{ timing: "6ヶ月後", target: "シーリング", note: "剥離有無の確認" }],
      risks: [{ part: "目地", risk: "経年での収縮の可能性", level: "低" }],
      photoCaptions: [{ photoId: 1, caption: "施工前の状態" }],
    };
    const result = parseCompletionContent(JSON.stringify(full));
    expect(result).toEqual(full);
  });

  it("photoCaptions の photoId と caption が保持される", () => {
    const raw = JSON.stringify({
      photoCaptions: [
        { photoId: 10, caption: "施工前の状態" },
        { photoId: 11, caption: "施工後の状態" },
      ],
    });
    const result = parseCompletionContent(raw);
    expect(result.photoCaptions).toHaveLength(2);
    expect(result.photoCaptions[0]).toEqual({ photoId: 10, caption: "施工前の状態" });
    expect(result.photoCaptions[1].photoId).toBe(11);
  });

  it("既定の statusBadge は『工事完了』", () => {
    expect(EMPTY_COMPLETION_CONTENT.statusBadge).toBe("工事完了");
  });
});

describe("completionReport: COMPANY_INFO 固定値", () => {
  it("会社・施工者・提出先の固定情報が定義されている", () => {
    expect(COMPANY_INFO.companyName).toBe("株式会社小林工房");
    expect(COMPANY_INFO.personName).toBe("三好 慶");
    expect(COMPANY_INFO.tel).toBe("090-9240-1656");
    expect(COMPANY_INFO.email).toBe("kei@kobayashi-kobo.co.jp");
    expect(COMPANY_INFO.submitTo).toContain("プレナス");
  });
});
