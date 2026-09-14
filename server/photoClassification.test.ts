import { describe, expect, it } from "vitest";
import {
  canUsePhotoClassification,
  isLowPhotoClassificationConfidence,
  normalizePhotoClassificationSuggestions,
  resolvePersistedPhotoType,
  toPhotoClassificationCategory,
} from "../shared/photoClassification";
import { classifyConstructionPhotos } from "./photoClassification";

describe("施工写真AI分類の共通契約", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["user", true],
    ["partner", true],
    ["executive", false],
    ["customer", false],
  ])("%s のAI写真分類権限は %s", (role, expected) => {
    expect(canUsePhotoClassification(role)).toBe(expected);
  });

  it("80未満だけを低確信度として扱う", () => {
    expect(isLowPhotoClassificationConfidence(79)).toBe(true);
    expect(isLowPhotoClassificationConfidence(80)).toBe(false);
    expect(isLowPhotoClassificationConfidence(100)).toBe(false);
  });

  it("施工前B・施工後Bは同じ大区分への保存時に維持する", () => {
    expect(resolvePersistedPhotoType("施工前", "施工前B")).toBe("施工前B");
    expect(resolvePersistedPhotoType("施工後", "施工後B")).toBe("施工後B");
    expect(resolvePersistedPhotoType("施工前", "現調")).toBe("施工前A");
    expect(resolvePersistedPhotoType("施工後", "施工中")).toBe("施工後A");
    expect(resolvePersistedPhotoType("現調", "メーカー型番")).toBe("現調");
  });

  it("既存の細分類を4区分へ変換する", () => {
    expect(toPhotoClassificationCategory("施工前A")).toBe("施工前");
    expect(toPhotoClassificationCategory("施工前B")).toBe("施工前");
    expect(toPhotoClassificationCategory("施工中")).toBe("施工中");
    expect(toPhotoClassificationCategory("施工後B")).toBe("施工後");
    expect(toPhotoClassificationCategory("設置状況")).toBe("現調");
  });

  it("案件外IDを除外し、重複は高確信度を採用し、欠落は現在区分を維持する", () => {
    const result = normalizePhotoClassificationSuggestions({
      requestedPhotos: [
        { id: 10, photoType: "現調" },
        { id: 11, photoType: "施工後B" },
        { id: 12, photoType: "施工中" },
      ],
      suggestions: [
        { photoId: 10, category: "施工前", confidence: 62.4, reason: " 養生前の状態 " },
        { photoId: 10, category: "施工中", confidence: 88.7, reason: "工具を使用中" },
        { photoId: 11, category: "施工後", confidence: 120, reason: "清掃済み" },
        { photoId: 999, category: "現調", confidence: 99, reason: "案件外" },
      ],
    });

    expect(result).toEqual([
      { photoId: 10, category: "施工中", confidence: 89, reason: "工具を使用中" },
      { photoId: 11, category: "施工後", confidence: 100, reason: "清掃済み" },
      {
        photoId: 12,
        category: "施工中",
        confidence: 0,
        reason: "AI判定結果を取得できなかったため、現在の区分を維持しています。",
      },
    ]);
  });

  it("画像・メタデータをVisionモデルへ渡し、全対象写真の候補を返す", async () => {
    let capturedParams: any;
    const suggestions = await classifyConstructionPhotos({
      photos: [
        {
          id: 21,
          fileKey: "case-1/before.jpg",
          photoType: "現調",
          workCategory: "内装",
          workItem: "天井補修",
          memo: "着手前",
          takenAt: new Date("2026-09-14T00:00:00Z"),
        },
        {
          id: 22,
          fileKey: "case-1/after.jpg",
          photoType: "施工後A",
          memo: null,
        },
      ],
      caseContext: {
        status: "施工中",
        progressStage: "承認済",
        requestContent: "天井の漏水跡を補修する",
      },
      getSignedUrl: async (key) => `https://signed.example/${key}`,
      invoke: (async (params: any) => {
        capturedParams = params;
        return {
          id: "test",
          created: 0,
          model: "gemini-3-flash-preview",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: JSON.stringify({
                  suggestions: [
                    { photoId: 21, category: "施工前", confidence: 76, reason: "未施工の天井面" },
                  ],
                }),
              },
            },
          ],
        };
      }) as any,
    });

    expect(capturedParams.model).toBe("gemini-3-flash-preview");
    expect(capturedParams.response_format.json_schema.strict).toBe(true);
    expect(capturedParams.messages[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "image_url", image_url: { url: "https://signed.example/case-1/before.jpg", detail: "low" } }),
        expect.objectContaining({ type: "image_url", image_url: { url: "https://signed.example/case-1/after.jpg", detail: "low" } }),
      ]),
    );
    expect(suggestions).toEqual([
      { photoId: 21, category: "施工前", confidence: 76, reason: "未施工の天井面" },
      {
        photoId: 22,
        category: "施工後",
        confidence: 0,
        reason: "AI判定結果を取得できなかったため、現在の区分を維持しています。",
      },
    ]);
  });

  it("不正な構造化応答は保存候補として通さない", async () => {
    await expect(
      classifyConstructionPhotos({
        photos: [{ id: 1, fileKey: "case-1/photo.jpg", photoType: "現調" }],
        caseContext: {},
        getSignedUrl: async () => "https://signed.example/photo.jpg",
        invoke: (async () => ({
          id: "test",
          created: 0,
          model: "gemini-3-flash-preview",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: JSON.stringify({ suggestions: [{ photoId: 1, category: "撤去", confidence: 99, reason: "不正区分" }] }),
              },
            },
          ],
        })) as any,
      }),
    ).rejects.toThrow();
  });

  it("1回20枚を超える画像をAIへ送らない", async () => {
    const photos = Array.from({ length: 21 }, (_, index) => ({
      id: index + 1,
      fileKey: `case-1/${index + 1}.jpg`,
      photoType: "現調",
    }));
    await expect(
      classifyConstructionPhotos({ photos, caseContext: {} }),
    ).rejects.toThrow("AI分類は1回20枚までです");
  });
});
