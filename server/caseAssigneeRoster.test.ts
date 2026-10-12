import { describe, it, expect } from 'vitest';
import { buildCaseAssigneeRoster, EXCLUDED_CASE_ASSIGNEE_IDS, PENDING_KIHARA_ID, type RosterUser } from '../shared/caseAssigneeRoster';
import { appRouter } from './routers';
import { getDb, deleteCase } from './db';
import { cases } from '../drizzle/schema';
import type { TrpcContext } from './_core/context';
import { eq } from 'drizzle-orm';
const user=(id:number,name:string,email:string|null,role='user'):RosterUser=>({id,name,email,role,areaAccessMode:'all',allowedPrefectures:null});
const bindings={'confirmed@example.test':'kihara'};
describe('社内担当者候補',()=>{
 it('木原未ログイン時は割当不可の表示候補だけ追加、藤原IDだけ除外',()=>{
  const result=buildCaseAssigneeRoster([user(EXCLUDED_CASE_ASSIGNEE_IDS[0],'藤原健二','f@example.test'),user(88,'別の藤原','other@example.test')],bindings);
  expect(result.map(x=>x.id)).toEqual([88,PENDING_KIHARA_ID]);expect(result[1]).toMatchObject({name:'木原 新（初回ログイン待ち）',canAssign:false,email:null});
 });
 it('確認済み木原メールの実IDで表示し、仮候補を消す（名前で推測しない）',()=>{
  const result=buildCaseAssigneeRoster([user(77,'別表示名',' CONFIRMED@example.test '),user(78,'木原新','unknown@example.test')],bindings);
  expect(result.find(x=>x.id===77)).toMatchObject({name:'木原 新',canAssign:true});expect(result.some(x=>x.id===PENDING_KIHARA_ID)).toBe(false);expect(result.find(x=>x.id===78)?.name).toBe('木原新');
 });
 it('登録後も社外ロールを昇格せず割当候補へ混ぜない',()=>{
  expect(buildCaseAssigneeRoster([user(77,'木原','confirmed@example.test','partner')],bindings)).toEqual([expect.objectContaining({id:PENDING_KIHARA_ID,canAssign:false})]);
 });
 it('元ユーザーオブジェクトの名前・権限を変更しない',()=>{
  const original=user(77,'別表示名','confirmed@example.test');buildCaseAssigneeRoster([original],bindings);expect(original.name).toBe('別表示名');expect(original.role).toBe('user');
 });
});
function context(role:NonNullable<TrpcContext['user']>['role']):TrpcContext {const now=new Date();return {user:{id:1,openId:'roster-test',name:'候補検証',email:'roster@example.test',role,loginMethod:'manus',areaAccessMode:'all',allowedPrefectures:null,createdAt:now,updatedAt:now,lastSignedIn:now},req:{protocol:'https',headers:{}} as any,res:{} as any};}
describe('候補変更API 実DB',()=>{
 it('候補に木原を含め藤原を除外し、外部拒否・仮ID／新規藤原割当を拒否、既存藤原を強制変更しない',async()=>{
  const who=appRouter.createCaller(context('owner'));const roster=await who.users.assignable();expect(roster.some(x=>x.name?.includes('木原'))).toBe(true);expect(roster.some(x=>EXCLUDED_CASE_ASSIGNEE_IDS.includes(x.id))).toBe(false);
  await expect(appRouter.createCaller(context('partner')).users.assignable()).rejects.toMatchObject({code:'FORBIDDEN'});
  const db=(await getDb())!;const [row]=await db.insert(cases).values({requestNumber:`TEST-ROSTER-${Date.now()}`,storeName:'担当候補テスト店',prefecture:'山口県'}).$returningId();
  try {
   await expect(who.cases.update({id:row.id,data:{assigneeId:EXCLUDED_CASE_ASSIGNEE_IDS[0]}})).rejects.toMatchObject({code:'BAD_REQUEST'});
   await expect(who.cases.update({id:row.id,data:{assigneeId:PENDING_KIHARA_ID}})).rejects.toMatchObject({code:'BAD_REQUEST'});
   const [after]=await db.select().from(cases).where(eq(cases.id,row.id));expect(after.assigneeId).toBeNull();
   await db.update(cases).set({assigneeId:EXCLUDED_CASE_ASSIGNEE_IDS[0]}).where(eq(cases.id,row.id));
   await expect(who.cases.update({id:row.id,data:{assigneeId:EXCLUDED_CASE_ASSIGNEE_IDS[0]}})).resolves.toMatchObject({success:true});
   expect((await who.cases.get({id:row.id}))?.assigneeId).toBe(EXCLUDED_CASE_ASSIGNEE_IDS[0]);
  }finally{await deleteCase(row.id);}
 },30000);
});
