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
  getChecklistByCaseId,
  getPartnerById,
  getPhotoById,
  getPhotosByCaseId,
  listCases,
  listPartners,
  updateCase,
  updateChecklistItem,
  updatePartner,
  updatePhoto,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

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

    // 予実サマリー
    summary: protectedProcedure.query(async () => {
      const cases = await listCases();
      const total = cases.length;
      const totalEstimated = cases.reduce((s, c) => s + (c.estimatedCost ?? 0), 0);
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
        totalActual,
        diff: totalActual - totalEstimated,
        byStatus,
      };
    }),

    // 月次レポート（月別・店舗別集計）
    monthlyReport: protectedProcedure.query(async () => {
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
      const monthlyArr = Object.values(monthly).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
      const storeArr = Object.values(byStore).sort((a, b) => b.actual - a.actual);
      return { monthly: monthlyArr, byStore: storeArr };
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
