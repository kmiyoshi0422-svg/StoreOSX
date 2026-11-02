import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { users } from '../drizzle/schema';
import { getDb } from './db';
import { canManageCases, canAccessPrefecture } from '../shared/accessPolicy';
import { isExcludedCaseAssignee } from '../shared/caseAssigneeRoster';

/** 新規割当用。既存の担当IDを保持するだけの更新には呼び出さない。 */
export async function assertNewCaseAssignee(userId: number | null | undefined, prefecture: string | null | undefined) {
  if (userId == null) return;
  if (!Number.isInteger(userId) || userId <= 0 || isExcludedCaseAssignee(userId)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'この利用者は社内担当者の新規割当候補から除外されています' });
  }
  const person = await requireActiveAssignee(userId);
  if (!canManageCases(person.role) || !canAccessPrefecture(person, prefecture)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '社員以上で案件エリアを閲覧できる担当者を選んでください' });
  }
}

/** ルート担当の既存の区分仕様は変えず、停止アカウントへの新規割当を拒否。 */
export async function requireActiveAssignee(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DBへ接続できません' });
  const [person] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!person || person.disabledAt) throw new TRPCError({ code: 'BAD_REQUEST', message: '利用停止中または登録されていない担当者には新規割当できません' });
  return person;
}
