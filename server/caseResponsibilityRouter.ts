import { and, desc, eq, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { cases, partners, users, appSettings, responsibleOfficerAccounts, caseResponsibilityLogs } from '../drizzle/schema';
import { getDb, getCaseById } from './db';
import { protectedProcedure, router } from './_core/trpc';
import { canManageCases, canAccessPrefecture, canViewInternalFinancials, filterCasesByArea, redactTextWithAmounts } from '../shared/accessPolicy';
import { requiresResponsibilityAlert, summarizePersonalCases } from '../shared/caseResponsibility';

import { loadOfficerRoster, officerDirectory, assertCurrentOfficer, type RosterDb } from './responsibilityRosterStore';
import { rosterAdminProcedures } from './responsibilityRosterAdmin';

export async function getConfirmedOfficer(userId: number, transactionDb?: RosterDb) {
  const db = transactionDb ?? await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR',message:'DBへ接続できません' });
  const roster = await loadOfficerRoster(db);
  const [account] = await db.select().from(users).where(eq(users.id,userId)).limit(1);
  if (!account || account.disabledAt || !canManageCases(account.role)) return null;
  return roster.current.find(member => member.userIds.includes(userId))?.key ?? null;
}
async function personalRows() {
  const db = await getDb(); if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.select({ id:cases.id,requestNumber:cases.requestNumber,storeName:cases.storeName,brand:cases.brand,
    prefecture:cases.prefecture,status:cases.status,urgency:cases.urgency,progressStage:cases.progressStage,
    requestContent:cases.requestContent,requestDate:cases.requestDate,createdAt:cases.createdAt,
    firstResponseDate:cases.firstResponseDate,responsePlannedDate:cases.responsePlannedDate,surveyDate:cases.surveyDate,
    completionDeadline:cases.completionDeadline,
    constructionDate:cases.constructionDate,assigneeId:cases.assigneeId,responsibleOfficer:cases.responsibleOfficer,partnerId:cases.partnerId,
  }).from(cases).orderBy(desc(cases.createdAt));
}
export const caseResponsibilityRouter = router({
  ...rosterAdminProcedures,
  directory: protectedProcedure.query(async ({ctx}) => {
    if(!canManageCases(ctx.user.role) && ctx.user.role !== 'partner') throw new TRPCError({code:'FORBIDDEN'});
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return officerDirectory(db);
  }),
  identity: protectedProcedure.query(async({ctx})=>({officerKey:canManageCases(ctx.user.role)?await getConfirmedOfficer(ctx.user.id):null})),
  options: protectedProcedure.query(async({ctx})=>{
    if(!canManageCases(ctx.user.role))throw new TRPCError({code:'FORBIDDEN'});
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return (await officerDirectory(db)).filter(member=>member.active);
  }),
  alerts: protectedProcedure.query(async({ctx})=>{
    if(!canManageCases(ctx.user.role))return { eligible:false,officerKey:null,count:0,rows:[] };
    const officerKey=await getConfirmedOfficer(ctx.user.id);
    if(!officerKey)return { eligible:false,officerKey:null,count:0,rows:[] };
    const now=Date.now();
    const rows=filterCasesByArea(await personalRows(),ctx.user).filter(row=>requiresResponsibilityAlert(row,now)).map(row=>({
      id:row.id,requestNumber:row.requestNumber,storeName:row.storeName,prefecture:row.prefecture,status:row.status,
      urgency:row.urgency,createdAt:row.createdAt,requestDate:row.requestDate,responsibleOfficer:row.responsibleOfficer,
      elapsedDays:Math.floor((now-row.createdAt.getTime())/(24*60*60*1000)),
    }));
    return {eligible:true,officerKey,count:rows.length,rows};
  }),
  bulkAssign: protectedProcedure.input(z.object({
    caseIds:z.array(z.number().int().positive()).min(1).max(100), officerKey:z.string().trim().min(1).max(32),
  })).mutation(async({ctx,input})=>{
    if(!canManageCases(ctx.user.role)||!await getConfirmedOfficer(ctx.user.id))
      throw new TRPCError({code:'FORBIDDEN',message:'一括割当は指定5名の本人アカウントだけが利用できます'});
    const ids=Array.from(new Set(input.caseIds)).sort((a,b)=>a-b);
    if(ids.length!==input.caseIds.length)throw new TRPCError({code:'BAD_REQUEST',message:'選択案件が重複しています'});
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return db.transaction(async tx=>{
      await assertCurrentOfficer(tx,input.officerKey);
      if (!await getConfirmedOfficer(ctx.user.id,tx)) throw new TRPCError({code:'FORBIDDEN',message:'責任者メンバーが入れ替わったため一括割当を停止しました。最新の一覧を確認してください'});
      const locked=await tx.select().from(cases).where(inArray(cases.id,ids)).orderBy(cases.id).for('update');
      if(locked.length!==ids.length)throw new TRPCError({code:'CONFLICT',message:'選択案件が削除されています。一覧を更新してください。変更は行っていません'});
      for(const row of locked){
        if(!canAccessPrefecture(ctx.user,row.prefecture))throw new TRPCError({code:'FORBIDDEN',message:'許可エリア外の案件が含まれるため、全件の更新を停止しました'});
        if(!requiresResponsibilityAlert(row))throw new TRPCError({code:'CONFLICT',message:'責任者決定済みまたは対象外になった案件があります。一覧を更新してください。変更は行っていません'});
      }
      await tx.update(cases).set({responsibleOfficer:input.officerKey}).where(inArray(cases.id,ids));
      await tx.insert(caseResponsibilityLogs).values(ids.map(caseId=>({caseId,beforeOfficer:null,afterOfficer:input.officerKey,changedBy:ctx.user.id,changedByName:ctx.user.name??`User #${ctx.user.id}`})));
      return {success:true,count:ids.length,caseIds:ids};
    });
  }),
  set: protectedProcedure.input(z.object({caseId:z.number().int().positive(),officerKey:z.string().trim().min(1).max(32)})).mutation(async({ctx,input})=>{
    if(!canManageCases(ctx.user.role))throw new TRPCError({code:'FORBIDDEN',message:'案件責任者の選択は社員以上のみです'});
    const current=await getCaseById(input.caseId);if(!current)throw new TRPCError({code:'NOT_FOUND'});
    if(!canAccessPrefecture(ctx.user,current.prefecture))throw new TRPCError({code:'FORBIDDEN',message:'対象エリアの案件を変更できません'});
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return db.transaction(async tx=>{
      await assertCurrentOfficer(tx,input.officerKey);
      const [locked]=await tx.select().from(cases).where(eq(cases.id,input.caseId)).for('update');
      if(!locked)throw new TRPCError({code:'NOT_FOUND'});
      if(!canAccessPrefecture(ctx.user,locked.prefecture))throw new TRPCError({code:'FORBIDDEN'});
      if(locked.responsibleOfficer===input.officerKey)return {success:true,changed:false};
      await tx.update(cases).set({responsibleOfficer:input.officerKey}).where(eq(cases.id,input.caseId));
      await tx.insert(caseResponsibilityLogs).values({caseId:input.caseId,beforeOfficer:locked.responsibleOfficer,afterOfficer:input.officerKey,changedBy:ctx.user.id,changedByName:ctx.user.name??`User #${ctx.user.id}`});
      return {success:true,changed:true};
    });
  }),
  history: protectedProcedure.input(z.object({caseId:z.number().int().positive()})).query(async({ctx,input})=>{
    if(!canManageCases(ctx.user.role))throw new TRPCError({code:'FORBIDDEN'});
    const row=await getCaseById(input.caseId);if(!row)throw new TRPCError({code:'NOT_FOUND'});
    if(!canAccessPrefecture(ctx.user,row.prefecture))throw new TRPCError({code:'FORBIDDEN'});
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return db.select().from(caseResponsibilityLogs).where(eq(caseResponsibilityLogs.caseId,input.caseId)).orderBy(desc(caseResponsibilityLogs.id));
  }),
  personal: protectedProcedure.query(async({ctx})=>{
    if(!canManageCases(ctx.user.role)&&ctx.user.role!=='partner')throw new TRPCError({code:'FORBIDDEN',message:'社内・協力業者の担当案件ページです'});
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    const officerKey=canManageCases(ctx.user.role)?await getConfirmedOfficer(ctx.user.id):null;
    const ownIds = new Set([ctx.user.id]);
    let rows=await personalRows();
    if(ctx.user.role==='partner'){
      const companies=await db.select({id:partners.id}).from(partners).where(eq(partners.userId,ctx.user.id));
      const ids=new Set(companies.map(x=>x.id));
      rows=rows.filter(row=>row.partnerId!=null&&ids.has(row.partnerId));
    }else {
      const roster=await loadOfficerRoster(db);
      const owned=[...roster.current,...roster.archived].filter(member=>member.userIds.includes(ctx.user.id));
      const keys=new Set(owned.map(member=>member.key));
      for(const member of owned)for(const id of member.userIds)ownIds.add(id);
      rows=filterCasesByArea(rows,ctx.user).filter(row=>(row.assigneeId!=null&&ownIds.has(row.assigneeId))||(row.responsibleOfficer!=null&&keys.has(row.responsibleOfficer)));
    }
    const safe=rows.map(({partnerId,...row})=>({...row,
      isOwnAssignment: ctx.user.role === 'partner' || (row.assigneeId !== null && ownIds.has(row.assigneeId)),
      requestContent:canViewInternalFinancials(ctx.user.role)?row.requestContent:redactTextWithAmounts(row.requestContent),
      ...(ctx.user.role==='partner'?{firstResponseDate:null,responsePlannedDate:null}:{}),
    }));
    return {officerKey,assignmentKind:ctx.user.role==='partner'?'partner' as const:'internal' as const,rows:safe,summary:summarizePersonalCases(safe)};
  }),
});
