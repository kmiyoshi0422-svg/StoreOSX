import { COOKIE_NAME } from "@shared/const";
import { DEFAULT_CHECKLIST } from "../shared/checklist-template";
import { z } from "zod";
import {
  createCase,
  createChecklistItems,
  createPhoto,
  deleteCase,
  deletePhoto,
  getAllUsers,
  getCaseById,
  getChecklistByCaseId,
  getPhotoById,
  getPhotosByCaseId,
  listCases,
  updateCase,
  updateChecklistItem,
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
  status: z
    .enum(["受付", "現調中", "見積中", "施工待ち", "施工中", "完了", "クローズ"])
    .default("受付"),
  urgency: z.enum(["S", "A", "B", "C"]).default("B"),
  assigneeId: z.number().int().nullish(),
  estimatedCost: z.number().int().nullish(),
  is10mYen: z.boolean().default(false),
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
        return { success: true };
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
