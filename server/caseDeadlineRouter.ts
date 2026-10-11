import { eq, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { cases, partners, caseDeadlineLogs } from '../drizzle/schema';
import { getDb, getCaseById } from './db';
import { protectedProcedure, router } from './_core/trpc';
import { canManageCases, canAccessPrefecture } from '../shared/accessPolicy';
import { parseSurveyCalendarDay } from '../shared/emergencySurveyDate';

export const caseDeadlineRouter = router({
  get: protectedProcedure.input(z.object({ caseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const row = await getCaseById(input.caseId);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    if (canManageCases(ctx.user.role)) {
      if (!canAccessPrefecture(ctx.user, row.prefecture)) throw new TRPCError({ code: 'FORBIDDEN' });
    } else if (ctx.user.role === 'partner') {
      const db = await getDb(); if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [company] = row.partnerId ? await db.select({ userId: partners.userId }).from(partners).where(eq(partners.id, row.partnerId)).limit(1) : [];
      if (!company || company.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: '自社担当の完了期限のみ閲覧できます' });
    } else throw new TRPCError({ code: 'FORBIDDEN' });
    return { caseId: row.id, deadline: row.completionDeadline, status: row.status };
  }),
  set: protectedProcedure.input(z.object({
    caseId: z.number().int().positive(), deadline: z.string().nullable(), expectedDeadline: z.string().nullable(),
    reason: z.string().trim().min(3, '変更理由を3文字以上入力してください').max(500),
  })).mutation(async ({ ctx, input }) => {
    if (!canManageCases(ctx.user.role)) throw new TRPCError({ code: 'FORBIDDEN', message: '完了期限の設定は社員以上のみです' });
    if (input.deadline !== null && !parseSurveyCalendarDay(input.deadline)) throw new TRPCError({ code: 'BAD_REQUEST', message: '有効な完了期限の日付を入力してください' });
    const db = await getDb(); if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return db.transaction(async tx => {
      const [row] = await tx.select().from(cases).where(eq(cases.id, input.caseId)).for('update');
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!canAccessPrefecture(ctx.user, row.prefecture)) throw new TRPCError({ code: 'FORBIDDEN', message: '許可エリア外の期限を変更できません' });
      if (row.completionDeadline !== input.expectedDeadline) throw new TRPCError({ code: 'CONFLICT', message: '他の利用者が期限を変更しました。最新内容を再取得して確認してください' });
      if (row.completionDeadline === input.deadline) return { success: true, changed: false };
      await tx.update(cases).set({ completionDeadline: input.deadline }).where(eq(cases.id, row.id));
      await tx.insert(caseDeadlineLogs).values({ caseId: row.id, beforeDeadline: row.completionDeadline, afterDeadline: input.deadline, reason: input.reason, changedBy: ctx.user.id, changedByName: ctx.user.name ?? `User #${ctx.user.id}` });
      return { success: true, changed: true };
    });
  }),
  history: protectedProcedure.input(z.object({ caseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    if (!canManageCases(ctx.user.role)) throw new TRPCError({ code: 'FORBIDDEN' });
    const row = await getCaseById(input.caseId); if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    if (!canAccessPrefecture(ctx.user, row.prefecture)) throw new TRPCError({ code: 'FORBIDDEN' });
    const db = await getDb(); if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return db.select().from(caseDeadlineLogs).where(eq(caseDeadlineLogs.caseId, row.id)).orderBy(desc(caseDeadlineLogs.id));
  }),
});
