import { describe,it,expect } from 'vitest';
import { buildInternalStaffGroups,countStaffAssignments,type StaffGroup } from '../shared/internalStaffSummary';
import { appRouter } from './routers';
import { getDb } from './db';
import { cases } from '../drizzle/schema';
import type { TrpcContext } from './_core/context';
const staff=(id:number,name:string,email:string|null,role='user')=>({id,name,email,role,areaAccessMode:'all' as const,allowedPrefectures:null});
const group:StaffGroup={key:'officer:miyoshi',name:'三好 慶',userIds:[1,2,1],canAssign:true,pending:false,legacy:false};
describe('社内担当件数集計',()=>{
 it('確認済み本人だけアカウント合算、木原未登録は0、名前一致で統合しない',()=>{
  const result=buildInternalStaffGroups([staff(1,'三好','a@example.test'),staff(2,'別名','b@example.test'),staff(3,'三好','other@example.test'),staff(4,'社外','c@example.test','partner')],{'a@example.test':'miyoshi','b@example.test':'miyoshi'},[]);
  expect(result.find(x=>x.key==='officer:miyoshi')?.userIds).toEqual([1,2]);expect(result.find(x=>x.key==='user:3')).toBeDefined();expect(result.some(x=>x.userIds.includes(4))).toBe(false);expect(result.find(x=>x.key==='officer:kihara')).toMatchObject({pending:true,userIds:[]});
 });
 it('対応中は完了／クローズ／失注以外、同案件IDと同ユーザーIDを二重計上しない',()=>{
  const result=countStaffAssignments([group],[{id:1,assigneeId:1,status:'受付'},{id:2,assigneeId:2,status:'現調中'},{id:3,assigneeId:1,status:'完了'},{id:4,assigneeId:2,status:'クローズ'},{id:5,assigneeId:2,status:'失注'},{id:5,assigneeId:2,status:'失注'},{id:6,assigneeId:null,status:'受付'}]);
  expect(result[0]).toMatchObject({active:2,total:5,completed:2,lost:1});
 });
 it('藤原は新規候補外の別枠、過去担当がある時だけ表示し件数保全',()=>{
  const people=buildInternalStaffGroups([staff(253050001,'藤原健二','f@example.test')],{},[]);
  expect(countStaffAssignments(people,[]).some(x=>x.legacy)).toBe(false);
  expect(countStaffAssignments(people,[{id:1,assigneeId:253050001,status:'受付'}]).find(x=>x.legacy)).toMatchObject({name:'藤原健二',active:1,total:1,canAssign:false});
 });
 it('木原登録後は未登録表示が消えて実IDになり責任者だけの案件を作業担当に含めない',()=>{
  const groups=buildInternalStaffGroups([staff(55,'k',' K@example.test ')],{'k@example.test':'kihara'},[]);
  expect(groups[0]).toMatchObject({key:'officer:kihara',pending:false,userIds:[55]});
  expect(countStaffAssignments(groups,[{id:9,assigneeId:null,status:'受付'}])[0].total).toBe(0);
 });
});
function context(role:NonNullable<TrpcContext['user']>['role'],limited=false):TrpcContext {const now=new Date();return {user:{id:1,openId:'staff-count-test',name:'社内件数検証',email:null,role,loginMethod:'manus',areaAccessMode:limited?'selected':'all',allowedPrefectures:limited?'["山口県"]':null,createdAt:now,updatedAt:now,lastSignedIn:now},req:{protocol:'https',headers:{}} as any,res:{} as any};}
describe('社内担当一覧API 読み取り実DB',()=>{
 it('社内だけ閲覧、限定エリア件数を対象案件と照合、機密列を返さない',async()=>{
  for(const role of ['partner','customer'] as const){const caller=appRouter.createCaller(context(role));await expect(caller.internalStaff.summary()).rejects.toMatchObject({code:'FORBIDDEN'});await expect(caller.internalStaff.assignments({staffKey:'officer:miyoshi'})).rejects.toMatchObject({code:'FORBIDDEN'});}
  const caller=appRouter.createCaller(context('user',true));const summary=await caller.internalStaff.summary();const db=(await getDb())!;const raw=await db.select({id:cases.id,assigneeId:cases.assigneeId,status:cases.status,prefecture:cases.prefecture}).from(cases);expect(summary.areaLimited).toBe(true);
  for(const person of summary.rows){const expected=raw.filter(x=>x.prefecture==='山口県'&&x.assigneeId!==null&&person.userIds.includes(x.assigneeId));expect(person.total).toBe(expected.length);expect(person.active).toBe(expected.filter(x=>!['完了','クローズ','失注'].includes(x.status)).length);expect(person).not.toHaveProperty('email');}
  const target=summary.rows.find(x=>x.total>0);if(target){const rows=await caller.internalStaff.assignments({staffKey:target.key,scope:'all'});expect(rows).toHaveLength(target.total);expect(rows.every(x=>x.prefecture==='山口県')).toBe(true);for(const row of rows){expect(Object.keys(row).sort()).toEqual(['assigneeId','id','prefecture','progressStage','requestNumber','status','storeName','urgency'].sort());}}
 },30000);
});
