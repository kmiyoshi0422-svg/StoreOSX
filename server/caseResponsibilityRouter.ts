import { and, desc, eq, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { cases, partners, users, appSettings, responsibleOfficerAccounts, caseResponsibilityLogs } from '../drizzle/schema';
import { getDb, getCaseById } from './db';
import { protectedProcedure, router } from './_core/trpc';
import { canManageCases, canAccessPrefecture, canViewInternalFinancials, filterCasesByArea, redactTextWithAmounts } from '../shared/accessPolicy';
import { OFFICER_KEYS, RESPONSIBLE_OFFICERS, requiresResponsibilityAlert, summarizePersonalCases } from '../shared/caseResponsibility';

export async function getConfirmedOfficer(userId: number) {
  const db = await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR',message:'DBへ接続できません' });
  const [record] = await db.select().from(responsibleOfficerAccounts).where(eq(responsibleOfficerAccounts.userId,userId)).limit(1);
  if(record)return record.officerKey;
  const [account]=await db.select({email:users.email,role:users.role}).from(users).where(eq(users.id,userId)).limit(1);
  if(!account?.email||!canManageCases(account.role))return null;
  const [setting]=await db.select({value:appSettings.settingValue}).from(appSettings).where(eq(appSettings.settingKey,'responsibility.confirmedEmailBindings')).limit(1);
  let bindings:Record<string,string>={};try{bindings=JSON.parse(setting?.value??'{}');}catch{return null;}
  const key=bindings[account.email.toLowerCase()];
  if(!OFFICER_KEYS.includes(key as typeof OFFICER_KEYS[number]))return null;
  const officerKey=key as typeof OFFICER_KEYS[number];
  await db.insert(responsibleOfficerAccounts).values({userId,officerKey}).onDuplicateKeyUpdate({set:{officerKey}});
  return officerKey;
}
async function personalRows() {
  const db = await getDb(); if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.select({ id:cases.id,requestNumber:cases.requestNumber,storeName:cases.storeName,brand:cases.brand,
    prefecture:cases.prefecture,status:cases.status,urgency:cases.urgency,progressStage:cases.progressStage,
    requestContent:cases.requestContent,requestDate:cases.requestDate,createdAt:cases.createdAt,
    firstResponseDate:cases.firstResponseDate,responsePlannedDate:cases.responsePlannedDate,surveyDate:cases.surveyDate,
    constructionDate:cases.constructionDate,assigneeId:cases.assigneeId,responsibleOfficer:cases.responsibleOfficer,partnerId:cases.partnerId,
  }).from(cases).orderBy(desc(cases.createdAt));
}
export const caseResponsibilityRouter = router({
  identity: protectedProcedure.query(async({ctx})=>({officerKey:canManageCases(ctx.user.role)?await getConfirmedOfficer(ctx.user.id):null})),
  options: protectedProcedure.query(({ctx})=>{
    if(!canManageCases(ctx.user.role))throw new TRPCError({code:'FORBIDDEN'});
    return RESPONSIBLE_OFFICERS;
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
  set: protectedProcedure.input(z.object({caseId:z.number().int().positive(),officerKey:z.enum(OFFICER_KEYS)})).mutation(async({ctx,input})=>{
    if(!canManageCases(ctx.user.role))throw new TRPCError({code:'FORBIDDEN',message:'案件責任者の選択は社員以上のみです'});
    const current=await getCaseById(input.caseId);if(!current)throw new TRPCError({code:'NOT_FOUND'});
    if(!canAccessPrefecture(ctx.user,current.prefecture))throw new TRPCError({code:'FORBIDDEN',message:'対象エリアの案件を変更できません'});
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return db.transaction(async tx=>{
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
      const samePerson = officerKey ? await db.select({ id: responsibleOfficerAccounts.userId }).from(responsibleOfficerAccounts).where(eq(responsibleOfficerAccounts.officerKey, officerKey)) : [];
      for (const item of samePerson) ownIds.add(item.id);
      rows=filterCasesByArea(rows,ctx.user).filter(row=>(row.assigneeId!=null&&ownIds.has(row.assigneeId))||(officerKey!==null&&row.responsibleOfficer===officerKey));
    }
    const safe=rows.map(({partnerId,...row})=>({...row,
      isOwnAssignment: ctx.user.role === 'partner' || (row.assigneeId !== null && ownIds.has(row.assigneeId)),
      requestContent:canViewInternalFinancials(ctx.user.role)?row.requestContent:redactTextWithAmounts(row.requestContent),
      ...(ctx.user.role==='partner'?{firstResponseDate:null,responsePlannedDate:null}:{}),
    }));
    return {officerKey,assignmentKind:ctx.user.role==='partner'?'partner' as const:'internal' as const,rows:safe,summary:summarizePersonalCases(safe)};
  }),
});
