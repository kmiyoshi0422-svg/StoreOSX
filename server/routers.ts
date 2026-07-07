import { COOKIE_NAME } from "@shared/const";
import { DEFAULT_CHECKLIST } from "../shared/checklist-template";
import { z } from "zod";
import {
  createCase,
  createChecklistItems,
  createEstimate,
  createPartner,
  createPhoto,
  deleteCase,
  deleteEstimateById,
  deletePartner,
  deletePhoto,
  getAllUsers,
  getCaseById,
  getCaseByPartnerToken,
  getCaseByRequestNumber,
  getChecklistByCaseId,
  getEstimateById,
  getPartnerById,
  getPhotoById,
  getPhotosByCaseId,
  getPhotosByCaseIds,
  getCasesByIds,
  listCases,
  listCasesByPartner,
  listEstimatesByCase,
  listPartners,
  listAllExpenses,
  listExpensesByCase,
  listUnmatchedExpenses,
  listGeneralExpenses,
  listExpensesForAggregation,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseById,
  syncCaseActualCost,
  listRouteAssignmentsByDateRange,
  createRouteAssignment,
  updateRouteAssignment,
  deleteRouteAssignment,
  clearRouteAssignmentsInRange,
  listTeamSettings,
  upsertTeamSetting,
  listTeamMembers,
  setTeamMembers,
  listSignaturesByCase,
  getSignature,
  upsertSignature,
  deleteSignature,
  getReportDraft,
  upsertReportDraft,
  listFullwidthExclusions,
  addFullwidthExclusion,
  deleteFullwidthExclusion,
  setCasePartnerToken,
  updateCase,
  updateChecklistItem,
  updatePartner,
  updatePhoto,
} from "./db";
import { makeRequest } from "./_core/map";
import {
  buildSchedule,
  type PlannerCase,
} from "../shared/route-planner";
import { getSessionCookieOptions } from "./_core/cookies";
import { storagePut, storageGetSignedUrl } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { BUDGET_RATIO, calcBudget } from "../shared/budget";
import { calcCaseProfit } from "../shared/profit";
import { detectPrefecture } from "../shared/prefecture";
import { resolveStageStatus, syncStageFromStatus } from "../shared/stageStatus";
import type { ProgressStage, CaseStatus } from "../shared/stageStatus";
import { aggregateExpensesByUser } from "../shared/expense-aggregate";
import { contentToText, parseLlmJson, parseAmount } from "../shared/extract";
import { extractPdfEmbeddedImages } from "./_core/pdfImages";
import { scoreCandidates, topMatches, pickBestMatch } from "../shared/estimate-matcher";
import { pickLatestEstimate } from "../shared/estimate-aggregator";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import {
  EMPTY_COMPLETION_CONTENT,
  parseCompletionContent,
  type CompletionReportContent,
} from "../shared/completionReport";

// ============================================================
// Zod schemas
// ============================================================
// 経費区分（v28: 車両費/宿泊費/接待交際費を追加）
const EXPENSE_CATEGORY = z.enum([
  "材料費",
  "外注費",
  "交通費",
  "消耗品",
  "車両費",
  "宿泊費",
  "接待交際費",
  "その他",
]);

const caseInputSchema = z.object({
  requestNumber: z.string().min(1),
  brand: z.enum(["ほっともっと", "やよい軒", "その他"]).default("ほっともっと"),
  storeName: z.string().min(1),
  storeCode: z.string().nullish(),
  shopId: z.string().nullish(),
  prefecture: z.string().nullish(),
  address: z.string().nullish(),
  storePhone: z.string().nullish(),
  businessHours: z.string().nullish(),
  requestDate: z.date().nullish(),
  requesterName: z.string().nullish(),
  requesterPhone: z.string().nullish(),
  requestContent: z.string().nullish(),
  workType: z.enum(["入替", "修理", "納品", "見積り", "新規"]).default("修理"),
  costBearer: z.enum(["店舗", "営業部", "その他"]).default("店舗"),
  categoryLarge: z.string().nullish(),
  categoryMedium: z.string().nullish(),
  categorySmall: z.string().nullish(),
  contractorName: z.string().nullish(),
  contractorPic: z.string().nullish(),
  contractorPhone: z.string().nullish(),
  partnerId: z.number().int().nullish(),
  status: z
    .enum(["受付", "現調中", "見積中", "施工待ち", "施工中", "完了", "クローズ"])
    .default("受付"),
  progressStage: z
    .enum(["未対応", "現調済", "見積提出済", "承認済"])
    .default("未対応"),
  urgency: z.enum(["S", "A", "B", "C"]).default("B"),
  assigneeId: z.number().int().nullish(),
  estimatedCost: z.number().int().nullish(),
  plenusQuoteAmount: z.number().int().nullish(),
  estimatedMaterialCost: z.number().int().nullish(),
  estimatedLaborCost: z.number().int().nullish(),
  is10mYen: z.boolean().default(false),
  actualCost: z.number().int().nullish(),
  actualMaterialCost: z.number().int().nullish(),
  actualLaborCost: z.number().int().nullish(),
  invoiceNumber: z.string().nullish(),
  invoiceDate: z.date().nullish(),
  surveyDate: z.date().nullish(),
  constructionDate: z.date().nullish(),
  completedAt: z.date().nullish(),
  notes: z.string().nullish(),
  surveyImpression: z.string().nullish(),
  surveyImpressionAuthor: z.string().nullish(),
});

// ============================================================
// Routers
// ============================================================
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  users: router({
    list: protectedProcedure.query(() => getAllUsers()),
  }),

  partners: router({
    list: protectedProcedure.query(() => listPartners()),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(({ input }) => getPartnerById(input.id)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          category: z
            .enum(["電気", "給排水", "空調", "厨房設備", "排気・換気", "内装", "床", "看板", "外壁", "建具", "防水", "その他"])
            .default("その他"),
          phone: z.string().nullish(),
          pic: z.string().nullish(),
          picPhone: z.string().nullish(),
          email: z.string().nullish(),
          address: z.string().nullish(),
          area: z.string().nullish(),
          notes: z.string().nullish(),
          isActive: z.boolean().default(true),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createPartner(input);
        return { id };
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z
            .object({
              name: z.string().min(1).optional(),
              category: z
                .enum(["電気", "給排水", "空調", "厨房設備", "排気・換気", "内装", "床", "看板", "外壁", "建具", "防水", "その他"])
                .optional(),
              phone: z.string().nullish(),
              pic: z.string().nullish(),
              picPhone: z.string().nullish(),
              email: z.string().nullish(),
              address: z.string().nullish(),
              area: z.string().nullish(),
              notes: z.string().nullish(),
              isActive: z.boolean().optional(),
            })
            .partial(),
        })
      )
      .mutation(async ({ input }) => {
        await updatePartner(input.id, input.data);
        return { success: true } as const;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePartner(input.id);
        return { success: true } as const;
      }),
    // 協力会社の一括登録（複数件）
    bulkCreate: protectedProcedure
      .input(
        z.object({
          rows: z
            .array(
              z.object({
                name: z.string().min(1),
                category: z
                  .enum(["電気", "給排水", "空調", "厨房設備", "排気・換気", "内装", "床", "看板", "外壁", "建具", "防水", "その他"])
                  .default("その他"),
                phone: z.string().nullish(),
                pic: z.string().nullish(),
                picPhone: z.string().nullish(),
                email: z.string().nullish(),
                address: z.string().nullish(),
                area: z.string().nullish(),
                notes: z.string().nullish(),
              })
            )
            .min(1),
        })
      )
      .mutation(async ({ input }) => {
        const results: { name: string; ok: boolean; error?: string }[] = [];
        let inserted = 0;
        let failed = 0;
        for (const row of input.rows) {
          try {
            await createPartner({ ...row, isActive: true });
            results.push({ name: row.name, ok: true });
            inserted++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "エラー";
            results.push({ name: row.name, ok: false, error: msg });
            failed++;
          }
        }
        return { results, inserted, failed };
      }),

    // 協力会社インポート用ファイル（画像/PDF/Excel）を一時保存
    uploadFile: protectedProcedure
      .input(
        z.object({
          fileName: z.string(),
          fileBase64: z.string(),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const base64 = input.fileBase64.includes(",")
          ? input.fileBase64.split(",")[1]
          : input.fileBase64;
        const buffer = Buffer.from(base64, "base64");
        const ext = input.fileName.includes(".")
          ? input.fileName.split(".").pop()
          : "bin";
        const key = `imports/partner-${ctx.user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { url, key: fileKey } = await storagePut(key, buffer, input.mimeType);
        return { fileKey, url, mimeType: input.mimeType };
      }),

    // 画像またはPDFからLLMで協力会社データを抽出
    extractFromFile: protectedProcedure
      .input(
        z.object({
          fileKey: z.string().min(1),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const key = input.fileKey.replace(/^\/manus-storage\//, "");
        const publicUrl = await storageGetSignedUrl(key);

        const partnerSchema = {
          type: "object",
          properties: {
            partners: {
              type: "array",
              description: "読み取れた協力会社の一覧",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "会社名" },
                  category: {
                    type: "string",
                    enum: ["電気", "給排水", "空調", "厨房設備", "排気・換気", "内装", "床", "看板", "外壁", "建具", "防水", "その他"],
                    description: "業種カテゴリ。不明ていれば「その他」",
                  },
                  phone: { type: "string", description: "代表電話" },
                  pic: { type: "string", description: "担当者名" },
                  picPhone: { type: "string", description: "担当者携帯" },
                  email: { type: "string", description: "メールアドレス" },
                  address: { type: "string", description: "住所" },
                  area: { type: "string", description: "対応エリア" },
                  notes: { type: "string", description: "備考" },
                },
                required: ["name"],
              },
            },
          },
          required: ["partners"],
        } as const;

        const fileMime = input.mimeType.startsWith("image/") ? "image" : "pdf";
        const fileContent =
          fileMime === "image"
            ? { type: "image_url" as const, image_url: { url: publicUrl, detail: "high" as const } }
            : { type: "file_url" as const, file_url: { url: publicUrl, mime_type: "application/pdf" as const } };

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "あなたは名刺・会社一覧表・請求書・リスト資料から協力会社情報を抽出するアシスタントです。複数件含まれる場合はリストとして返します。不明な項目は空文字とし、「会社名」は必ず抽出します。業種カテゴリは規定の値から適切なものを選びます。",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "この資料から協力会社情報を抽出し、JSONの partners 配列に入れて返してください。",
                },
                fileContent,
              ],
            },
          ],
          outputSchema: {
            name: "partner_extract",
            strict: false,
            schema: partnerSchema,
          },
        });

        const raw = response.choices?.[0]?.message?.content;
        const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((c: any) => c.text ?? "").join("") : "";
        let parsed: { partners?: any[] } = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("資料からの協力会社抽出結果をパースできませんでした");
        }

        const validCats = ["電気", "給排水", "空調", "厨房設備", "排気・換気", "内装", "床", "看板", "外壁", "建具", "防水", "その他"];
        const partners = (parsed.partners ?? [])
          .map((p: any) => ({
            name: String(p.name ?? "").trim(),
            category: validCats.includes(p.category) ? (p.category as any) : ("その他" as const),
            phone: p.phone ? String(p.phone) : "",
            pic: p.pic ? String(p.pic) : "",
            picPhone: p.picPhone ? String(p.picPhone) : "",
            email: p.email ? String(p.email) : "",
            address: p.address ? String(p.address) : "",
            area: p.area ? String(p.area) : "",
            notes: p.notes ? String(p.notes) : "",
          }))
          .filter((p: any) => p.name.length > 0);

        return { partners, rawText: text };
      }),

    // 協力会社の発注履歴・累計金額
    history: protectedProcedure
      .input(z.object({ partnerId: z.number() }))
      .query(async ({ input }) => {
        const partner = await getPartnerById(input.partnerId);
        const list = await listCasesByPartner(input.partnerId);
        const totalCases = list.length;
        const completedCases = list.filter((c) => c.status === "完了" || c.status === "クローズ").length;
        const totalEstimated = list.reduce((sum, c) => sum + (c.estimatedCost ?? 0), 0);
        const totalActual = list.reduce((sum, c) => sum + (c.actualCost ?? 0), 0);
        // ステータス別サマリー
        const statusCounts: Record<string, number> = {};
        for (const c of list) {
          statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
        }
        return {
          partner,
          cases: list,
          summary: {
            totalCases,
            completedCases,
            totalEstimated,
            totalActual,
            statusCounts,
          },
        };
      }),
  }),

  cases: router({
    list: protectedProcedure.query(() => listCases()),

    get: protectedProcedure.input(z.object({ id: z.number() })).query(({ input }) =>
      getCaseById(input.id)
    ),

    create: protectedProcedure.input(caseInputSchema).mutation(async ({ ctx, input }) => {
      // 都道府県が未入力なら住所から自動推定して補完（手入力は優先）
      const prefecture =
        input.prefecture && input.prefecture.trim()
          ? input.prefecture.trim()
          : detectPrefecture(input.address) ?? input.prefecture ?? null;
      const id = await createCase({ ...input, prefecture, createdBy: ctx.user.id });
      // デフォルトチェックリストを自動投入
      const items = DEFAULT_CHECKLIST.map((tpl) => ({
        caseId: id,
        phase: tpl.phase,
        orderNo: tpl.orderNo,
        title: tpl.title,
        description: tpl.description,
      }));
      await createChecklistItems(items);
      return { id };
    }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: caseInputSchema.partial() }))
      .mutation(async ({ input }) => {
        const data = { ...input.data };
        // 進捗ステージ⇔ステータスの連動（前進専用）
        if (data.progressStage != null || data.status != null) {
          const current = await getCaseById(input.id);
          if (current) {
            const resolved = resolveStageStatus({
              currentStage: (current.progressStage as ProgressStage) ?? "未対応",
              currentStatus: (current.status as CaseStatus) ?? "受付",
              nextStage: data.progressStage as ProgressStage | undefined,
              nextStatus: data.status as CaseStatus | undefined,
            });
            data.progressStage = resolved.progressStage;
            data.status = resolved.status;
          }
        }
        // 都道府県の補完：明示値が空で住所が更新されたら住所から推定
        if ((data.prefecture == null || data.prefecture.trim() === "") && data.address) {
          const detected = detectPrefecture(data.address);
          if (detected) data.prefecture = detected;
        } else if (data.prefecture != null) {
          data.prefecture = data.prefecture.trim() || null;
        }
        await updateCase(input.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCase(input.id);
        return { success: true };
      }),

    // PDFファイルをアップロードして一時保存し、5分有効の入力トークンURLを返す
    uploadPdf: protectedProcedure
      .input(
        z.object({
          fileName: z.string(),
          fileBase64: z.string(),
          mimeType: z.string().default("application/pdf"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const base64 = input.fileBase64.includes(",")
          ? input.fileBase64.split(",")[1]
          : input.fileBase64;
        const buffer = Buffer.from(base64, "base64");
        const ext = input.fileName.includes(".")
          ? input.fileName.split(".").pop()
          : "pdf";
        const key = `imports/case-${ctx.user.id}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { url, key: fileKey } = await storagePut(key, buffer, input.mimeType);
        return { fileKey, url };
      }),

    // アップロード済PDFのURLを受け取り、LLMで案件データを抽出
    extractFromPdf: protectedProcedure
      .input(z.object({ fileKey: z.string().min(1) }))
      .mutation(async ({ input }) => {
        // ストレージのS3署名URLを取得（LLMが直接フェッチ可能）
        const key = input.fileKey.replace(/^\/manus-storage\//, "");
        const publicUrl = await storageGetSignedUrl(key);

        const schema = {
          type: "object",
          properties: {
            requestNumber: { type: "string", description: "依頼番号 例: 285236-1" },
            brand: {
              type: "string",
              enum: ["ほっともっと", "やよい軒", "その他"],
              description: "ブランド名",
            },
            storeName: { type: "string", description: "店舗名（漢字）" },
            storeCode: { type: "string", description: "店舗コード" },
            shopId: { type: "string", description: "SHOP-ID" },
            address: { type: "string", description: "住所" },
            storePhone: { type: "string", description: "店舗電話番号" },
            businessHours: { type: "string", description: "営業時間 例: 10:00〜23:00" },
            requestDateText: { type: "string", description: "依頼日時をISOまたは原文まま" },
            requesterName: { type: "string", description: "依頼者名" },
            requesterPhone: { type: "string", description: "依頼者連絡先" },
            requestContent: { type: "string", description: "依頼内容・作業詳細" },
            workType: {
              type: "string",
              enum: ["入替", "修理", "納品", "見積り", "新規"],
              description: "依頼時作業区分",
            },
            costBearer: {
              type: "string",
              enum: ["店舗", "営業部", "その他"],
              description: "依頼時負担区分",
            },
            categoryLarge: { type: "string", description: "修理内容 大項目" },
            categoryMedium: { type: "string", description: "修理内容 中項目" },
            categorySmall: { type: "string", description: "修理内容 小項目" },
            contractorName: { type: "string", description: "取引先名（漢字）" },
            contractorPic: { type: "string", description: "取引先責任者名" },
            contractorPhone: { type: "string", description: "取引先責任者連絡先" },
            urgency: { type: "string", enum: ["S", "A", "B", "C"], description: "緊急度" },
            plenusQuoteAmountText: {
              type: "string",
              description:
                "プレナスへ提出する見積金額（出し見積・税抜の合計請求額）。PDFに記載があれば数字のみ（カンマ可）で。無ければ空文字列。",
            },
            estimatedCostText: {
              type: "string",
              description:
                "協力業者への実行（指値）見積金額・実行予算（原価）。PDFに記載があれば数字のみ（カンマ可）で。無ければ空文字列。",
            },
          },
          required: ["requestNumber", "storeName"],
          additionalProperties: false,
        } as const;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "あなたはプレナス修理依頼システムの抽出アシスタントです。PDF画面を読み、抽出できる項目だけを返します。不明な項目は空文字列として返し、推測で埋めないでください。依頼番号と店舗名は必ず抽出します。",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "以下の「依頼進捗更新」PDFから店舗情報・依頼内容・修理区分・取引先を抽出してJSONで返してください。見積金額の記載（プレナスへの出し見積額、協力業者への実行・指値見積額）があれば plenusQuoteAmountText / estimatedCostText に数字で記入し、無ければ空文字列にしてください。",
                },
                {
                  type: "file_url",
                  file_url: { url: publicUrl, mime_type: "application/pdf" },
                },
              ],
            },
          ],
          outputSchema: {
            name: "plenus_case_extract",
            strict: false,
            schema,
          },
        });

        const raw = response.choices?.[0]?.message?.content;
        const text = contentToText(raw);

        // LLM応答が空（モデル側の失敗・タイムアウト等）の場合は分かりやすく通知
        if (!text.trim()) {
          throw new Error(
            "PDFから情報を読み取れませんでした。スキャン画質や向きを確認のうえ、もう一度お試しください。"
          );
        }

        // コードフェンスや前後説明文を含んでもパースできるよう堅牢化。
        // パースに失敗しても例外にはせず、空オブジェクトにフォールバックして
        // 手入力できる状態（rawText付き）で返す。
        const parsed: Record<string, any> = parseLlmJson(text) ?? {};
        const parseFailed = Object.keys(parsed).length === 0;

        // 依頼日時をDateに試行変換
        let requestDate: Date | null = null;
        if (parsed.requestDateText) {
          const t = String(parsed.requestDateText).replace(/\u3000/g, " ");
          const d = new Date(t.replace(/\//g, "-"));
          if (!isNaN(d.getTime())) requestDate = d;
        }

        return {
          extracted: {
            requestNumber: parsed.requestNumber ?? "",
            brand: ["ほっともっと", "やよい軒", "その他"].includes(parsed.brand) ? parsed.brand : "ほっともっと",
            storeName: parsed.storeName ?? "",
            storeCode: parsed.storeCode ?? "",
            shopId: parsed.shopId ?? "",
            address: parsed.address ?? "",
            storePhone: parsed.storePhone ?? "",
            businessHours: parsed.businessHours ?? "",
            requestDate,
            requesterName: parsed.requesterName ?? "",
            requesterPhone: parsed.requesterPhone ?? "",
            requestContent: parsed.requestContent ?? "",
            workType: ["入替", "修理", "納品", "見積り", "新規"].includes(parsed.workType) ? parsed.workType : "修理",
            costBearer: ["店舗", "営業部", "その他"].includes(parsed.costBearer) ? parsed.costBearer : "店舗",
            categoryLarge: parsed.categoryLarge ?? "",
            categoryMedium: parsed.categoryMedium ?? "",
            categorySmall: parsed.categorySmall ?? "",
            contractorName: parsed.contractorName ?? "",
            contractorPic: parsed.contractorPic ?? "",
            contractorPhone: parsed.contractorPhone ?? "",
            urgency: ["S", "A", "B", "C"].includes(parsed.urgency) ? parsed.urgency : "B",
            plenusQuoteAmount: parseAmount(parsed.plenusQuoteAmountText),
            estimatedCost: parseAmount(parsed.estimatedCostText),
          },
          rawText: text,
          // 構造化抽出に失敗した場合のフラグ（フロントで注意喚起に利用）
          parseFailed,
        };
      }),

    // アップロード済PDFから埋め込み現況写真を抽出し、案件の写真（現調）として保存
    extractPhotosFromPdf: protectedProcedure
      .input(
        z.object({
          caseId: z.number(),
          fileKey: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 署名付きURLでPDFバイナリを取得
        const key = input.fileKey.replace(/^\/manus-storage\//, "");
        const signedUrl = await storageGetSignedUrl(key);
        const resp = await fetch(signedUrl);
        if (!resp.ok) {
          throw new Error("PDFの取得に失敗しました");
        }
        const pdfBuffer = Buffer.from(await resp.arrayBuffer());

        // 埋め込み画像を抽出（小さすぎるロゴ等は除外）
        let images: Awaited<ReturnType<typeof extractPdfEmbeddedImages>> = [];
        try {
          images = await extractPdfEmbeddedImages(pdfBuffer, {
            minWidth: 200,
            minHeight: 200,
            maxImages: 30,
            quality: 82,
          });
        } catch {
          // 抽出ライブラリでの失敗時は0枚として返す（致命的エラーにしない）
          images = [];
        }

        if (images.length === 0) {
          return { saved: 0, photos: [] as { id: number; url: string }[] };
        }

        // ストレージへ保存し、photos テーブルへ現調として登録
        const saved: { id: number; url: string }[] = [];
        let order = 0;
        for (const img of images) {
          const pkey = `case-${input.caseId}/pdf-current-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}.jpg`;
          const { url, key: fileKey } = await storagePut(pkey, img.data, "image/jpeg");
          const id = await createPhoto({
            caseId: input.caseId,
            fileKey,
            fileUrl: url,
            photoType: "現調",
            workCategory: null,
            workItem: null,
            memo: "依頼PDFから自動取り込み",
            orderNo: order++,
            uploadedBy: ctx.user.id,
          });
          saved.push({ id, url });
        }

        return { saved: saved.length, photos: saved };
      }),

    // CSV一括インポート
    bulkImport: protectedProcedure
      .input(z.object({ rows: z.array(caseInputSchema).min(1, "最低1件必要です") }))
      .mutation(async ({ ctx, input }) => {
        const results: { requestNumber: string; ok: boolean; error?: string }[] = [];
        let inserted = 0;
        let failed = 0;
        for (const row of input.rows) {
          try {
            const prefecture =
              row.prefecture && row.prefecture.trim()
                ? row.prefecture.trim()
                : detectPrefecture(row.address) ?? row.prefecture ?? null;
            const id = await createCase({ ...row, prefecture, createdBy: ctx.user.id });
            const items = DEFAULT_CHECKLIST.map((tpl) => ({
              caseId: id,
              phase: tpl.phase,
              orderNo: tpl.orderNo,
              title: tpl.title,
              description: tpl.description,
            }));
            await createChecklistItems(items);
            results.push({ requestNumber: row.requestNumber, ok: true });
            inserted++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "エラー";
            results.push({ requestNumber: row.requestNumber, ok: false, error: msg });
            failed++;
          }
        }
        return { results, inserted, failed };
      }),

    // 予実サマリー（管理者のみ・予算 = 見積 × 75%）
    summary: adminProcedure.query(async () => {
      const cases = await listCases();
      const total = cases.length;
      const totalEstimated = cases.reduce((s, c) => s + (c.estimatedCost ?? 0), 0);
      const totalBudget = calcBudget(totalEstimated);
      const totalActual = cases.reduce((s, c) => s + (c.actualCost ?? 0), 0);
      const completed = cases.filter((c) => c.status === "完了").length;
      const inProgress = cases.filter((c) =>
        ["現調中", "見積中", "施工待ち", "施工中"].includes(c.status)
      ).length;
      const byStatus = cases.reduce<Record<string, number>>((acc, c) => {
        acc[c.status] = (acc[c.status] ?? 0) + 1;
        return acc;
      }, {});
      return {
        total,
        completed,
        inProgress,
        totalEstimated,
        totalBudget,
        budgetRatio: BUDGET_RATIO,
        totalActual,
        diff: totalActual - totalBudget,
        byStatus,
      };
    }),

    // 月次レポート（月別・店舗別集計、管理者のみ）
    monthlyReport: adminProcedure.query(async () => {
      const cases = await listCases();
      // 基準日：completedAt > constructionDate > surveyDate > createdAt
      const monthly: Record<string, { yearMonth: string; count: number; completed: number; estimated: number; actual: number }> = {};
      const byStore: Record<string, { storeName: string; count: number; completed: number; estimated: number; actual: number }> = {};
      for (const c of cases) {
        const base = c.completedAt ?? c.constructionDate ?? c.surveyDate ?? c.createdAt;
        if (!base) continue;
        const d = new Date(base);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthly[ym]) monthly[ym] = { yearMonth: ym, count: 0, completed: 0, estimated: 0, actual: 0 };
        monthly[ym].count += 1;
        if (c.status === "完了") monthly[ym].completed += 1;
        monthly[ym].estimated += c.estimatedCost ?? 0;
        monthly[ym].actual += c.actualCost ?? 0;

        const sk = c.storeName ?? "(未設定)";
        if (!byStore[sk]) byStore[sk] = { storeName: sk, count: 0, completed: 0, estimated: 0, actual: 0 };
        byStore[sk].count += 1;
        if (c.status === "完了") byStore[sk].completed += 1;
        byStore[sk].estimated += c.estimatedCost ?? 0;
        byStore[sk].actual += c.actualCost ?? 0;
      }
      const monthlyArr = Object.values(monthly)
        .map((m) => ({ ...m, budget: calcBudget(m.estimated), diff: m.actual - calcBudget(m.estimated) }))
        .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
      const storeArr = Object.values(byStore)
        .map((s) => ({ ...s, budget: calcBudget(s.estimated), diff: s.actual - calcBudget(s.estimated) }))
        .sort((a, b) => b.actual - a.actual);
            return { monthly: monthlyArr, byStore: storeArr, budgetRatio: BUDGET_RATIO };
    }),
    // 現調報告書の所感をAIで生成
    generateImpression: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .mutation(async ({ input }) => {
        const c = await getCaseById(input.caseId);
        if (!c) throw new Error("案件が見つかりません");
        const prompt = [
          "あなたは建物・設備の現場調査担当者です。以下の案件情報をもとに、現場調査後の所感を簡潔に書いてください。",
          "所感は3〜5文程度で、現場の状況、推定される原因、推奨する対応策を含めてください。",
          "専門用語を適度に使い、実務的なトーンで書いてください。",
          "",
          `店舗名: ${c.storeName}`,
          `依頼内容: ${c.requestContent || "なし"}`,
          `工事区分(大): ${c.categoryLarge || "なし"}`,
          `工事区分(中): ${c.categoryMedium || "なし"}`,
          `工事区分(小): ${c.categorySmall || "なし"}`,
          `備考: ${c.notes || "なし"}`,
        ].join("\n");
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "現場調査の所感を日本語で書くアシスタントです。平易で実務的な文章を心がけてください。" },
            { role: "user", content: prompt },
          ],
        });
        const raw = response.choices?.[0]?.message?.content ?? "";
        const text = typeof raw === "string" ? raw : "";
        return { impression: text.trim() };
      }),
  }),
  checklist: router({
    listByCase: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => getChecklistByCaseId(input.caseId)),

    toggle: protectedProcedure
      .input(z.object({ id: z.number(), checked: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await updateChecklistItem(input.id, {
          checked: input.checked,
          checkedAt: input.checked ? new Date() : null,
          checkedBy: input.checked ? ctx.user.id : null,
        });
        // ステータス自動遷移
        let autoAdvanced: { from: string; to: string } | null = null;
        try {
          // このチェック項目の所属ケースとフェーズを特定
          const items = await import("./db").then((m) => m.getChecklistItemById(input.id));
          if (items && input.checked) {
            const caseData = await getCaseById(items.caseId);
            if (caseData) {
              const all = await getChecklistByCaseId(items.caseId);
              const phaseItems = all.filter((i) => i.phase === items.phase);
              const allChecked = phaseItems.length > 0 && phaseItems.every((i) => i.checked);
              if (allChecked) {
                const phaseToNext: Record<string, string> = {
                  受付: "現調中",
                  現調: "見積中",
                  施工: "完了",
                  完了: "クローズ",
                };
                const next = phaseToNext[items.phase];
                // 現在のステータスより進んだもののみ適用（逆行しない）
                const order = ["受付", "現調中", "見積中", "施工待ち", "施工中", "完了", "クローズ"];
                if (next && order.indexOf(next) > order.indexOf(caseData.status)) {
                  // ステータス前進に合わせて進捗ステージも連動（前進専用）
                  const nextStage = syncStageFromStatus(
                    next as CaseStatus,
                    (caseData.progressStage as ProgressStage) ?? "未対応",
                  );
                  await updateCase(items.caseId, {
                    status: next as any,
                    progressStage: nextStage as any,
                  });
                  autoAdvanced = { from: caseData.status, to: next };
                }
              }
            }
          }
        } catch (e) {
          console.warn("[autoAdvance] failed:", e);
        }
        return { success: true, autoAdvanced };
      }),

    updateMemo: protectedProcedure
      .input(z.object({ id: z.number(), memo: z.string() }))
      .mutation(async ({ input }) => {
        await updateChecklistItem(input.id, { memo: input.memo });
        return { success: true };
      }),
  }),

  photos: router({
    listByCase: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => getPhotosByCaseId(input.caseId)),

    // 複数案件の写真+案件情報を一括取得（一括写真台帳PDF用）
    listByCases: protectedProcedure
      .input(z.object({ caseIds: z.array(z.number()).min(1).max(100) }))
      .query(async ({ input }) => {
        const [photoRows, caseRows] = await Promise.all([
          getPhotosByCaseIds(input.caseIds),
          getCasesByIds(input.caseIds),
        ]);
        return { photos: photoRows, cases: caseRows };
      }),

    upload: protectedProcedure
      .input(
        z.object({
          caseId: z.number(),
          fileName: z.string(),
          fileBase64: z.string(), // data URL or raw base64
          mimeType: z.string(),
          photoType: z
            .enum([
              "施工前A",
              "施工前B",
              "施工中",
              "施工後A",
              "施工後B",
              "設置状況",
              "メーカー型番",
              "現調",
              "その他",
            ])
            .default("現調"),
          workCategory: z.string().nullish(),
          workItem: z.string().nullish(),
          memo: z.string().nullish(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // base64デコード
        const base64 = input.fileBase64.includes(",")
          ? input.fileBase64.split(",")[1]
          : input.fileBase64;
        const buffer = Buffer.from(base64, "base64");
        const ext = input.fileName.includes(".")
          ? input.fileName.split(".").pop()
          : "jpg";
        const key = `case-${input.caseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { url, key: fileKey } = await storagePut(key, buffer, input.mimeType);
        const id = await createPhoto({
          caseId: input.caseId,
          fileKey,
          fileUrl: url,
          photoType: input.photoType,
          workCategory: input.workCategory ?? null,
          workItem: input.workItem ?? null,
          memo: input.memo ?? null,
          uploadedBy: ctx.user.id,
        });
        return { id, url };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          photoType: z
            .enum([
              "施工前A",
              "施工前B",
              "施工中",
              "施工後A",
              "施工後B",
              "設置状況",
              "メーカー型番",
              "現調",
              "その他",
            ])
            .optional(),
          workCategory: z.string().nullish(),
          workItem: z.string().nullish(),
          memo: z.string().nullish(),
          rotation: z
            .number()
            .int()
            .refine((v) => [0, 90, 180, 270].includes(v), {
              message: "rotationは 0/90/180/270 のいずれかである必要があります",
            })
            .optional(),
          orderNo: z.number().int().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updatePhoto(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePhoto(input.id);
        return { success: true };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getPhotoById(input.id)),
  }),

  // ==========================================================
  // 報告書署名（v37: 現場調査報告書／施工完了報告書のプレナス責任者サイン）
  // ==========================================================
  signatures: router({
    // 案件の署名一覧（survey/completion両方）を取得
    getByCase: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => listSignaturesByCase(input.caseId)),

    // 案件×報告書種別で署名を1件取得
    get: protectedProcedure
      .input(
        z.object({
          caseId: z.number(),
          reportType: z.enum(["survey", "completion"]),
        })
      )
      .query(({ input }) => getSignature(input.caseId, input.reportType)),

    // 署名画像（PNG dataURL/base64）を受け取りS3保存→DBにupsert
    save: protectedProcedure
      .input(
        z.object({
          caseId: z.number(),
          reportType: z.enum(["survey", "completion"]),
          signerName: z.string().nullish(),
          imageBase64: z.string(), // data URL or raw base64 (PNG想定)
        })
      )
      .mutation(async ({ ctx, input }) => {
        const base64 = input.imageBase64.includes(",")
          ? input.imageBase64.split(",")[1]
          : input.imageBase64;
        const buffer = Buffer.from(base64, "base64");
        const key = `case-${input.caseId}/signatures/${input.reportType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        const { url, key: fileKey } = await storagePut(key, buffer, "image/png");
        const id = await upsertSignature({
          caseId: input.caseId,
          reportType: input.reportType,
          signerName: input.signerName ?? null,
          fileKey,
          fileUrl: url,
          signedAt: new Date(),
          createdBy: ctx.user.id,
        });
        return { id, url, fileKey };
      }),

    // 署名を削除（案件×報告書種別）
    delete: protectedProcedure
      .input(
        z.object({
          caseId: z.number(),
          reportType: z.enum(["survey", "completion"]),
        })
      )
      .mutation(async ({ input }) => {
        await deleteSignature(input.caseId, input.reportType);
        return { success: true };
      }),
  }),

  // ==========================================================
  // 施工完了報告書ドラフト（v40: 参考PDF準拠のセクション文章をAI生成＋手編集保存）
  // 金額は一切含めない。原因等の断定表現は禁止。不明な点は空欄のままにする。
  // ==========================================================
  reportDraft: router({
    // 案件の完了報告書ドラフトを取得（無ければ空のcontentを返す）
    get: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .query(async ({ input }) => {
        const row = await getReportDraft(input.caseId);
        return {
          content: parseCompletionContent(row?.content),
          generatedAt: row?.generatedAt ?? null,
          updatedAt: row?.updatedAt ?? null,
          exists: !!row,
        };
      }),

    // 手編集後のcontentを保存（JSON文字列化してupsert）
    save: protectedProcedure
      .input(
        z.object({
          caseId: z.number(),
          content: z.any(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const content = parseCompletionContent(JSON.stringify(input.content));
        await upsertReportDraft({
          caseId: input.caseId,
          content: JSON.stringify(content),
          updatedBy: ctx.user.id,
        });
        return { success: true };
      }),

    // AIでセクション文章＋写真キャプションを生成して保存し、生成結果を返す。
    generate: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const caseData = await getCaseById(input.caseId);
        if (!caseData) throw new Error("案件が見つかりません");
        const photos = await getPhotosByCaseId(input.caseId);

        // 写真をAIに渡す（最大16枚まで。区分・工事項目・メモも添える）
        const photoForLlm = photos
          .filter((p) =>
            ["現調", "施工前A", "施工前B", "施工後A", "施工後B", "設置状況", "メーカー型番", "その他"].includes(
              p.photoType
            )
          )
          .slice(0, 16);
        const signedPhotoUrls = await Promise.all(
          photoForLlm.map(async (p) => {
            try {
              const key = p.fileUrl.replace(/^\/manus-storage\//, "").replace(/^https?:\/\/[^/]+\/manus-storage\//, "");
              return { id: p.id, url: await storageGetSignedUrl(key), photo: p };
            } catch {
              return { id: p.id, url: null, photo: p };
            }
          })
        );

        const caseSummary = [
          `店舗名: ${caseData.storeName}`,
          `ブランド: ${caseData.brand}`,
          `作業区分: ${caseData.workType ?? ""}`,
          `工事種別: ${[caseData.categoryLarge, caseData.categoryMedium, caseData.categorySmall].filter(Boolean).join(" / ")}`,
          `依頼内容: ${caseData.requestContent ?? ""}`,
          `備考: ${caseData.notes ?? ""}`,
        ].join("\n");

        const photoListText = photoForLlm
          .map(
            (p, i) =>
              `写真${i + 1}(photoId=${p.id}, 区分=${p.photoType}${p.workItem ? `, 工事項目=${p.workItem}` : ""}${p.memo ? `, メモ=${p.memo}` : ""})`
          )
          .join("\n");

        const schema = {
          type: "object",
          properties: {
            workName: { type: "string" },
            statusBadge: { type: "string" },
            overview: { type: "string" },
            purpose: { type: "string" },
            scope: { type: "string" },
            summary: { type: "string" },
            evaluations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  before: { type: "string" },
                  after: { type: "string" },
                  judgment: { type: "string" },
                },
                required: ["item", "before", "after", "judgment"],
              },
            },
            measurements: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, value: { type: "string" } },
                required: ["name", "value"],
              },
            },
            materials: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, spec: { type: "string" }, qty: { type: "string" } },
                required: ["name", "spec", "qty"],
              },
            },
            procedures: {
              type: "array",
              items: {
                type: "object",
                properties: { step: { type: "string" }, detail: { type: "string" } },
                required: ["step", "detail"],
              },
            },
            conclusion: { type: "string" },
            inspections: {
              type: "array",
              items: {
                type: "object",
                properties: { timing: { type: "string" }, target: { type: "string" }, note: { type: "string" } },
                required: ["timing", "target", "note"],
              },
            },
            risks: {
              type: "array",
              items: {
                type: "object",
                properties: { part: { type: "string" }, risk: { type: "string" }, level: { type: "string" } },
                required: ["part", "risk", "level"],
              },
            },
            photoCaptions: {
              type: "array",
              items: {
                type: "object",
                properties: { photoId: { type: "number" }, caption: { type: "string" } },
                required: ["photoId", "caption"],
              },
            },
          },
          required: [
            "workName",
            "statusBadge",
            "overview",
            "purpose",
            "scope",
            "summary",
            "evaluations",
            "measurements",
            "materials",
            "procedures",
            "conclusion",
            "inspections",
            "risks",
            "photoCaptions",
          ],
        };

        const systemPrompt = [
          "あなたは内外装・設備の施工完了報告書を作成する建設アシスタントです。",
          "以下の案件情報と現場写真をもとに、施工完了報告書のセクション文章を日本語で作成し、指定JSONで返してください。",
          "厳守事項:",
          "1. 金額・費用・価格に一切触れないこと（数字・概算も禁止）。",
          "2. 原因・責任・劣化要因などを断定しないこと。確認できない事項は推測で埋めず、空文字または空配列にすること。",
          "3. 各文章は簡潔・短めにすること（1〜3文程度）。冗長にしない。",
          "4. 写真から読み取れる範囲で客観的に記述する。読み取れない場合はキャプションを短い事実記述（例:『施工前の状態』『施工後の状態』）に留める。",
          "5. evaluations/measurements/materials/procedures/inspections/risks は確証がある範囲のみ。情報が無ければ空配列で良い。",
          "6. statusBadge は基本『工事完了』。明確に解消が確認できる場合のみ『工事完了 / 損傷レベル：解消済』。",
          "7. photoCaptions は渡された photoId に対してのみ、短い確認内容を返すこと。",
          "8. 丸括弧（ （ ） や ( ) ）は使わず、補足は読点や中黒・で区切ること。",
        ].join("\n");

        const userContent: any[] = [
          {
            type: "text",
            text: `【案件情報】\n${caseSummary}\n\n【写真一覧】\n${photoListText || "写真なし"}\n\n上記をもとに施工完了報告書のJSONを作成してください。`,
          },
        ];
        for (const sp of signedPhotoUrls) {
          if (sp.url) {
            userContent.push({ type: "text", text: `photoId=${sp.id} 区分=${sp.photo.photoType}` });
            userContent.push({ type: "image_url", image_url: { url: sp.url, detail: "low" } });
          }
        }

        let generated: CompletionReportContent = { ...EMPTY_COMPLETION_CONTENT };
        try {
          const res = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: "completion_report", strict: false, schema },
            },
          });
          const content = res.choices?.[0]?.message?.content ?? "{}";
          generated = parseCompletionContent(typeof content === "string" ? content : JSON.stringify(content));
        } catch (e) {
          console.warn("[reportDraft.generate] LLM生成失敗", e);
          throw new Error("報告書の自動生成に失敗しました。時間をおいて再度お試しください。");
        }

        // 既存ドラフトがあれば手編集を尊重しつつマージはせず、生成結果で上書き保存する
        await upsertReportDraft({
          caseId: input.caseId,
          content: JSON.stringify(generated),
          generatedAt: new Date(),
          updatedBy: ctx.user.id,
        });
        return { content: generated };
      }),
  }),

  // ==========================================================
  // メディア（PDF生成用に画像を base64 dataURL 化するフォールバック）
  // ==========================================================
  media: router({
    // /manus-storage/... の画像をサーバー側で取得し base64 dataURL で返す。
    // クライアントの直fetchが CORS/リダイレクトで失敗した場合のフォールバック。
    toDataUrl: protectedProcedure
      .input(z.object({ src: z.string().min(1) }))
      .mutation(async ({ input }) => {
        // 受け取るのは /manus-storage/{key} もしくは {key} を想定
        let src = input.src;
        try {
          // 絶対URLで渡ってきた場合はパス部分だけ使う
          if (/^https?:\/\//i.test(src)) {
            src = new URL(src).pathname;
          }
        } catch {
          // noop
        }
        const key = src.replace(/^\/manus-storage\//, "").replace(/^\/+/, "");
        if (!key) throw new Error("画像キーが不正です");
        const signedUrl = await storageGetSignedUrl(key);
        const resp = await fetch(signedUrl);
        if (!resp.ok) {
          throw new Error(`画像の取得に失敗しました (${resp.status})`);
        }
        const contentType =
          resp.headers.get("content-type") || "application/octet-stream";
        const buf = Buffer.from(await resp.arrayBuffer());
        if (!buf.length) throw new Error("画像が空です");
        const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
        return { dataUrl };
      }),
  }),

  // ==========================================================
  // 見積書（PDF/画像アップロード + LLM金額抽出）
  // ==========================================================
  estimates: router({
    listByCase: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .query(({ input }) => listEstimatesByCase(input.caseId)),

    uploadFile: protectedProcedure
      .input(
        z.object({
          caseId: z.number(),
          fileName: z.string().min(1),
          fileBase64: z.string().min(1),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const base64 = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const safe = input.fileName.replace(/[^\w\d._-]/g, "_");
        const key = `estimates/case-${input.caseId}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}_${safe}`;
        const { url, key: fileKey } = await storagePut(key, buffer, input.mimeType);
        return { fileKey, url, mimeType: input.mimeType };
      }),

    extractAndCreate: protectedProcedure
      .input(
        z.object({
          caseId: z.number(),
          fileKey: z.string().min(1),
          fileUrl: z.string().min(1),
          fileName: z.string().optional(),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const key = input.fileKey.replace(/^\/manus-storage\//, "");
        const publicUrl = await storageGetSignedUrl(key);
        const isImage = input.mimeType.startsWith("image/");
        const schema = {
          type: "object",
          properties: {
            totalAmount: { type: ["number", "null"], description: "見積合計金額(税込もしくは税抜の大きい方、円)" },
            materialAmount: { type: ["number", "null"], description: "材料費小計" },
            laborAmount: { type: ["number", "null"], description: "作業費小計" },
            vendorName: { type: ["string", "null"], description: "見積を作成した会社名" },
            estimateDate: { type: ["string", "null"], description: "見積日 (YYYY-MM-DD)" },
            note: { type: ["string", "null"], description: "他に重要なメモ" },
          },
          required: [
            "totalAmount",
            "materialAmount",
            "laborAmount",
            "vendorName",
            "estimateDate",
            "note",
          ],
          additionalProperties: false,
        };
        const messages: any = [
          {
            role: "system",
            content:
              "あなたは見積書から金額を読み取るアシスタントです。合計金額・材料費・作業費・会社名・見積日をJSONで返してください。「合計」「ご請求金額」「合計（税込）」などの記載を探し、不明なfieldはnullとしてください。金額は円単位の整数。",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "この見積書から金額を抽出してJSONで返してください" },
              isImage
                ? { type: "image_url", image_url: { url: publicUrl, detail: "high" } }
                : { type: "file_url", file_url: { url: publicUrl, mime_type: "application/pdf" } },
            ],
          },
        ];
        let totalAmount: number | null = null;
        let materialAmount: number | null = null;
        let laborAmount: number | null = null;
        let vendorName: string | null = null;
        let estimateDate: Date | null = null;
        let note: string | null = null;
        try {
          const res = await invokeLLM({
            messages,
            response_format: {
              type: "json_schema",
              json_schema: { name: "estimate_extract", strict: false, schema },
            },
          });
          const content = res.choices?.[0]?.message?.content ?? "{}";
          const parsed = typeof content === "string" ? JSON.parse(content) : content;
          totalAmount = parsed.totalAmount ?? null;
          materialAmount = parsed.materialAmount ?? null;
          laborAmount = parsed.laborAmount ?? null;
          vendorName = parsed.vendorName ?? null;
          estimateDate = parsed.estimateDate ? new Date(parsed.estimateDate) : null;
          note = parsed.note ?? null;
        } catch (e) {
          console.warn("[estimates.extract] LLM抽出失敗", e);
        }

        const id = await createEstimate({
          caseId: input.caseId,
          fileKey: input.fileKey,
          fileUrl: input.fileUrl,
          fileName: input.fileName ?? null,
          mimeType: input.mimeType,
          totalAmount: totalAmount ?? undefined,
          materialAmount: materialAmount ?? undefined,
          laborAmount: laborAmount ?? undefined,
          vendorName: vendorName ?? undefined,
          estimateDate: estimateDate ?? undefined,
          note: note ?? undefined,
          uploadedBy: ctx.user.id,
        });

        // 案件のestimatedCostを「同一案件の見積レコードのうち最新」を採用して更新
        try {
          const ests = await listEstimatesByCase(input.caseId);
          const picked = pickLatestEstimate(ests);
          if (picked) {
            const upd: any = { estimatedCost: picked.totalAmount };
            if (picked.materialAmount != null) upd.estimatedMaterialCost = picked.materialAmount;
            if (picked.laborAmount != null) upd.estimatedLaborCost = picked.laborAmount;
            await updateCase(input.caseId, upd);
          }
        } catch (e) {
          console.warn("[estimates.uploadFile] estimatedCost同期失敗", e);
        }

        return {
          id,
          totalAmount,
          materialAmount,
          laborAmount,
          vendorName,
          estimateDate,
          note,
        };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          totalAmount: z.number().nullish(),
          materialAmount: z.number().nullish(),
          laborAmount: z.number().nullish(),
          vendorName: z.string().nullish(),
          estimateDate: z.date().nullish(),
          note: z.string().nullish(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const db = await (await import("./db")).getDb();
        if (!db) throw new Error("DB not available");
        const { estimates: estimatesTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(estimatesTable).set(data as any).where(eq(estimatesTable.id, id));
        // 見積合計が更新されたらcasesのestimatedCostも同期（同一案件の最新見積を採用）
        const est = await getEstimateById(id);
        if (est) {
          const ests = await listEstimatesByCase(est.caseId);
          const picked = pickLatestEstimate(ests);
          if (picked) {
            const upd: any = { estimatedCost: picked.totalAmount };
            if (picked.materialAmount != null) upd.estimatedMaterialCost = picked.materialAmount;
            if (picked.laborAmount != null) upd.estimatedLaborCost = picked.laborAmount;
            await updateCase(est.caseId, upd);
          }
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteEstimateById(input.id);
        return { success: true };
      }),

    // 一括取込: ファイルから金額+依頼番号/案件名/店舗名を抽出しマッチ候補を返す
    extractAndMatch: protectedProcedure
      .input(
        z.object({
          fileKey: z.string().min(1),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const key = input.fileKey.replace(/^\/manus-storage\//, "");
        const publicUrl = await storageGetSignedUrl(key);
        const isImage = input.mimeType.startsWith("image/");
        const schema = {
          type: "object",
          properties: {
            totalAmount: { type: ["number", "null"], description: "見積合計金額(円)" },
            materialAmount: { type: ["number", "null"], description: "材料費小計" },
            laborAmount: { type: ["number", "null"], description: "作業費小計" },
            vendorName: { type: ["string", "null"], description: "見積を作成した会社名" },
            estimateDate: { type: ["string", "null"], description: "見積日(YYYY-MM-DD)" },
            requestNumber: { type: ["string", "null"], description: "依頼番号・件名番号・オーダーNoなど識別番号" },
            caseTitle: { type: ["string", "null"], description: "案件名・件名・工事名称" },
            storeName: { type: ["string", "null"], description: "店舗名・現場名" },
            note: { type: ["string", "null"], description: "他メモ" },
          },
          required: [
            "totalAmount", "materialAmount", "laborAmount", "vendorName",
            "estimateDate", "requestNumber", "caseTitle", "storeName", "note",
          ],
          additionalProperties: false,
        };
        const messages: any = [
          {
            role: "system",
            content:
              "あなたは見積書・請求書から情報を抽出するAIです。金額、依頼番号、案件名、店舗名をJSONで返してください。依頼番号は「件名」「ORDER NO」「依頼」「依頼番号」「受付番号」などの項目を探し、英数・ハイフン・アンダースコアをそのまま返します。不明なnull。金額は円単位整数。",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "この見積書から金額と依頼番号・案件名・店舗名を抽出してJSONで返してください" },
              isImage
                ? { type: "image_url", image_url: { url: publicUrl, detail: "high" } }
                : { type: "file_url", file_url: { url: publicUrl, mime_type: "application/pdf" } },
            ],
          },
        ];
        let parsed: any = {};
        try {
          const res = await invokeLLM({
            messages,
            response_format: {
              type: "json_schema",
              json_schema: { name: "estimate_match", strict: false, schema },
            },
          });
          const content = res.choices?.[0]?.message?.content ?? "{}";
          parsed = typeof content === "string" ? JSON.parse(content) : content;
        } catch (e) {
          console.warn("[estimates.extractAndMatch] LLM抽出失敗", e);
        }
        // マッチ候補を見つける（sharedの純粋関数を使用）
        const allCases = await listCases();
        const reqStr = (parsed.requestNumber ?? "").toString().trim();
        const titleStr = (parsed.caseTitle ?? "").toString().trim();
        const storeStr = (parsed.storeName ?? "").toString().trim();
        const scored = scoreCandidates(
          { requestNumber: reqStr || null, caseTitle: titleStr || null, storeName: storeStr || null },
          allCases.map((c) => ({
            id: c.id,
            requestNumber: c.requestNumber,
            storeName: c.storeName,
            requestContent: c.requestContent,
            categoryLarge: c.categoryLarge,
            categoryMedium: c.categoryMedium,
            categorySmall: c.categorySmall,
          }))
        );
        const matches = topMatches(scored, 5);
        const bestMatch = pickBestMatch(scored);
        return {
          extracted: {
            totalAmount: parsed.totalAmount ?? null,
            materialAmount: parsed.materialAmount ?? null,
            laborAmount: parsed.laborAmount ?? null,
            vendorName: parsed.vendorName ?? null,
            estimateDate: parsed.estimateDate ?? null,
            requestNumber: reqStr || null,
            caseTitle: titleStr || null,
            storeName: storeStr || null,
            note: parsed.note ?? null,
          },
          matches: matches.map((m) => ({
            caseId: m.caseId,
            requestNumber: m.requestNumber ?? "",
            storeName: m.storeName ?? "",
            score: m.score,
          })),
          bestMatchCaseId: bestMatch?.caseId ?? null,
        };
      }),

    // マッチ確定した見積書を一括保存
    bulkSave: protectedProcedure
      .input(
        z.object({
          rows: z.array(
            z.object({
              caseId: z.number(),
              fileKey: z.string().min(1),
              fileUrl: z.string().min(1),
              fileName: z.string().nullish(),
              mimeType: z.string(),
              totalAmount: z.number().nullish(),
              materialAmount: z.number().nullish(),
              laborAmount: z.number().nullish(),
              vendorName: z.string().nullish(),
              estimateDate: z.string().nullish(),
              note: z.string().nullish(),
            })
          ).min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const ids: number[] = [];
        for (const r of input.rows) {
          const id = await createEstimate({
            caseId: r.caseId,
            fileKey: r.fileKey,
            fileUrl: r.fileUrl,
            fileName: r.fileName ?? null,
            mimeType: r.mimeType,
            totalAmount: r.totalAmount ?? undefined,
            materialAmount: r.materialAmount ?? undefined,
            laborAmount: r.laborAmount ?? undefined,
            vendorName: r.vendorName ?? undefined,
            estimateDate: r.estimateDate ? new Date(r.estimateDate) : undefined,
            note: r.note ?? undefined,
            uploadedBy: ctx.user.id,
          });
          ids.push(id);
          // 案件のestimatedCost/材料費/作業費を最新見積で更新
          const ests = await listEstimatesByCase(r.caseId);
          const picked = pickLatestEstimate(ests);
          if (picked) {
            const upd: any = { estimatedCost: picked.totalAmount };
            if (picked.materialAmount != null) upd.estimatedMaterialCost = picked.materialAmount;
            if (picked.laborAmount != null) upd.estimatedLaborCost = picked.laborAmount;
            await updateCase(r.caseId, upd);
          }
        }
        return { count: ids.length, ids };
      }),

    // 協力業者に見せる75%金額トークンを生成
    issuePartnerToken: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .mutation(async ({ input }) => {
        const existing = await getCaseById(input.caseId);
        if (!existing) throw new Error("案件が見つかりません");
        let token = existing.partnerToken;
        if (!token) {
          token = `pv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
          await setCasePartnerToken(input.caseId, token);
        }
        return { token };
      }),
  }),

  // ==========================================================
  // 協力業者向け公開ビュー（見積75%のみ表示）
  // ==========================================================
  partnerView: router({
    getByToken: publicProcedure
      .input(z.object({ token: z.string().min(8) }))
      .query(async ({ input }) => {
        const c = await getCaseByPartnerToken(input.token);
        if (!c) throw new Error("リンクが無効です");
        const ests = await listEstimatesByCase(c.id);
        // 原価は返さず、75%金額のみ返す
        const partnerEstimates = ests
          .filter((e) => e.totalAmount != null)
          .map((e) => ({
            id: e.id,
            fileName: e.fileName,
            vendorName: e.vendorName,
            estimateDate: e.estimateDate,
            partnerAmount: Math.round((e.totalAmount as number) * 0.75),
            createdAt: e.createdAt,
          }));
        const totalPartnerAmount = c.estimatedCost != null ? Math.round(c.estimatedCost * 0.75) : null;
        return {
          requestNumber: c.requestNumber,
          storeName: c.storeName,
          address: c.address,
          storePhone: c.storePhone,
          businessHours: c.businessHours,
          requestContent: c.requestContent,
          categoryLarge: c.categoryLarge,
          categoryMedium: c.categoryMedium,
          categorySmall: c.categorySmall,
          urgency: c.urgency,
          status: c.status,
          progressStage: c.progressStage,
          surveyDate: c.surveyDate,
          constructionDate: c.constructionDate,
          totalPartnerAmount,
          estimates: partnerEstimates,
        };
      }),
  }),

  // ============================================================
  // v12: ルート推進＆スケジュール盤
  // ============================================================
  routes: router({
    suggest: protectedProcedure.query(async () => {
      const list = await listCases();
      const today = new Date();
      const planner: PlannerCase[] = list.map((c) => ({
        id: c.id,
        requestNumber: c.requestNumber,
        storeName: c.storeName,
        address: c.address,
        latitude: c.latitude ? Number(c.latitude) : null,
        longitude: c.longitude ? Number(c.longitude) : null,
        urgency: c.urgency,
        progressStage: c.progressStage,
        status: c.status,
        requestDate: c.requestDate,
        surveyDate: c.surveyDate,
        constructionDate: c.constructionDate,
      }));
      const schedule = buildSchedule(planner, today);
      return schedule;
    }),

    // 住所をジオコードし cases.lat/lng を更新（抽出）
    geocodeMissing: protectedProcedure.mutation(async () => {
      const list = await listCases();
      const targets = list.filter(
        (c) => c.address && (!c.latitude || !c.longitude)
      );
      let updated = 0;
      for (const c of targets) {
        try {
          const r = await makeRequest<{
            status: string;
            results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
          }>("/maps/api/geocode/json", { address: c.address!, language: "ja", region: "jp" });
          if (r.status === "OK" && r.results[0]) {
            const loc = r.results[0].geometry.location;
            await updateCase(c.id, {
              latitude: String(loc.lat),
              longitude: String(loc.lng),
            });
            updated++;
          }
        } catch (err) {
          console.warn("[geocode] failed", c.id, err);
        }
      }
      return { updated, total: targets.length };
    }),

    list: protectedProcedure
      .input(z.object({ start: z.string(), end: z.string() }))
      .query(async ({ input }) => {
        const items = await listRouteAssignmentsByDateRange(input.start, input.end);
        return items;
      }),

    upsert: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          caseId: z.number(),
          team: z.enum(["A", "B"]),
          taskType: z.enum(["survey", "construction"]),
          scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          sequence: z.number().int().min(0).default(0),
          assigneeId: z.number().nullish(),
          notes: z.string().nullish(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.id) {
          await updateRouteAssignment(input.id, {
            team: input.team,
            taskType: input.taskType,
            scheduledDate: input.scheduledDate,
            sequence: input.sequence,
            assigneeId: input.assigneeId ?? null,
            notes: input.notes ?? null,
          });
          return { id: input.id };
        }
        const id = await createRouteAssignment({
          caseId: input.caseId,
          team: input.team,
          taskType: input.taskType,
          scheduledDate: input.scheduledDate,
          sequence: input.sequence,
          assigneeId: input.assigneeId ?? null,
          notes: input.notes ?? null,
          createdBy: ctx.user.id,
        });
        return { id };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteRouteAssignment(input.id);
        return { ok: true };
      }),

    // 提案を一括反映（期間クリアしてインサート）
    applySuggestion: adminProcedure
      .input(
        z.object({
          start: z.string(),
          end: z.string(),
          assignments: z.array(
            z.object({
              caseId: z.number(),
              team: z.enum(["A", "B"]),
              taskType: z.enum(["survey", "construction"]),
              scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              sequence: z.number().int().min(0),
              notes: z.string().nullish(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await clearRouteAssignmentsInRange(input.start, input.end);
        // チーム設定から代表担当者を取得
        const teams = await listTeamSettings();
        const teamUser: Record<"A" | "B", number | null> = {
          A: teams.find((t) => t.team === "A")?.primaryUserId ?? null,
          B: teams.find((t) => t.team === "B")?.primaryUserId ?? null,
        };
        for (const a of input.assignments) {
          await createRouteAssignment({
            caseId: a.caseId,
            team: a.team,
            taskType: a.taskType,
            scheduledDate: a.scheduledDate,
            sequence: a.sequence,
            assigneeId: teamUser[a.team],
            notes: a.notes ?? null,
            createdBy: ctx.user.id,
          });
        }
        return { count: input.assignments.length };
      }),
  }),

  // チーム設定（v13）
  teamSettings: router({
    list: protectedProcedure.query(async () => {
      const items = await listTeamSettings();
      const allMembers = await listTeamMembers();
      const memberIds = (team: "A" | "B") =>
        allMembers.filter((m) => m.team === team).map((m) => m.userId);
      // 未設定チームもデフォルトで返す
      const teamA = items.find((t) => t.team === "A");
      const teamB = items.find((t) => t.team === "B");
      return {
        A: {
          ...(teamA ?? { team: "A" as const, primaryUserId: null, label: null, color: null }),
          memberIds: memberIds("A"),
        },
        B: {
          ...(teamB ?? { team: "B" as const, primaryUserId: null, label: null, color: null }),
          memberIds: memberIds("B"),
        },
      };
    }),
    setMembers: adminProcedure
      .input(
        z.object({
          team: z.enum(["A", "B"]),
          userIds: z.array(z.number()).max(50),
        })
      )
      .mutation(async ({ input }) => {
        const count = await setTeamMembers(input.team, input.userIds);
        return { count };
      }),
    upsert: adminProcedure
      .input(
        z.object({
          team: z.enum(["A", "B"]),
          primaryUserId: z.number().nullish(),
          label: z.string().max(64).nullish(),
          color: z.string().max(16).nullish(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await upsertTeamSetting({
          team: input.team,
          primaryUserId: input.primaryUserId ?? null,
          label: input.label ?? null,
          color: input.color ?? null,
        });
        return { id };
      }),
  }),

  // ============================================================
  // v11: 店舗一覧集計ルーター
  // ============================================================
  stores: router({
    list: protectedProcedure.query(async () => {
      const allCases = await listCases();

      function storeKey(c: { storeCode: string | null; storeName: string }) {
        return (c.storeCode && c.storeCode.trim()) || c.storeName.trim();
      }

      type StoreRow = {
        key: string;
        storeCode: string | null;
        storeName: string;
        brand: string | null;
        address: string | null;
        caseCount: number;
        openCount: number;
        completedCount: number;
        urgentCount: number;
        totalEstimated: number;
        totalActual: number;
        latestRequestAt: Date | null;
        latestStatus: string | null;
        latestStage: string | null;
      };

      const map = new Map<string, StoreRow>();
      for (const c of allCases) {
        const k = storeKey(c);
        let row = map.get(k);
        if (!row) {
          row = {
            key: k,
            storeCode: c.storeCode,
            storeName: c.storeName,
            brand: c.brand,
            address: c.address,
            caseCount: 0,
            openCount: 0,
            completedCount: 0,
            urgentCount: 0,
            totalEstimated: 0,
            totalActual: 0,
            latestRequestAt: null,
            latestStatus: null,
            latestStage: null,
          };
          map.set(k, row);
        }
        row.caseCount++;
        if (c.status === "完了" || c.status === "クローズ") row.completedCount++;
        else row.openCount++;
        if (c.urgency === "S" || c.urgency === "A") row.urgentCount++;
        if (c.estimatedCost != null) row.totalEstimated += c.estimatedCost;
        if (c.actualCost != null) row.totalActual += c.actualCost;
        const reqAt = c.requestDate ?? c.createdAt;
        if (reqAt && (!row.latestRequestAt || reqAt > row.latestRequestAt)) {
          row.latestRequestAt = reqAt;
          row.latestStatus = c.status;
          row.latestStage = c.progressStage;
        }
        // 在中でも代表住所/ブランドが未設定なら補完
        if (!row.address && c.address) row.address = c.address;
        if (!row.brand && c.brand) row.brand = c.brand;
      }

      return Array.from(map.values()).sort((a, b) => {
        const at = a.latestRequestAt ? +a.latestRequestAt : 0;
        const bt = b.latestRequestAt ? +b.latestRequestAt : 0;
        return bt - at;
      });
    }),
  }),

  // ============================================================
  // v16: 担当者別ワークロード集計
  // ============================================================
  workload: router({
    list: protectedProcedure
      .input(
        z.object({
          start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      )
      .query(async ({ input }) => {
        const assignments = await listRouteAssignmentsByDateRange(
          input.start,
          input.end,
        );
        const allCases = await listCases();
        const allUsers = await getAllUsers();

        function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
          const R = 6371;
          const toRad = (v: number) => (v * Math.PI) / 180;
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
          return 2 * R * Math.asin(Math.sqrt(a));
        }

        const caseLatLng = new Map<
          number,
          { lat: number | null; lng: number | null }
        >();
        for (const c of allCases) {
          caseLatLng.set(c.id, {
            lat: c.latitude ? Number(c.latitude) : null,
            lng: c.longitude ? Number(c.longitude) : null,
          });
        }

        type Row = {
          userId: number | null;
          userName: string;
          totalTasks: number;
          surveyTasks: number;
          constructionTasks: number;
          activeDays: number;
          totalKm: number;
          teamA: number;
          teamB: number;
        };

        const userById = new Map<number, { id: number; name: string }>();
        for (const u of allUsers) {
          userById.set(u.id, { id: u.id, name: u.name ?? `ユーザー#${u.id}` });
        }

        // (userId, dayKey, team) ごとにタスクを収集
        type Bucket = {
          userId: number | null;
          team: "A" | "B";
          date: string;
          items: typeof assignments;
        };
        const bucketMap = new Map<string, Bucket>();
        for (const a of assignments) {
          const key = `${a.assigneeId ?? "none"}|${a.scheduledDate}|${a.team}`;
          let b = bucketMap.get(key);
          if (!b) {
            b = {
              userId: a.assigneeId,
              team: a.team as "A" | "B",
              date: a.scheduledDate,
              items: [],
            };
            bucketMap.set(key, b);
          }
          b.items.push(a);
        }

        const rows = new Map<number | string, Row>();
        function getRow(userId: number | null): Row {
          const k = userId ?? "_unassigned";
          let r = rows.get(k);
          if (!r) {
            r = {
              userId,
              userName:
                userId == null
                  ? "未割当"
                  : userById.get(userId)?.name ?? `ユーザー#${userId}`,
              totalTasks: 0,
              surveyTasks: 0,
              constructionTasks: 0,
              activeDays: 0,
              totalKm: 0,
              teamA: 0,
              teamB: 0,
            };
            rows.set(k, r);
          }
          return r;
        }

        const userActiveDays = new Map<number | string, Set<string>>();

        bucketMap.forEach((b) => {
          const r = getRow(b.userId);
          // タスク件数
          for (const it of b.items) {
            r.totalTasks++;
            if (it.taskType === "survey") r.surveyTasks++;
            else r.constructionTasks++;
            if (b.team === "A") r.teamA++;
            else r.teamB++;
          }
          // 稼働日カウント
          const k = b.userId ?? "_unassigned";
          if (!userActiveDays.has(k)) userActiveDays.set(k, new Set());
          userActiveDays.get(k)!.add(b.date);
          // 距離
          const sorted = [...b.items].sort((a, b2) => a.sequence - b2.sequence);
          const pts: Array<{ lat: number; lng: number }> = [];
          for (const it of sorted) {
            const c = caseLatLng.get(it.caseId);
            if (c?.lat != null && c?.lng != null) pts.push({ lat: c.lat, lng: c.lng });
          }
          for (let i = 1; i < pts.length; i++) {
            r.totalKm += haversineKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
          }
        });

        userActiveDays.forEach((set, k) => {
          const r = rows.get(k);
          if (r) r.activeDays = set.size;
        });

        const result = Array.from(rows.values()).sort(
          (a, b) => b.totalTasks - a.totalTasks,
        );

        // 偏り判定：複数1名以上で最大-最小 ≥ 3件 または 距離差≥ 30km
        const assigned = result.filter((r) => r.userId != null);
        let imbalanced = false;
        if (assigned.length >= 2) {
          const counts = assigned.map((r) => r.totalTasks);
          const kms = assigned.map((r) => r.totalKm);
          const taskGap = Math.max(...counts) - Math.min(...counts);
          const kmGap = Math.max(...kms) - Math.min(...kms);
          imbalanced = taskGap >= 3 || kmGap >= 30;
        }

        return {
          rows: result,
          imbalanced,
          totalAssigned: assigned.reduce((s, r) => s + r.totalTasks, 0),
          unassignedCount:
            result.find((r) => r.userId == null)?.totalTasks ?? 0,
        };
      }),
  }),
  expenses: router({
    list: protectedProcedure.query(async () => {
      const rows = await listAllExpenses();
      return rows;
    }),
    listByCase: protectedProcedure
      .input(z.object({ caseId: z.number().int() }))
      .query(async ({ input }) => {
        return await listExpensesByCase(input.caseId);
      }),
    listUnmatched: protectedProcedure.query(async () => {
      return await listUnmatchedExpenses();
    }),
    uploadFile: protectedProcedure
      .input(
        z.object({
          fileName: z.string().min(1),
          fileBase64: z.string().min(1),
          mimeType: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const base64 = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const safe = input.fileName.replace(/[^\w\d._-]/g, "_");
        const key = `expenses/u-${ctx.user.id}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}_${safe}`;
        const { url, key: fileKey } = await storagePut(key, buffer, input.mimeType);
        return { fileKey, url, mimeType: input.mimeType };
      }),
    extractAndMatch: protectedProcedure
      .input(
        z.object({
          fileKey: z.string(),
          fileUrl: z.string(),
          fileName: z.string().optional(),
          mimeType: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const key = input.fileKey.replace(/^\/manus-storage\//, "");
        const signedUrl = await storageGetSignedUrl(key);
        const isImage = (input.mimeType || "").startsWith("image/");
        const userContent: any[] = [
          {
            type: "text",
            text: `この経費書類（領収書/請求書）から以下を抽出しJSONで返してください: vendorName(支払先), amount(税込合計、整数円), taxAmount(消費税、不明ならnull), expenseDate(YYYY-MM-DD、不明ならnull), category(材料費|外注費|交通費|消耗品|車両費|宿泊費|接待交際費|その他のいずれか), requestNumber(関連する依頼番号、例284909-1。なければnull), storeName(関連店舗名、なければnull), caseHint(案件名や工事内容のヒント、なければnull), note(短い摘要)。`,
          },
        ];
        if (isImage) {
          userContent.push({
            type: "image_url",
            image_url: { url: signedUrl, detail: "high" },
          });
        } else {
          userContent.push({
            type: "file_url",
            file_url: { url: signedUrl, mime_type: "application/pdf" },
          });
        }

        const llm = await invokeLLM({
          messages: [
            { role: "system", content: "あなたは経費書類読取アシスタント。JSONのみを返します。" },
            { role: "user", content: userContent as any },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "expense_extract",
              schema: {
                type: "object",
                properties: {
                  vendorName: { type: ["string", "null"] },
                  amount: { type: ["number", "null"] },
                  taxAmount: { type: ["number", "null"] },
                  expenseDate: { type: ["string", "null"] },
                  category: { type: "string" },
                  requestNumber: { type: ["string", "null"] },
                  storeName: { type: ["string", "null"] },
                  caseHint: { type: ["string", "null"] },
                  note: { type: ["string", "null"] },
                },
              },
            },
          },
        });
        const raw = (llm as any).choices?.[0]?.message?.content ?? "{}";
        let parsed: any = {};
        try {
          parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
          parsed = {};
        }

        // 案件マッチング
        const allCases = await listCases();
        const candidates = allCases.map((c) => ({
          id: c.id,
          requestNumber: c.requestNumber,
          storeName: c.storeName,
          requestContent: c.requestContent ?? "",
        }));
        const scored = scoreCandidates(
          {
            requestNumber: parsed.requestNumber ?? null,
            storeName: parsed.storeName ?? null,
            caseTitle: parsed.caseHint ?? null,
          },
          candidates,
        );
        const top = topMatches(scored, 5).map((m) => ({
          caseId: m.caseId,
          requestNumber: m.requestNumber,
          storeName: m.storeName,
          score: m.score,
        }));
        const best = pickBestMatch(scored);

        return {
          extracted: {
            vendorName: parsed.vendorName ?? null,
            amount: parsed.amount ?? null,
            taxAmount: parsed.taxAmount ?? null,
            expenseDate: parsed.expenseDate ?? null,
            category: EXPENSE_CATEGORY.options.includes(parsed.category)
              ? parsed.category
              : "その他",
            note: parsed.note ?? null,
            requestNumber: parsed.requestNumber ?? null,
            storeName: parsed.storeName ?? null,
            caseHint: parsed.caseHint ?? null,
          },
          matches: top,
          autoMatchCaseId: best?.caseId ?? null,
          autoMatchScore: best?.score ?? 0,
        };
      }),
    bulkSave: protectedProcedure
      .input(
        z.object({
          items: z.array(
            z.object({
              caseId: z.number().int(),
              fileKey: z.string().nullish(),
              fileUrl: z.string().nullish(),
              fileName: z.string().nullish(),
              mimeType: z.string().nullish(),
              vendorName: z.string().nullish(),
              amount: z.number().int(),
              taxAmount: z.number().int().nullish(),
              expenseDate: z.string().nullish(), // YYYY-MM-DD
              category: EXPENSE_CATEGORY.default("その他"),
              note: z.string().nullish(),
            }),
          ),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const ids: number[] = [];
        const touchedCases = new Set<number>();
        for (const item of input.items) {
          const id = await createExpense({
            caseId: item.caseId,
            scope: "案件",
            fileKey: item.fileKey ?? null,
            fileUrl: item.fileUrl ?? null,
            fileName: item.fileName ?? null,
            mimeType: item.mimeType ?? null,
            vendorName: item.vendorName ?? null,
            amount: item.amount,
            taxAmount: item.taxAmount ?? null,
            expenseDate: item.expenseDate ? new Date(item.expenseDate) : null,
            category: item.category,
            note: item.note ?? null,
            uploadedBy: ctx.user.id,
          });
          ids.push(id);
          touchedCases.add(item.caseId);
        }
        for (const cid of Array.from(touchedCases)) {
          await syncCaseActualCost(cid);
        }
        return { count: ids.length, ids };
      }),
    // 全体（案件に紐づかない共通）経費を保存。案件選択不要。
    saveGeneral: protectedProcedure
      .input(
        z.object({
          items: z.array(
            z.object({
              fileKey: z.string().nullish(),
              fileUrl: z.string().nullish(),
              fileName: z.string().nullish(),
              mimeType: z.string().nullish(),
              vendorName: z.string().nullish(),
              amount: z.number().int(),
              taxAmount: z.number().int().nullish(),
              expenseDate: z.string().nullish(),
              category: EXPENSE_CATEGORY.default("その他"),
              note: z.string().nullish(),
            }),
          ),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const ids: number[] = [];
        for (const item of input.items) {
          const id = await createExpense({
            caseId: null,
            scope: "全体",
            fileKey: item.fileKey ?? null,
            fileUrl: item.fileUrl ?? null,
            fileName: item.fileName ?? null,
            mimeType: item.mimeType ?? null,
            vendorName: item.vendorName ?? null,
            amount: item.amount,
            taxAmount: item.taxAmount ?? null,
            expenseDate: item.expenseDate ? new Date(item.expenseDate) : null,
            category: item.category,
            note: item.note ?? null,
            uploadedBy: ctx.user.id,
          });
          ids.push(id);
        }
        return { count: ids.length, ids };
      }),
    // 立替者(uploadedBy)別の集計。期間、区分内訳、案件/全体内訳を返す。管理者のみ。
    byUser: adminProcedure
      .input(
        z
          .object({ fromMs: z.number().int().nullish(), toMs: z.number().int().nullish() })
          .optional(),
      )
      .query(async ({ input }) => {
        const rows = await listExpensesForAggregation(
          input?.fromMs ?? undefined,
          input?.toMs ?? undefined,
        );
        const users = await getAllUsers();
        const userName = new Map<number, string>();
        for (const u of users) userName.set(u.id, u.name ?? `ID:${u.id}`);
        return aggregateExpensesByUser(rows, userName);
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          patch: z.object({
            caseId: z.number().int().nullish(),
            vendorName: z.string().nullish(),
            amount: z.number().int().optional(),
            taxAmount: z.number().int().nullish(),
            expenseDate: z.string().nullish(),
            category: EXPENSE_CATEGORY.optional(),
            note: z.string().nullish(),
          }),
        }),
      )
      .mutation(async ({ input }) => {
        const before = await getExpenseById(input.id);
        const patch: any = { ...input.patch };
        if (patch.expenseDate !== undefined) {
          patch.expenseDate = patch.expenseDate ? new Date(patch.expenseDate) : null;
        }
        await updateExpense(input.id, patch);
        const after = await getExpenseById(input.id);
        const cids = new Set<number>();
        if (before?.caseId) cids.add(before.caseId);
        if (after?.caseId) cids.add(after.caseId);
        for (const cid of Array.from(cids)) await syncCaseActualCost(cid);
        return { ok: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const before = await getExpenseById(input.id);
        await deleteExpense(input.id);
        if (before?.caseId) await syncCaseActualCost(before.caseId);
        return { ok: true };
      }),
  }),
  reports: router({
    monthly: protectedProcedure
      .input(
        z
          .object({
            months: z.number().int().min(1).max(24).default(6),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const months = input?.months ?? 6;
        const allCases = await listCases();
        const allExpenses = await listAllExpenses();

        // 直近 months ヶ月の月キーを生成（YYYY-MM）
        const now = new Date();
        const buckets: { key: string; year: number; month: number }[] = [];
        for (let i = months - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          buckets.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            year: d.getFullYear(),
            month: d.getMonth() + 1,
          });
        }
        const byKey = new Map(
          buckets.map((b) => [
            b.key,
            {
              key: b.key,
              year: b.year,
              month: b.month,
              revenue: 0,
              cost: 0,
              caseCount: 0,
              completedCount: 0,
            } as { key: string; year: number; month: number; revenue: number; cost: number; caseCount: number; completedCount: number },
          ]),
        );

        function bucketKey(d: Date | null | undefined) {
          if (!d) return null;
          const x = new Date(d as any);
          return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
        }

        // 案件ごとの経費合計を集計（原価に加算）
        const expByCaseMonthly = new Map<number, number>();
        for (const e of allExpenses) {
          if (!e.caseId) continue;
          expByCaseMonthly.set(e.caseId, (expByCaseMonthly.get(e.caseId) ?? 0) + (e.amount ?? 0));
        }
        // 案件は requestDate を基準に件数・売上・原価を計上
        // 売上 = プレナス提出見積額（未入力は協力業者額÷0.75）
        // 原価 = 協力業者見積額 + その案件の経費合計
        for (const c of allCases) {
          const k = bucketKey(c.requestDate as any) ?? bucketKey(c.createdAt as any);
          if (!k || !byKey.has(k)) continue;
          const b = byKey.get(k)!;
          b.caseCount += 1;
          if (c.completedAt || c.status === "完了") b.completedCount += 1;
          const p = calcCaseProfit({
            plenusQuoteAmount: c.plenusQuoteAmount,
            estimatedCost: c.estimatedCost,
            expensesTotal: expByCaseMonthly.get(c.id) ?? 0,
          });
          b.revenue += p.sales;
          b.cost += p.cost;
        }
        const rows = buckets.map((b) => {
          const r = byKey.get(b.key)!;
          const profit = r.revenue - r.cost;
          const margin = r.revenue > 0 ? Math.round((profit / r.revenue) * 1000) / 10 : 0;
          return { ...r, profit, margin };
        });
        const totals = rows.reduce(
          (s, r) => ({
            revenue: s.revenue + r.revenue,
            cost: s.cost + r.cost,
            profit: s.profit + r.profit,
            caseCount: s.caseCount + r.caseCount,
            completedCount: s.completedCount + r.completedCount,
          }),
          { revenue: 0, cost: 0, profit: 0, caseCount: 0, completedCount: 0 },
        );
        return { rows, totals };
      }),
    byAssignee: protectedProcedure.query(async () => {
      const allCases = await listCases();
      const allExpenses = await listAllExpenses();
      const users = await getAllUsers();
      const byUser = new Map<number, { userId: number; name: string; email: string; caseCount: number; completedCount: number; revenue: number; cost: number }>();
      for (const u of users) {
        byUser.set(u.id, {
          userId: u.id,
          name: u.name ?? `User ${u.id}`,
          email: u.email ?? "",
          caseCount: 0,
          completedCount: 0,
          revenue: 0,
          cost: 0,
        });
      }
      const expByCase = new Map<number, number>();
      for (const e of allExpenses) {
        if (!e.caseId) continue;
        expByCase.set(e.caseId, (expByCase.get(e.caseId) ?? 0) + (e.amount ?? 0));
      }
      for (const c of allCases) {
        if (!c.assigneeId || !byUser.has(c.assigneeId)) continue;
        const r = byUser.get(c.assigneeId)!;
        r.caseCount += 1;
        if (c.completedAt || c.status === "完了") r.completedCount += 1;
        // 売上 = プレナス提出額（未入力は協力業者額÷0.75）、原価 = 協力業者額 + 経費
        const p = calcCaseProfit({
          plenusQuoteAmount: c.plenusQuoteAmount,
          estimatedCost: c.estimatedCost,
          expensesTotal: expByCase.get(c.id) ?? 0,
        });
        r.revenue += p.sales;
        r.cost += p.cost;
      }
      const rows = Array.from(byUser.values())
        .filter((r) => r.caseCount > 0)
        .map((r) => {
          const profit = r.revenue - r.cost;
          const margin = r.revenue > 0 ? Math.round((profit / r.revenue) * 1000) / 10 : 0;
          return { ...r, profit, margin };
        })
        .sort((a, b) => b.profit - a.profit);
            return { rows };
    }),
  }),

  // 全角化の除外辞書（型番・メール・固有名詞などをPDFで半角のまま残す）
  fullwidthExclusions: router({
    list: protectedProcedure.query(() => listFullwidthExclusions()),
    add: protectedProcedure
      .input(
        z.object({
          term: z.string().trim().min(1, "語を入力してください").max(255),
          note: z.string().max(255).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const id = await addFullwidthExclusion({
          term: input.term,
          note: input.note ?? null,
          createdBy: ctx.user.id,
        });
        return { id };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFullwidthExclusion(input.id);
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
