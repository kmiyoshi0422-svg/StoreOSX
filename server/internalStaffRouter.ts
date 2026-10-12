import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { and, inArray } from 'drizzle-orm';
import { cases, responsibleOfficerAccounts } from '../drizzle/schema';
import { getDb, getAllUsers, getAppSetting } from './db';
import { protectedProcedure, router } from './_core/trpc';
import { canManageCases, filterCasesByArea } from '../shared/accessPolicy';
import { buildInternalStaffGroups, countStaffAssignments } from '../shared/internalStaffSummary';
import { isActiveCase } from '../shared/caseResponsibility';

async function groups() {
  const db = await getDb(); if (!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'DBへ接続できません'});
  const [users, bindings, accounts] = await Promise.all([getAllUsers(), getAppSetting<Record<string,string>>('responsibility.confirmedEmailBindings'),
    db.select({userId:responsibleOfficerAccounts.userId,officerKey:responsibleOfficerAccounts.officerKey}).from(responsibleOfficerAccounts)]);
  return buildInternalStaffGroups(users, bindings ?? {}, accounts);
}
export const internalStaffRouter = router({
  summary: protectedProcedure.query(async ({ctx}) => {
    if (!canManageCases(ctx.user.role)) throw new TRPCError({code:'FORBIDDEN',message:'社内担当者一覧は社員以上のみ閲覧できます'});
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    const [people, rawRows] = await Promise.all([groups(), db.select({id:cases.id,assigneeId:cases.assigneeId,status:cases.status,prefecture:cases.prefecture}).from(cases)]);
    const rows=filterCasesByArea(rawRows,ctx.user);
    return {rows:countStaffAssignments(people,rows),unassignedActive:rows.filter(x=>x.assigneeId===null&&isActiveCase(x)).length,
      updatedAt:new Date(),areaLimited:ctx.user.areaAccessMode==='selected'&&!['owner','admin'].includes(ctx.user.role)};
  }),
  assignments: protectedProcedure.input(z.object({staffKey:z.string().min(1).max(80),scope:z.enum(['active','all']).default('active')})).query(async ({ctx,input}) => {
    if (!canManageCases(ctx.user.role)) throw new TRPCError({code:'FORBIDDEN'});
    const group=(await groups()).find(x=>x.key===input.staffKey);
    if(!group)throw new TRPCError({code:'NOT_FOUND',message:'担当者が見つかりません'});
    if(!group.userIds.length)return [];
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    const rows=await db.select({id:cases.id,requestNumber:cases.requestNumber,storeName:cases.storeName,prefecture:cases.prefecture,
      status:cases.status,urgency:cases.urgency,progressStage:cases.progressStage,assigneeId:cases.assigneeId}).from(cases).where(and(inArray(cases.assigneeId,group.userIds)));
    return filterCasesByArea(rows,ctx.user).filter(row=>input.scope==='all'||isActiveCase(row)).sort((a,b)=>b.id-a.id);
  }),
});
