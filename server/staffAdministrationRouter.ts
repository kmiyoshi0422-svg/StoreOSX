import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { router, protectedProcedure } from './_core/trpc';
import { getDb } from './db';
import { cases, users, staffRegistrations, ownerManagementLogs } from '../drizzle/schema';
import { PREFECTURES } from '../shared/prefecture';

const staffRoles = ['user', 'admin', 'executive'] as const;
const ownerOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'owner') throw new TRPCError({ code: 'FORBIDDEN', message: '在籍・退職管理は最高管理者のみ利用できます' });
  return next({ ctx });
});
const reason = z.string().trim().min(3, '理由を3文字以上入力してください').max(500);
const activeCase = (status: string) => !['完了', 'クローズ', '失注'].includes(status);
const iso = (date: Date | null | undefined) => date?.toISOString() ?? null;
const dbRequired = async () => { const db = await getDb(); if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DBへ接続できません' }); return db; };

export const staffAdministrationRouter = router({
  list: ownerOnly.query(async () => {
    const db = await dbRequired();
    const [people, registrations, rows] = await Promise.all([
      db.select({ id: users.id, name: users.name, email: users.email, role: users.role, disabledAt: users.disabledAt }).from(users).where(inArray(users.role, ['owner', ...staffRoles])),
      db.select().from(staffRegistrations).orderBy(desc(staffRegistrations.id)),
      db.select({ assigneeId: cases.assigneeId, status: cases.status }).from(cases),
    ]);
    return { users: people.map(person => {
      const assigned = rows.filter(row => row.assigneeId === person.id);
      return { ...person, activeCases: assigned.filter(row => activeCase(row.status)).length, totalCases: assigned.length };
    }), registrations };
  }),
  register: ownerOnly.input(z.object({
    name: z.string().trim().min(1).max(128), email: z.string().trim().email().max(320).transform(value => value.toLowerCase()),
    role: z.enum(staffRoles), areaAccessMode: z.enum(['all', 'selected']), allowedPrefectures: z.array(z.enum(PREFECTURES)).max(PREFECTURES.length), reason,
  })).mutation(async ({ ctx, input }) => {
    const mode = input.role === 'admin' ? 'all' : input.areaAccessMode;
    if (mode === 'selected' && !input.allowedPrefectures.length) throw new TRPCError({ code: 'BAD_REQUEST', message: '閲覧エリアを選択してください' });
    const db = await dbRequired();
    return db.transaction(async tx => {
      const [old] = await tx.select().from(staffRegistrations).where(eq(staffRegistrations.email, input.email)).for('update');
      if (old) throw new TRPCError({ code: 'CONFLICT', message: 'このメールは登録済みです。初回ログイン待ち・取消済み一覧を確認してください' });
      const existing = await tx.select({ id: users.id }).from(users).where(sql`LOWER(TRIM(${users.email})) = ${input.email}`).for('update');
      if (existing.length) throw new TRPCError({ code: 'CONFLICT', message: '既存の利用者です。利用者名・区分管理で区分変更、退職済みならこの画面で復帰してください' });
      const values = { name: input.name, email: input.email, role: input.role, areaAccessMode: mode, allowedPrefectures: JSON.stringify(mode === 'selected' ? Array.from(new Set(input.allowedPrefectures)) : []), createdBy: ctx.user.id };
      const inserted = await tx.insert(staffRegistrations).values(values).$returningId();
      await tx.insert(ownerManagementLogs).values({ kind: 'staff_registration', targetId: inserted[0].id, beforeJson: '{}', afterJson: JSON.stringify({ ...values, state: 'pending' }), reason: input.reason, changedBy: ctx.user.id, changedByName: (ctx.user.name ?? '最高管理者').slice(0, 128) });
      return { success: true, registrationId: inserted[0].id };
    });
  }),
  setUserState: ownerOnly.input(z.object({ userId: z.number().int().positive(), expectedRole: z.string(), expectedDisabledAt: z.string().datetime().nullable(), disabled: z.boolean(), reason })).mutation(async ({ ctx, input }) => {
    const db = await dbRequired();
    return db.transaction(async tx => {
      const [person] = await tx.select().from(users).where(eq(users.id, input.userId)).for('update');
      if (!person) throw new TRPCError({ code: 'NOT_FOUND', message: '対象者が見つかりません' });
      if (person.id === ctx.user.id || person.role === 'owner') throw new TRPCError({ code: 'FORBIDDEN', message: '自分自身・最高管理者は利用停止できません' });
      if (!staffRoles.includes(person.role as typeof staffRoles[number])) throw new TRPCError({ code: 'BAD_REQUEST', message: '社員・管理者・役員が対象です。協力業者は協力会社管理を確認してください' });
      if (person.role !== input.expectedRole || iso(person.disabledAt) !== input.expectedDisabledAt) throw new TRPCError({ code: 'CONFLICT', message: '区分または利用状態が変更されています。最新情報を確認してください' });
      if (Boolean(person.disabledAt) === input.disabled) return { success: true, changed: false };
      const disabledAt = input.disabled ? new Date() : null;
      await tx.update(users).set({ disabledAt }).where(eq(users.id, person.id));
      await tx.insert(ownerManagementLogs).values({ kind: 'user_lifecycle', targetId: person.id, beforeJson: JSON.stringify({ role: person.role, disabledAt: iso(person.disabledAt) }), afterJson: JSON.stringify({ role: person.role, disabledAt: iso(disabledAt) }), reason: input.reason, changedBy: ctx.user.id, changedByName: (ctx.user.name ?? '最高管理者').slice(0, 128) });
      return { success: true, changed: true };
    });
  }),
  setRegistrationState: ownerOnly.input(z.object({ registrationId: z.number().int().positive(), expectedVersion: z.number().int().positive(), active: z.boolean(), reason })).mutation(async ({ ctx, input }) => {
    const db = await dbRequired();
    return db.transaction(async tx => {
      const [row] = await tx.select().from(staffRegistrations).where(eq(staffRegistrations.id, input.registrationId)).for('update');
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      if (row.state === 'active' || row.userId !== null || row.version !== input.expectedVersion) throw new TRPCError({ code: 'CONFLICT', message: '登録内容が変更・本人紐付けされています。最新情報を確認してください' });
      const state = input.active ? 'pending' : 'canceled';
      if (row.state === state) return { success: true, changed: false };
      if (input.active) {
        const existing = await tx.select({ id: users.id }).from(users).where(sql`LOWER(TRIM(${users.email})) = ${row.email}`).for('update');
        if (existing.length) throw new TRPCError({ code: 'CONFLICT', message: '同じメールの利用者が登録済みです。利用者名・区分管理を確認してください' });
      }
      await tx.update(staffRegistrations).set({ state, version: row.version + 1 }).where(eq(staffRegistrations.id, row.id));
      await tx.insert(ownerManagementLogs).values({ kind: 'staff_registration', targetId: row.id, beforeJson: JSON.stringify({ state: row.state, version: row.version }), afterJson: JSON.stringify({ state, version: row.version + 1 }), reason: input.reason, changedBy: ctx.user.id, changedByName: (ctx.user.name ?? '最高管理者').slice(0, 128) });
      return { success: true, changed: true };
    });
  }),
  history: ownerOnly.input(z.object({ kind: z.enum(['user_lifecycle', 'staff_registration']), targetId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await dbRequired();
    return db.select().from(ownerManagementLogs).where(and(eq(ownerManagementLogs.kind, input.kind), eq(ownerManagementLogs.targetId, input.targetId))).orderBy(desc(ownerManagementLogs.id)).limit(50);
  }),
});
