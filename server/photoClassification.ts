import { z } from "zod";
import type { MessageContent } from "./_core/llm";
import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl } from "./storage";
import {
  normalizePhotoClassificationSuggestions,
  PHOTO_CLASSIFICATION_CATEGORIES,
  type PhotoClassificationSuggestion,
} from "../shared/photoClassification";

export type ClassifiablePhoto = {
  id: number;
  fileKey: string;
  photoType: string;
  workCategory?: string | null;
  workItem?: string | null;
  memo?: string | null;
  takenAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export type PhotoClassificationCaseContext = {
  status?: string | null;
  progressStage?: string | null;
  requestContent?: string | null;
  categoryLarge?: string | null;
  categoryMedium?: string | null;
  categorySmall?: string | null;
  requestDate?: Date | string | null;
  surveyDate?: Date | string | null;
  constructionDate?: Date | string | null;
  completedAt?: Date | string | null;
};

type InvokeLlm = typeof invokeLLM;
type GetSignedUrl = typeof storageGetSignedUrl;

const rawClassificationSchema = z.object({
  suggestions: z.array(
    z.object({
      photoId: z.number().int().positive(),
      category: z.enum(PHOTO_CLASSIFICATION_CATEGORIES),
      confidence: z.number(),
      reason: z.string(),
    }),
  ),
});

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "未設定";
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "未設定" : parsed.toISOString();
}

function buildCaseContext(context: PhotoClassificationCaseContext) {
  return [
    `案件ステータス: ${context.status ?? "未設定"}`,
    `進捗段階: ${context.progressStage ?? "未設定"}`,
    `依頼内容: ${(context.requestContent ?? "未設定").slice(0, 1200)}`,
    `工事分類: ${[context.categoryLarge, context.categoryMedium, context.categorySmall].filter(Boolean).join(" / ") || "未設定"}`,
    `依頼日: ${formatDate(context.requestDate)}`,
    `現調日: ${formatDate(context.surveyDate)}`,
    `施工日: ${formatDate(context.constructionDate)}`,
    `完了日: ${formatDate(context.completedAt)}`,
  ].join("\n");
}

export async function classifyConstructionPhotos({
  photos,
  caseContext,
  invoke = invokeLLM,
  getSignedUrl = storageGetSignedUrl,
}: {
  photos: ClassifiablePhoto[];
  caseContext: PhotoClassificationCaseContext;
  invoke?: InvokeLlm;
  getSignedUrl?: GetSignedUrl;
}): Promise<PhotoClassificationSuggestion[]> {
  if (photos.length === 0) return [];
  if (photos.length > 20) throw new Error("AI分類は1回20枚までです");

  const content: MessageContent[] = [
    {
      type: "text",
      text: `${buildCaseContext(caseContext)}\n\n以下の各写真を、画像の状態・作業痕跡・撮影日時・メモから判定してください。現在区分は参考情報であり正解とは限りません。`,
    },
  ];

  for (const photo of photos) {
    const signedUrl = await getSignedUrl(photo.fileKey.replace(/^\/manus-storage\//, ""));
    content.push({
      type: "text",
      text: [
        `PHOTO_ID=${photo.id}`,
        `現在区分=${photo.photoType}`,
        `工事項目=${photo.workCategory ?? "未設定"} / ${photo.workItem ?? "未設定"}`,
        `メモ=${(photo.memo ?? "未設定").slice(0, 500)}`,
        `撮影日時=${formatDate(photo.takenAt)}`,
        `登録日時=${formatDate(photo.createdAt)}`,
      ].join("\n"),
    });
    content.push({
      type: "image_url",
      image_url: { url: signedUrl, detail: "low" },
    });
  }

  const response = await invoke({
    model: "gemini-3-flash-preview",
    messages: [
      {
        role: "system",
        content: `あなたは店舗修繕・建築工事写真の分類補助者です。各写真を必ず次の4区分の1つへ分類してください。
- 現調: 不具合、既存状態、採寸、型番、設置状況など、施工判断のための調査記録
- 施工前: 工事対象箇所の着手直前。工具使用、撤去、養生などの作業はまだ始まっていない
- 施工中: 養生、撤去、開口、配線、組立、交換、補修、工具使用、作業員の施工など途中工程
- 施工後: 復旧・交換・補修・清掃が完了し、完成状態を示す写真

画像だけで断定できない場合は、無理に高得点にせず confidence を79以下にしてください。写真に存在しない状況を推測せず、理由は日本語60文字以内で画像に見える根拠を簡潔に書いてください。PHOTO_IDごとに1件返してください。`,
      },
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "construction_photo_classification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  photoId: { type: "integer" },
                  category: { type: "string", enum: [...PHOTO_CLASSIFICATION_CATEGORIES] },
                  confidence: { type: "number", minimum: 0, maximum: 100 },
                  reason: { type: "string" },
                },
                required: ["photoId", "category", "confidence", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  const parsed = rawClassificationSchema.parse(
    typeof raw === "string" ? JSON.parse(raw) : raw,
  );
  return normalizePhotoClassificationSuggestions({
    requestedPhotos: photos.map((photo) => ({ id: photo.id, photoType: photo.photoType })),
    suggestions: parsed.suggestions,
  });
}

