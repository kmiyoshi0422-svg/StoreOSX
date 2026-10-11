import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { cases, caseInternalMemos } from '../drizzle/schema';
import { getDb, getCaseById } from './db';
import { protectedProcedure, router } from './_core/trpc';
import { canManageCases, canAccessPrefecture, canViewInternalFinancials, redactTextWithAmounts } from '../shared/accessPolicy';

function assertRole(role: string) {
  if (!canManageCases(role)) throw new TRPCError({ code: 'FORBIDDEN', message: 'メモは社内ユーザー専用です' });
}
function isMasked(body: string, role: string) {
  return !canViewInternalFinancials(role) && redactTextWithAmounts(body) !== body;
}
export const caseInternalMemoRouter = router({
  get: protectedProcedure.input(z.object({ caseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    assertRole(ctx.user.role);
    const parent = await getCaseById(input.caseId);
    if (!parent) throw new TRPCError({ code: 'NOT_FOUND' });
    if (!canAccessPrefecture(ctx.user, parent.prefecture)) throw new TRPCError({ code: 'FORBIDDEN' });
    const db = await getDb(); if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    const [row] = await db.select().from(caseInternalMemos).where(eq(caseInternalMemos.caseId, parent.id));
    const masked = isMasked(row?.body ?? '', ctx.user.role);
    return { body: masked ? '金額に関する記述を含むため非表示' : row?.body ?? '', version: row?.version ?? 0,
      updatedByName: row?.updatedByName ?? null, updatedAt: row?.updatedAt ?? null, canEdit: !masked, masked };
  }),
  save: protectedProcedure.input(z.object({ caseId: z.number().int().positive(), body: z.string().max(10000, 'メモは10,000文字以内で入力してください'), expectedVersion: z.number().int().min(0) })).mutation(async ({ ctx, input }) => {
    assertRole(ctx.user.role);
    const db = await getDb(); if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return db.transaction(async tx => {
      // 親案件ロックで初回の同時INSERTも直列化。案件本体は更新しない。
      const [parent] = await tx.select().from(cases).where(eq(cases.id, input.caseId)).for('update');
      if (!parent) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!canAccessPrefecture(ctx.user, parent.prefecture)) throw new TRPCError({ code: 'FORBIDDEN' });
      const [row] = await tx.select().from(caseInternalMemos).where(eq(caseInternalMemos.caseId, parent.id));
      if (isMasked(row?.body ?? '', ctx.user.role) || isMasked(input.body, ctx.user.role)) throw new TRPCError({ code: 'FORBIDDEN', message: '金額を含むメモは金額閲覧権限のある利用者のみ編集できます' });
      const version = row?.version ?? 0;
      if (version !== input.expectedVersion) throw new TRPCError({ code: 'CONFLICT', message: '他の利用者がメモを変更しました。入力は保持しています。最新の保存内容を確認してから編集し直してください' });
      if ((row?.body ?? '') === input.body) return { success: true, version, changed: false };
      const values = { body: input.body, version: version + 1, updatedBy: ctx.user.id, updatedByName: (ctx.user.name ?? `User #${ctx.user.id}`).slice(0, 128), updatedAt: new Date() };
      if (row) await tx.update(caseInternalMemos).set(values).where(eq(caseInternalMemos.caseId, parent.id));
      else await tx.insert(caseInternalMemos).values({ ...values, caseId: parent.id });
      return { success: true, version: version + 1, changed: true };
    });
  }),
});
