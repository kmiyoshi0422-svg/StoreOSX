import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { appRouter } from './routers';
import { getDb, deleteCase } from './db';
import { users, partners, cases, caseDeadlineLogs } from '../drizzle/schema';
import type { TrpcContext } from './_core/context';
function caller(id: number, role: NonNullable<TrpcContext['user']>['role'], area?: string[]) {
  const now = new Date(); return appRouter.createCaller({ user: { id, role, name: '完了期限検証者', openId: `deadline-${id}`, email: `${id}@example.test`, loginMethod: 'manus', areaAccessMode: area ? 'selected' : 'all', allowedPrefectures: area ? JSON.stringify(area) : null, createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: 'https', headers: {} } as TrpcContext['req'], res: {} as TrpcContext['res'] });
}
describe('完了期限・自社担当限定・監査 実DB', () => {
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>; const ids: number[] = [], uids: number[] = [], pids: number[] = [];
  beforeAll(async () => {
    db = (await getDb())!; const suffix = Date.now().toString();
    for (let i=0;i<2;i++) { const [u]=await db.insert(users).values({ openId:`deadline-test-${suffix}-${i}`, name:'完了期限テスト', role:'partner', email:`deadline-${suffix}-${i}@example.test` }).$returningId(); uids.push(u.id); const [p]=await db.insert(partners).values({ name:`TEST-DEADLINE-PARTNER-${suffix}-${i}`, userId:u.id }).$returningId(); pids.push(p.id); }
    for (let i=0;i<2;i++) { const [row]=await db.insert(cases).values({ requestNumber:`TEST-DEADLINE-${suffix}-${i}`, storeName:'完了期限検証店', prefecture:'山口県', partnerId:pids[i], assigneeId:1, requestContent:'修理 見積100万円', notes:'秘密', surveyDate:new Date('2026-10-01T12:00:00+09:00'), constructionDate:new Date('2026-10-12T12:00:00+09:00') }).$returningId(); ids.push(row.id); }
  }, 30000);
  afterAll(async () => { for(const id of ids) await deleteCase(id); if(pids.length)await db.delete(partners).where(inArray(partners.id,pids)); if(uids.length)await db.delete(users).where(inArray(users.id,uids)); }, 30000);
  it('社員が独立期限を設定し全既存日付・担当・状態を変えず監査、訂正と理由付き解除', async () => {
    const who=caller(1,'user',['山口県']); const [before]=await db.select().from(cases).where(eq(cases.id,ids[0]));
    expect(await who.deadline.set({caseId:ids[0],deadline:'2026-10-14',expectedDeadline:null,reason:'担当業者と納期確認'})).toMatchObject({changed:true});
    const [after]=await db.select().from(cases).where(eq(cases.id,ids[0])); const {completionDeadline:b,updatedAt:bu,...beforeRest}=before; const {completionDeadline:a,updatedAt:au,...afterRest}=after; expect(afterRest).toEqual(beforeRest); expect(a).toBe('2026-10-14');
    expect((await who.deadline.history({caseId:ids[0]}))[0]).toMatchObject({beforeDeadline:null,afterDeadline:'2026-10-14',changedBy:1,reason:'担当業者と納期確認'});
    expect((await who.deadline.set({caseId:ids[0],deadline:'2026-10-14',expectedDeadline:'2026-10-14',reason:'同じ日を再確認'})).changed).toBe(false);
    await who.deadline.set({caseId:ids[0],deadline:'2026-10-15',expectedDeadline:'2026-10-14',reason:'先方と納期を再調整'});
    await who.deadline.set({caseId:ids[0],deadline:null,expectedDeadline:'2026-10-15',reason:'納期の再確認で解除'});
    expect(await who.deadline.history({caseId:ids[0]})).toHaveLength(3); expect((await who.deadline.get({caseId:ids[0]})).deadline).toBeNull();
  });
  it('期限不正・短い理由・古い期限での競合・許可エリア外を拒否', async () => {
    const who=caller(1,'user',['山口県']);
    await expect(who.deadline.set({caseId:ids[0],deadline:'2026-02-30',expectedDeadline:null,reason:'不正な日付確認'})).rejects.toMatchObject({code:'BAD_REQUEST'});
    await expect(who.deadline.set({caseId:ids[0],deadline:'2026-10-14',expectedDeadline:null,reason:' '})).rejects.toMatchObject({code:'BAD_REQUEST'});
    await expect(caller(1,'user',['東京都']).deadline.set({caseId:ids[0],deadline:'2026-10-14',expectedDeadline:null,reason:'他エリア期限確認'})).rejects.toMatchObject({code:'FORBIDDEN'});
    await who.deadline.set({caseId:ids[0],deadline:'2026-10-14',expectedDeadline:null,reason:'担当業者の納期確認'});
    await expect(who.deadline.set({caseId:ids[0],deadline:'2026-10-15',expectedDeadline:null,reason:'古い画面から変更'})).rejects.toMatchObject({code:'CONFLICT'});
    expect((await who.deadline.get({caseId:ids[0]})).deadline).toBe('2026-10-14');
  });
  it('業者は自社担当期限だけ読めて更新・履歴・他社期限を拒否、顧客も拒否', async () => {
    const own=caller(uids[0],'partner'); expect(await own.deadline.get({caseId:ids[0]})).toEqual({caseId:ids[0],deadline:'2026-10-14',status:'受付'});
    await expect(own.deadline.get({caseId:ids[1]})).rejects.toMatchObject({code:'FORBIDDEN'});
    for(const who of [own,caller(uids[1],'partner'),caller(887799,'customer')]) {
      await expect(who.deadline.set({caseId:ids[0],deadline:null,expectedDeadline:'2026-10-14',reason:'無許可解除のテスト'})).rejects.toMatchObject({code:'FORBIDDEN'});
      await expect(who.deadline.history({caseId:ids[0]})).rejects.toMatchObject({code:'FORBIDDEN'});
    }
    await expect(caller(887799,'customer').deadline.get({caseId:ids[0]})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('一般更新からの期限変更を拒否、外部の全案件APIに期限を公開しない', async () => {
    await expect(caller(1,'owner').cases.update({id:ids[0],data:{completionDeadline:'2026-10-20'}})).rejects.toMatchObject({code:'FORBIDDEN'});
    expect((await caller(uids[1],'partner').cases.get({id:ids[0]}))?.completionDeadline).toBeNull();
    expect((await caller(1,'owner').cases.get({id:ids[0]}))?.completionDeadline).toBe('2026-10-14');
  });
  it('本人担当DTOは自社案件と独立期限だけ、社内金額・自由記述・履歴を返さない', async () => {
    const result=await caller(uids[0],'partner').responsibility.personal(); expect(result.rows.map(row=>row.id)).toEqual([ids[0]]); expect(result.rows[0].completionDeadline).toBe('2026-10-14'); expect(result.rows[0].requestContent).toBe('金額に関する記述を含むため非表示'); for(const key of ['notes','estimatedCost','plenusQuoteAmount','reason','changedBy','partnerId'])expect(result.rows[0]).not.toHaveProperty(key);
  });
});
