import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { router, protectedProcedure } from './_core/trpc';
import { getDb } from './db';
import { cases, users, partners, ownerManagementLogs } from '../drizzle/schema';
import { APP_ROLES, canManageCases, canAccessPrefecture } from '../shared/accessPolicy';
import { isExcludedCaseAssignee } from '../shared/caseAssigneeRoster';
import { PREFECTURES } from '../shared/prefecture';

const ownerOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'owner') throw new TRPCError({ code: 'FORBIDDEN', message: 'この変更は最高管理者のみ実行できます' });
  return next({ ctx });
});
const isActive = (status: string) => !['完了', 'クローズ', '失注'].includes(status);
const idsKey = (ids: number[]) => [...ids].sort((a,b)=>a-b).join(',');
const assignmentSchema = z.object({
  assigneeId: z.number().int().positive().nullable(), partnerId: z.number().int().positive().nullable(),
  contractorName: z.string().max(255).nullable(), contractorPic: z.string().max(128).nullable(), contractorPhone: z.string().max(32).nullable(),
});
export function caseAssignmentSnapshot(row: z.infer<typeof assignmentSchema>) {
  return { assigneeId: row.assigneeId ?? null, partnerId: row.partnerId ?? null, contractorName: row.contractorName ?? null, contractorPic: row.contractorPic ?? null, contractorPhone: row.contractorPhone ?? null };
}
export const ownerPeopleRouter = router({
  list: ownerOnly.query(async () => {
    const db = await getDb(); if (!db) throw new TRPCError({ code:'INTERNAL_SERVER_ERROR' });
    const [allUsers, allPartners, allCases] = await Promise.all([
      db.select({ id: users.id, name: users.name, nameOverride: users.nameOverride, email: users.email, role: users.role, areaAccessMode: users.areaAccessMode, allowedPrefectures: users.allowedPrefectures }).from(users),
      db.select({ id: partners.id, name: partners.name, isActive: partners.isActive, userId: partners.userId }).from(partners),
      db.select({ assigneeId: cases.assigneeId, partnerId: cases.partnerId, status: cases.status }).from(cases),
    ]);
    return { users: allUsers.map(u => {
      const links = allPartners.filter(p => p.userId === u.id); const linkedIds = new Set(links.map(p=>p.id));
      const internal = allCases.filter(c=>c.assigneeId===u.id); const external = allCases.filter(c=>c.partnerId!==null && linkedIds.has(c.partnerId));
      return { ...u, partnerLinks: links.map(({ id,name })=>({ id,name })), activeInternalCases: internal.filter(c=>isActive(c.status)).length, totalInternalCases: internal.length, activePartnerCases: external.filter(c=>isActive(c.status)).length, totalPartnerCases: external.length };
    }), partners: allPartners };
  }),
  changeCategory: ownerOnly.input(z.object({
    userId: z.number().int().positive(), expectedRole: z.enum(APP_ROLES), role: z.enum(['user','admin','executive','partner']),
    partnerId: z.number().int().positive().nullable(), expectedPartnerIds: z.array(z.number().int().positive()).max(100),
    staffAreaAccessMode: z.enum(['all','selected']), staffAllowedPrefectures: z.array(z.enum(PREFECTURES)).max(PREFECTURES.length),
    reason: z.string().trim().min(3, '変更理由を3文字以上入力してください').max(500),
  })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) throw new TRPCError({ code:'FORBIDDEN', message:'自分自身の最高管理者権限は変更できません' });
    if (input.role==='partner' && input.partnerId===null) throw new TRPCError({ code:'BAD_REQUEST', message:'担当会社を選択してください' });
    if (input.role!=='partner' && input.partnerId!==null) throw new TRPCError({ code:'BAD_REQUEST', message:'社内へ変更する場合、業者紐付けを解除してください' });
    if (['user','executive'].includes(input.role) && input.staffAreaAccessMode==='selected' && input.staffAllowedPrefectures.length===0) throw new TRPCError({ code:'BAD_REQUEST', message:'閲覧エリアを選択してください' });
    const db=await getDb(); if(!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return db.transaction(async tx=>{
      const [target]=await tx.select().from(users).where(eq(users.id,input.userId)).for('update');
      if(!target) throw new TRPCError({code:'NOT_FOUND',message:'対象ユーザーが見つかりません'});
      if(target.role==='owner' || target.role==='customer') throw new TRPCError({code:'FORBIDDEN',message:'最高管理者と顧客はこの区分変更の対象外です'});
      if(target.role!==input.expectedRole) throw new TRPCError({code:'CONFLICT',message:'役割が変更されています。最新情報を再確認してください'});
      const involved=await tx.select().from(partners).where(input.partnerId===null ? eq(partners.userId,target.id) : or(eq(partners.userId,target.id),eq(partners.id,input.partnerId))).for('update');
      const oldLinks=involved.filter(p=>p.userId===target.id);
      if(idsKey(oldLinks.map(p=>p.id))!==idsKey(input.expectedPartnerIds)) throw new TRPCError({code:'CONFLICT',message:'業者紐付けが変更されています。最新情報を再確認してください'});
      const selected=input.partnerId===null ? null : involved.find(p=>p.id===input.partnerId);
      if(input.role==='partner' && (!selected || !selected.isActive)) throw new TRPCError({code:'BAD_REQUEST',message:'有効な協力会社を選択してください'});
      if(selected && selected.userId!==null && selected.userId!==target.id) throw new TRPCError({code:'CONFLICT',message:'この協力会社は別のユーザーに紐付いています。自動で入れ替えることはできません'});
      const areaAccessMode=['partner','admin'].includes(input.role)?'all':input.staffAreaAccessMode;
      const allowedPrefectures=JSON.stringify(areaAccessMode==='selected'?Array.from(new Set(input.staffAllowedPrefectures)):[]);
      const before={role:target.role,areaAccessMode:target.areaAccessMode,allowedPrefectures:target.allowedPrefectures,partnerIds:oldLinks.map(p=>p.id).sort((a,b)=>a-b)};
      const after={role:input.role,areaAccessMode,allowedPrefectures,partnerIds:input.role==='partner'?[input.partnerId!]:[]};
      if(JSON.stringify(before)===JSON.stringify(after)) return {success:true,changed:false};
      await tx.update(partners).set({userId:null}).where(eq(partners.userId,target.id));
      if(selected && input.role==='partner') await tx.update(partners).set({userId:target.id}).where(eq(partners.id,selected.id));
      await tx.update(users).set({role:input.role,areaAccessMode,allowedPrefectures}).where(eq(users.id,target.id));
      await tx.insert(ownerManagementLogs).values({kind:'user_category',targetId:target.id,beforeJson:JSON.stringify(before),afterJson:JSON.stringify(after),reason:input.reason,changedBy:ctx.user.id,changedByName:(ctx.user.name??`User #${ctx.user.id}`).slice(0,128)});
      return {success:true,changed:true};
    });
  }),
  changeCaseAssignment: ownerOnly.input(z.object({
    caseId:z.number().int().positive(),expected:assignmentSchema,next:assignmentSchema,
    reason:z.string().trim().min(3,'変更理由を3文字以上入力してください').max(500),
  })).mutation(async({ctx,input})=>{
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return db.transaction(async tx=>{
      const [row]=await tx.select().from(cases).where(eq(cases.id,input.caseId)).for('update');
      if(!row)throw new TRPCError({code:'NOT_FOUND'});
      const before=caseAssignmentSnapshot(row);
      if(JSON.stringify(before)!==JSON.stringify(caseAssignmentSnapshot(input.expected)))throw new TRPCError({code:'CONFLICT',message:'担当情報が変更されています。入力を残したまま最新情報を再確認してください'});
      const after=caseAssignmentSnapshot({...input.next,contractorName:input.next.contractorName?.trim()||null,contractorPic:input.next.contractorPic?.trim()||null,contractorPhone:input.next.contractorPhone?.trim()||null});
      if(after.assigneeId!==null && after.assigneeId!==before.assigneeId){
        const [person]=await tx.select().from(users).where(eq(users.id,after.assigneeId)).for('update');
        if(!person||!canManageCases(person.role)||isExcludedCaseAssignee(person.id)||!canAccessPrefecture(person,row.prefecture))throw new TRPCError({code:'BAD_REQUEST',message:'社員以上で案件エリアを閲覧できる社内担当者を選んでください'});
      }
      if(after.partnerId!==null && after.partnerId!==before.partnerId){
        const [company]=await tx.select().from(partners).where(eq(partners.id,after.partnerId)).for('update');
        if(!company||!company.isActive)throw new TRPCError({code:'BAD_REQUEST',message:'有効な協力会社を選択してください'});
      }
      if(JSON.stringify(before)===JSON.stringify(after))return {success:true,changed:false};
      await tx.update(cases).set(after).where(eq(cases.id,row.id));
      await tx.insert(ownerManagementLogs).values({kind:'case_assignment',targetId:row.id,beforeJson:JSON.stringify(before),afterJson:JSON.stringify(after),reason:input.reason,changedBy:ctx.user.id,changedByName:(ctx.user.name??`User #${ctx.user.id}`).slice(0,128)});
      return {success:true,changed:true};
    });
  }),
  renameUser: ownerOnly.input(z.object({userId:z.number().int().positive(),expectedName:z.string().nullable(),name:z.string().trim().min(1).max(128),reason:z.string().trim().min(3).max(500)})).mutation(async({ctx,input})=>{
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return db.transaction(async tx=>{
      const [target]=await tx.select().from(users).where(eq(users.id,input.userId)).for('update');
      if(!target)throw new TRPCError({code:'NOT_FOUND'});
      if(target.name!==input.expectedName)throw new TRPCError({code:'CONFLICT',message:'登録名が変更されています。最新情報を確認してください'});
      if(target.name===input.name&&target.nameOverride===input.name)return {success:true,changed:false};
      await tx.update(users).set({name:input.name,nameOverride:input.name}).where(eq(users.id,target.id));
      await tx.insert(ownerManagementLogs).values({kind:'user_profile',targetId:target.id,beforeJson:JSON.stringify({name:target.name,nameOverride:target.nameOverride}),afterJson:JSON.stringify({name:input.name,nameOverride:input.name}),reason:input.reason,changedBy:ctx.user.id,changedByName:(ctx.user.name??`User #${ctx.user.id}`).slice(0,128)});
      return {success:true,changed:true};
    });
  }),
  companies: ownerOnly.query(async()=>{
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    const [companies,people,rows]=await Promise.all([db.select({id:partners.id,name:partners.name,isActive:partners.isActive,userId:partners.userId}).from(partners),db.select({id:users.id,name:users.name,email:users.email,role:users.role}).from(users),db.select({partnerId:cases.partnerId,status:cases.status}).from(cases)]);
    return {companies:companies.map(p=>({...p,totalCases:rows.filter(c=>c.partnerId===p.id).length,activeCases:rows.filter(c=>c.partnerId===p.id&&isActive(c.status)).length})),users:people};
  }),
  updateCompany: ownerOnly.input(z.object({partnerId:z.number().int().positive(),expected:z.object({name:z.string(),isActive:z.boolean(),userId:z.number().int().positive().nullable()}),next:z.object({name:z.string().trim().min(1).max(255),isActive:z.boolean(),userId:z.number().int().positive().nullable()}),reason:z.string().trim().min(3).max(500)})).mutation(async({ctx,input})=>{
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return db.transaction(async tx=>{
      const [company]=await tx.select().from(partners).where(eq(partners.id,input.partnerId)).for('update');
      if(!company)throw new TRPCError({code:'NOT_FOUND'});
      const before={name:company.name,isActive:company.isActive,userId:company.userId};
      if(JSON.stringify(before)!==JSON.stringify(input.expected))throw new TRPCError({code:'CONFLICT',message:'協力会社情報が変更されています。最新情報を再確認してください'});
      if(input.next.userId!==null&&input.next.userId!==company.userId){
        const [person]=await tx.select().from(users).where(eq(users.id,input.next.userId)).for('update');
        if(!person||person.role!=='partner')throw new TRPCError({code:'BAD_REQUEST',message:'協力業者区分のログイン利用者を選択してください。社員・管理者の自動降格は行いません'});
      }
      if(JSON.stringify(before)===JSON.stringify(input.next))return {success:true,changed:false};
      await tx.update(partners).set(input.next).where(eq(partners.id,company.id));
      await tx.insert(ownerManagementLogs).values({kind:'partner_profile',targetId:company.id,beforeJson:JSON.stringify(before),afterJson:JSON.stringify(input.next),reason:input.reason,changedBy:ctx.user.id,changedByName:(ctx.user.name??`User #${ctx.user.id}`).slice(0,128)});
      return {success:true,changed:true};
    });
  }),
  history: ownerOnly.input(z.object({kind:z.enum(['user_category','case_assignment','user_profile','partner_profile']),targetId:z.number().int().positive()})).query(async({input})=>{
    const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    return db.select().from(ownerManagementLogs).where(and(eq(ownerManagementLogs.kind,input.kind),eq(ownerManagementLogs.targetId,input.targetId))).orderBy(desc(ownerManagementLogs.id)).limit(50);
  }),
});
