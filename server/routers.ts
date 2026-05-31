import { COOKIE_NAME } from "@shared/const";
import { DEFAULT_CHECKLIST } from "../shared/checklist-template";
import { z } from "zod";
import {
  createCase,
  createChecklistItems,
  createPartner,
  createPhoto,
  deleteCase,
  deletePartner,
  deletePhoto,
  getAllUsers,
  getCaseById,
  getCaseByRequestNumber,
  getChecklistByCaseId,
  getPartnerById,
  getPhotoById,
  getPhotosByCaseId,
  listCases,
  listCasesByPartner,
  listPartners,
  updateCase,
  updateChecklistItem,
  updatePartner,
  updatePhoto,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { storagePut, storageGetSignedUrl } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { BUDGET_RATIO, calcBudget } from "../shared/budget";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";

// ============================================================
// Zod schemas
// ============================================================
const caseInputSchema = z.object({
  requestNumber: z.string().min(1),
  brand: z.enum(["ほっともっと", "やよい軒", "その他"]).default("ほっともっと"),
  storeName: z.string().min(1),
  storeCode: z.string().nullish(),
  shopId: z.string().nullish(),
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
  urgency: z.enum(["S", "A", "B", "C"]).default("B"),
  assigneeId: z.number().int().nullish(),
  estimatedCost: z.number().int().nullish(),
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
      const id = await createCase({ ...input, createdBy: ctx.user.id });
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
        await updateCase(input.id, input.data);
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
                    "以下の「依頼進捗更新」PDFから店舗情報・依頼内容・修理区分・取引先を抽出してJSONで返してください。",
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
        const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((c: any) => c.text ?? "").join("") : "";
        let parsed: Record<string, any> = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("PDFからの抽出結果をパースできませんでした");
        }

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
          },
          rawText: text,
        };
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
            const id = await createCase({ ...row, createdBy: ctx.user.id });
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
                  await updateCase(items.caseId, { status: next as any });
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
});

export type AppRouter = typeof appRouter;
