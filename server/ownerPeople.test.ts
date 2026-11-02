import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq, inArray, and } from 'drizzle-orm';
import fs from 'node:fs';
import { appRouter } from './routers';
import { getDb, deleteCase } from './db';
import { users, cases, partners, ownerManagementLogs } from '../drizzle/schema';
import { caseAssignmentSnapshot } from './ownerPeopleRouter';
import type { TrpcContext } from './_core/context';

describe('最高管理者の担当／区分変更 実DB',()=>{
 let db:NonNullable<Awaited<ReturnType<typeof getDb>>>;let staffId=0,otherId=0,lockedId=0,customerId=0;let companyId=0,occupiedId=0;let internalCase=0,partnerCase=0;
 const caller=(role:'owner'|'admin'|'user'|'partner'|'customer',id=1)=>appRouter.createCaller({user:{id,openId:`TEST-OWNER-CHANGE-${id}`,name:'最高管理者検証',email:'test-owner-change@example.invalid',role,areaAccessMode:'all',allowedPrefectures:null,createdAt:new Date(),updatedAt:new Date(),lastSignedIn:new Date(),loginMethod:'test'} as NonNullable<TrpcContext['user']>,req:{headers:{}} as any,res:{} as any});
 const owner=()=>caller('owner');
 const input=(role:'user'|'partner',expectedRole:'user'|'partner'='user',expectedPartnerIds:number[]=[])=>({userId:staffId,expectedRole,role,partnerId:role==='partner'?companyId:null,expectedPartnerIds,staffAreaAccessMode:'selected' as const,staffAllowedPrefectures:['福岡県' as const],reason:'所属変更の確認'});
 beforeAll(async()=>{
  db=(await getDb())!;const stamp=Date.now();
  async function add(role:'user'|'partner'|'owner'|'customer',suffix:string){const [u]=await db.insert(users).values({openId:`TEST-OWNER-CHANGE-${stamp}-${suffix}`,name:`TEST-OWNER-CHANGE-${suffix}`,email:`test-owner-${suffix}-${stamp}@example.invalid`,role,areaAccessMode:'all'}).$returningId();return u.id;}
  staffId=await add('user','staff');otherId=await add('partner','other');lockedId=await add('owner','locked');customerId=await add('customer','customer');
  const [p]=await db.insert(partners).values({name:`TEST-OWNER-CHANGE-${stamp}-company`,category:'その他',isActive:true}).$returningId();companyId=p.id;
  const [q]=await db.insert(partners).values({name:`TEST-OWNER-CHANGE-${stamp}-occupied`,category:'その他',isActive:true,userId:otherId}).$returningId();occupiedId=q.id;
  const [c]=await db.insert(cases).values({requestNumber:`TEST-OWNER-CHANGE-${stamp}-internal`,storeName:'TEST-OWNER-CHANGE-社内担当',prefecture:'福岡県',assigneeId:staffId,status:'施工待ち',progressStage:'承認済',contractorName:'既存会社',contractorPic:'旧担当者',contractorPhone:'0000000000',estimatedCost:12345,constructionDate:new Date('2026-11-05T00:00:00Z'),notes:'社内メモ',responsibleOfficer:'miyoshi'}).$returningId();internalCase=c.id;
  const [d]=await db.insert(cases).values({requestNumber:`TEST-OWNER-CHANGE-${stamp}-external`,storeName:'TEST-OWNER-CHANGE-会社担当',prefecture:'東京都',partnerId:companyId,estimatedCost:77777,status:'施工中'}).$returningId();partnerCase=d.id;
 },30000);
 afterAll(async()=>{
  if(!db)return;for(const id of [internalCase,partnerCase])if(id)await deleteCase(id);
  const uids=[staffId,otherId,lockedId,customerId].filter(Boolean);const pids=[companyId,occupiedId].filter(Boolean);
  if(uids.length)await db.delete(ownerManagementLogs).where(and(eq(ownerManagementLogs.kind,'user_category'),inArray(ownerManagementLogs.targetId,uids)));
  if(internalCase)await db.delete(ownerManagementLogs).where(and(eq(ownerManagementLogs.kind,'case_assignment'),eq(ownerManagementLogs.targetId,internalCase)));
  if(pids.length)await db.delete(partners).where(inArray(partners.id,pids));if(uids.length)await db.delete(users).where(inArray(users.id,uids));
 },30000);
 it('admin／社員／外部と未認証は区分API・履歴を使用できない',async()=>{
  for(const role of ['admin','user','partner','customer'] as const){await expect(caller(role).ownerPeople.list()).rejects.toMatchObject({code:'FORBIDDEN'});await expect(caller(role).ownerPeople.changeCategory(input('partner'))).rejects.toMatchObject({code:'FORBIDDEN'});await expect(caller(role).ownerPeople.history({kind:'user_category',targetId:staffId})).rejects.toMatchObject({code:'FORBIDDEN'});}
  await expect(appRouter.createCaller({user:null,req:{} as any,res:{} as any}).ownerPeople.list()).rejects.toMatchObject({code:'UNAUTHORIZED'});
 });
 it('最高管理者・自己・顧客の区分変更とowner付与を拒否',async()=>{
  await expect(owner().ownerPeople.changeCategory({...input('partner'),userId:lockedId,expectedRole:'owner'})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(owner().ownerPeople.changeCategory({...input('partner'),userId:1,expectedRole:'owner'})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(owner().ownerPeople.changeCategory({...input('partner'),userId:customerId,expectedRole:'customer'})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(owner().users.updateAccess({id:staffId,role:'owner',areaAccessMode:'all',allowedPrefectures:[]})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('既存APIのadminによる役割変更・owner区分直接変更・業者紐付けの抜け道を拒否',async()=>{
  await expect(caller('admin').users.updateAccess({id:staffId,role:'partner',areaAccessMode:'all',allowedPrefectures:[]})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(owner().users.updateAccess({id:staffId,role:'partner',areaAccessMode:'all',allowedPrefectures:[]})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(caller('user').partners.update({id:companyId,data:{userId:staffId}})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('他人の業者リンク奪取・不明会社・古い役割・古いリンク・短い理由は全件停止',async()=>{
  await expect(owner().ownerPeople.changeCategory({...input('partner'),partnerId:occupiedId})).rejects.toMatchObject({code:'CONFLICT'});
  await expect(owner().ownerPeople.changeCategory({...input('partner'),partnerId:99999999})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(owner().ownerPeople.changeCategory({...input('partner'),expectedRole:'partner'})).rejects.toMatchObject({code:'CONFLICT'});
  await expect(owner().ownerPeople.changeCategory({...input('partner'),expectedPartnerIds:[occupiedId]})).rejects.toMatchObject({code:'CONFLICT'});
  await expect(owner().ownerPeople.changeCategory({...input('partner'),reason:'a'})).rejects.toMatchObject({code:'BAD_REQUEST'});
  const [u]=await db.select().from(users).where(eq(users.id,staffId));expect(u.role).toBe('user');
 });
 it('社内→協力業者は担当会社リンクのみ・編集は自社・金額非公開、旧社内担当の案件／状態／日付は完全不変',async()=>{
  const [before]=await db.select().from(cases).where(eq(cases.id,internalCase));
  expect(await owner().ownerPeople.changeCategory(input('partner'))).toMatchObject({success:true,changed:true});
  const [u]=await db.select().from(users).where(eq(users.id,staffId));expect(u).toMatchObject({role:'partner',areaAccessMode:'all',allowedPrefectures:'[]'});
  const [p]=await db.select().from(partners).where(eq(partners.id,companyId));expect(p.userId).toBe(staffId);
  const [after]=await db.select().from(cases).where(eq(cases.id,internalCase));expect(after).toEqual(before);
  const legacy=(await owner().internalStaff.summary()).rows.find(r=>r.userIds.includes(staffId));
  expect(legacy).toMatchObject({legacy:true,canAssign:false,total:1,active:1});
  expect((await owner().internalStaff.assignments({staffKey:legacy!.key,scope:'all'})).map(c=>c.id)).toContain(internalCase);
  const partner=caller('partner',staffId);expect((await partner.cases.get({id:internalCase}))?.estimatedCost).toBeNull();
  await expect(partner.cases.update({id:internalCase,data:{status:'完了'}})).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await partner.cases.partnerEditableCaseIds()).toContain(partnerCase);
  expect(await partner.cases.partnerEditableCaseIds()).not.toContain(internalCase);
  const history=await owner().ownerPeople.history({kind:'user_category',targetId:staffId});expect(history).toHaveLength(1);expect(JSON.parse(history[0].afterJson).role).toBe('partner');expect(history[0].changedBy).toBe(1);
 });
 it('変更後のpartnerを新しい社内担当には設定できない',async()=>{
  await expect(owner().cases.update({id:partnerCase,data:{assigneeId:staffId}})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(owner().cases.update({id:internalCase,data:{assigneeId:staffId}})).resolves.toMatchObject({success:true});
 });
 it('協力業者→社員はエリア指定・金額非公開、旧業者リンク解除・案件は非移管',async()=>{
  const [before]=await db.select().from(cases).where(eq(cases.id,partnerCase));
  await expect(owner().ownerPeople.changeCategory({...input('user','partner',[companyId]),staffAllowedPrefectures:[]})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await owner().ownerPeople.changeCategory(input('user','partner',[companyId]));
  const [u]=await db.select().from(users).where(eq(users.id,staffId));expect(u).toMatchObject({role:'user',areaAccessMode:'selected',allowedPrefectures:'["福岡県"]'});
  const [p]=await db.select().from(partners).where(eq(partners.id,companyId));expect(p.userId).toBeNull();
  const [after]=await db.select().from(cases).where(eq(cases.id,partnerCase));expect(after).toEqual(before);expect(after.assigneeId).toBeNull();
  expect(await owner().ownerPeople.history({kind:'user_category',targetId:staffId})).toHaveLength(2);
 });
 it('同内容の再送は監査重複なし・一覧に現担当件数と氏名／IDを返し秘密の値を含めない',async()=>{
  expect((await owner().ownerPeople.changeCategory(input('user','user',[]))).changed).toBe(false);
  const list=await owner().ownerPeople.list();const target=list.users.find(u=>u.id===staffId)!;expect(target.activeInternalCases).toBe(1);expect(target.totalInternalCases).toBe(1);expect(target.partnerLinks).toEqual([]);expect(target).not.toHaveProperty('openId');expect(target).not.toHaveProperty('lastSignedIn');
 });
 it('案件担当訂正はowner限定・入力確認値競合時停止・担当と会社名／連絡先だけ更新して全件監査',async()=>{
  const [row]=await db.select().from(cases).where(eq(cases.id,internalCase));const expected=caseAssignmentSnapshot(row);const next={...expected,assigneeId:null,partnerId:companyId,contractorName:'訂正会社',contractorPic:'新担当者',contractorPhone:'1111111111'};
  await expect(caller('admin').ownerPeople.changeCaseAssignment({caseId:internalCase,expected,next,reason:'担当者の変更'})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(owner().ownerPeople.changeCaseAssignment({caseId:internalCase,expected:{...expected,contractorPic:'古い別名'},next,reason:'担当者の変更'})).rejects.toMatchObject({code:'CONFLICT'});
  await owner().ownerPeople.changeCaseAssignment({caseId:internalCase,expected,next,reason:'担当者の変更'});
  const [after]=await db.select().from(cases).where(eq(cases.id,internalCase));expect(caseAssignmentSnapshot(after)).toEqual(next);
  for(const key of ['status','progressStage','responsibleOfficer','constructionDate','estimatedCost','notes','requestNumber','createdAt'] as const)expect(after[key]).toEqual(row[key]);
  expect(await owner().ownerPeople.history({kind:'case_assignment',targetId:internalCase})).toHaveLength(1);
  await expect(owner().ownerPeople.changeCaseAssignment({caseId:internalCase,expected,next,reason:'同時更新後'})).rejects.toMatchObject({code:'CONFLICT'});
 });
});
describe('最高管理者画面契約',()=>{
 it('本人限定・固定確認payload・待機・旧キャッシュ破棄・案件訂正を配置',()=>{
  const page=fs.readFileSync('client/src/pages/OwnerPeople.tsx','utf8'),editor=fs.readFileSync('client/src/components/OwnerCaseAssignmentEditor.tsx','utf8'),auth=fs.readFileSync('client/src/components/PermissionRefreshBoundary.tsx','utf8');
  for(const text of ['confirmedPayload','最高管理者専用','変更を確定する','案件の自動移管はありません','expectedPartnerIds'])expect(page).toContain(text);
  for(const text of ['approved','担当情報を変更（最高管理者）','owner-contact','確認して変更'])expect(editor).toContain(text);
  for(const text of ['refetchInterval:30000','cache.cancelQueries','cache.clear','window.location.reload'])expect(auth).toContain(text);
 });
});
