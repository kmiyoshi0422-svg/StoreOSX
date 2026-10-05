import { TRPCError } from "@trpc/server";
import { and, eq, asc } from "drizzle-orm";
import { z } from "zod";
import {
  estimatePresetCategories,
  estimatePresetItems,
} from "../drizzle/schema";
import { canUseEstimateAssistant } from "../shared/estimateAssistant";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

const staff = protectedProcedure.use(({ ctx, next }) => {
  if (!canUseEstimateAssistant(ctx.user.role))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "定型見積メニューは社員以上のみ利用できます",
    });
  return next({ ctx });
});
const categoryInput = z.object({
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(9999),
});
const itemInput = z.object({
  categoryId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(255),
  specification: z.string().trim().max(255),
  unit: z.string().trim().min(1).max(30),
  unitPrice: z.number().int().min(0).max(100_000_000).nullable(),
  note: z.string().max(1200),
  sortOrder: z.number().int().min(0).max(9999),
});

export const estimatePresetsRouter = router({
  list: staff.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const categories = await db
      .select()
      .from(estimatePresetCategories)
      .where(eq(estimatePresetCategories.isActive, true))
      .orderBy(
        asc(estimatePresetCategories.sortOrder),
        asc(estimatePresetCategories.name)
      );
    const items = await db
      .select()
      .from(estimatePresetItems)
      .where(eq(estimatePresetItems.isActive, true))
      .orderBy(
        asc(estimatePresetItems.sortOrder),
        asc(estimatePresetItems.name)
      );
    return categories.map(category => ({
      ...category,
      items: items.filter(item => item.categoryId === category.id),
    }));
  }),
  saveCategory: staff
    .input(
      z.object({
        id: z.string().min(1).max(64).optional(),
        expectedUpdatedAt: z.number().int().optional(),
        value: categoryInput,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.transaction(async tx => {
        if (!input.id) {
          const id = `category:${crypto.randomUUID()}`;
          const at = Date.now();
          await tx
            .insert(estimatePresetCategories)
            .values({
              id,
              ...input.value,
              isActive: true,
              createdBy: ctx.user.id,
              updatedBy: ctx.user.id,
              createdAt: at,
              updatedAt: at,
            });
          return { id, updatedAt: at };
        }
        const [row] = await tx
          .select()
          .from(estimatePresetCategories)
          .where(eq(estimatePresetCategories.id, input.id))
          .limit(1);
        if (!row || !row.isActive) throw new TRPCError({ code: "NOT_FOUND" });
        if (row.updatedAt !== input.expectedUpdatedAt)
          throw new TRPCError({
            code: "CONFLICT",
            message: "分類が変更されています。再読み込みしてください",
          });
        const at = Math.max(Date.now(), row.updatedAt + 1);
        const result = await tx
          .update(estimatePresetCategories)
          .set({ ...input.value, updatedAt: at, updatedBy: ctx.user.id })
          .where(
            and(
              eq(estimatePresetCategories.id, input.id),
              eq(estimatePresetCategories.isActive, true),
              eq(estimatePresetCategories.updatedAt, row.updatedAt)
            )
          );
        if (Number(result[0]?.affectedRows ?? 0) !== 1)
          throw new TRPCError({ code: "CONFLICT" });
        return { id: input.id, updatedAt: at };
      });
    }),
  hideCategory: staff
    .input(
      z.object({
        id: z.string().min(1).max(64),
        expectedUpdatedAt: z.number().int(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const at = Math.max(Date.now(), input.expectedUpdatedAt + 1);
      const result = await db
        .update(estimatePresetCategories)
        .set({ isActive: false, updatedBy: ctx.user.id, updatedAt: at })
        .where(
          and(
            eq(estimatePresetCategories.id, input.id),
            eq(estimatePresetCategories.isActive, true),
            eq(estimatePresetCategories.updatedAt, input.expectedUpdatedAt)
          )
        );
      if (Number(result[0]?.affectedRows ?? 0) !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "分類が変更済みです。再読み込みしてください",
        });
      return { id: input.id };
    }),
  saveItem: staff
    .input(
      z.object({
        id: z.string().min(1).max(64).optional(),
        expectedUpdatedAt: z.number().int().optional(),
        value: itemInput,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.transaction(async tx => {
        const [category] = await tx
          .select({ id: estimatePresetCategories.id })
          .from(estimatePresetCategories)
          .where(
            and(
              eq(estimatePresetCategories.id, input.value.categoryId),
              eq(estimatePresetCategories.isActive, true)
            )
          )
          .limit(1);
        if (!category)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "有効な分類を選択してください",
          });
        if (!input.id) {
          const id = `item:${crypto.randomUUID()}`;
          const at = Date.now();
          await tx
            .insert(estimatePresetItems)
            .values({
              id,
              ...input.value,
              isActive: true,
              createdBy: ctx.user.id,
              updatedBy: ctx.user.id,
              createdAt: at,
              updatedAt: at,
            });
          return { id, updatedAt: at };
        }
        const [row] = await tx
          .select()
          .from(estimatePresetItems)
          .where(eq(estimatePresetItems.id, input.id))
          .limit(1);
        if (!row || !row.isActive) throw new TRPCError({ code: "NOT_FOUND" });
        if (row.updatedAt !== input.expectedUpdatedAt)
          throw new TRPCError({
            code: "CONFLICT",
            message: "項目が変更されています。再読み込みしてください",
          });
        const at = Math.max(Date.now(), row.updatedAt + 1);
        const result = await tx
          .update(estimatePresetItems)
          .set({ ...input.value, updatedAt: at, updatedBy: ctx.user.id })
          .where(
            and(
              eq(estimatePresetItems.id, input.id),
              eq(estimatePresetItems.isActive, true),
              eq(estimatePresetItems.updatedAt, row.updatedAt)
            )
          );
        if (Number(result[0]?.affectedRows ?? 0) !== 1)
          throw new TRPCError({ code: "CONFLICT" });
        return { id: input.id, updatedAt: at };
      });
    }),
  hideItem: staff
    .input(
      z.object({
        id: z.string().min(1).max(64),
        expectedUpdatedAt: z.number().int(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const at = Math.max(Date.now(), input.expectedUpdatedAt + 1);
      const result = await db
        .update(estimatePresetItems)
        .set({ isActive: false, updatedBy: ctx.user.id, updatedAt: at })
        .where(
          and(
            eq(estimatePresetItems.id, input.id),
            eq(estimatePresetItems.isActive, true),
            eq(estimatePresetItems.updatedAt, input.expectedUpdatedAt)
          )
        );
      if (Number(result[0]?.affectedRows ?? 0) !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "項目が変更済みです。再読み込みしてください",
        });
      return { id: input.id };
    }),
});
