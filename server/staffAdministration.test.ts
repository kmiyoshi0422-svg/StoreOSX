import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, like, or } from 'drizzle-orm';
import { appRouter } from './routers';
import { getDb, deleteCase, getUserByOpenId, upsertUser } from './db';
import { cases, ownerManagementLogs, staffRegistrations, users } from '../drizzle/schema';
import { sdk } from './_core/sdk';
import { COOKIE_NAME } from '../shared/const';
import type { TrpcContext } from './_core/context';
import { buildCaseAssigneeRoster } from '../shared/caseAssigneeRoster';
import { buildInternalStaffGroups, countStaffAssignments } from '../shared/internalStaffSummary';

const tag = `TEST-LIFECYCLE-${Date.now()}`;
const email = (suffix: string) => `${tag.toLowerCase()}-${suffix}@invalid.example`;
const reason = '在籍・退職管理の合成検証';
let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
let staff = 0, cid = 0;
const regIds: number[] = [];
function caller(role: 'owner'|'admin'|'user'|'executive'|'partner'|'customer' = 'owner', id = 1, disabledAt: Date|null = null) {
  return appRouter.createCaller({ user: { id, openId: tag, name: '合成操作者', email: null, loginMethod: 'test', role, disabledAt, areaAccessMode: 'all', allowedPrefectures: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as any, res: {} as any } as TrpcContext);
}
const getStaff = async () => (await db.select().from(users).where(eq(users.id, staff)))[0];
const registration = async (id: number) => (await db.select().from(staffRegistrations).where(eq(staffRegistrations.id, id)))[0];
async function register(suffix: string, role: 'user'|'admin'|'executive' = 'user') {
  const result = await caller().staffAdministration.register({ name: `${tag} 新規${suffix}`, email: email(suffix), role, areaAccessMode: 'all', allowedPrefectures: [], reason });
  regIds.push(result.registrationId); return result.registrationId;
}
describe('最高管理者の社員追加・退職管理', () => {
  beforeAll(async () => {
    db = (await getDb())!;
    staff = (await db.insert(users).values({ openId: tag+'-existing', name: tag+'既存社員', email: email('existing'), role: 'user' }).$returningId())[0].id;
    cid = (await db.insert(cases).values({ requestNumber: tag+'-case', storeName: tag+'店舗', prefecture: '福岡県', assigneeId: staff, status: '施工中', estimatedCost: 12345 }).$returningId())[0].id;
  }, 30000);
  afterAll(async () => {
    if (cid) await deleteCase(cid);
    if (!db) return;
    const ids = (await db.select({id: users.id}).from(users).where(like(users.openId, tag+'%'))).map(row => row.id);
    if (regIds.length) await db.delete(ownerManagementLogs).where(and(eq(ownerManagementLogs.kind, 'staff_registration'), inArray(ownerManagementLogs.targetId, regIds)));
    if (ids.length) await db.delete(ownerManagementLogs).where(and(inArray(ownerManagementLogs.kind, ['user_lifecycle', 'user_category', 'user_profile']), inArray(ownerManagementLogs.targetId, ids)));
    if (regIds.length) await db.delete(staffRegistrations).where(inArray(staffRegistrations.id, regIds));
    if (ids.length) await db.delete(users).where(inArray(users.id, ids));
  }, 30000);
  it('最高管理者以外と未認証に一覧・追加・停止を許可しない', async () => {
    for (const role of ['admin','user','executive','partner','customer'] as const) {
      await expect(caller(role).staffAdministration.list()).rejects.toMatchObject({code:'FORBIDDEN'});
      await expect(caller(role).staffAdministration.register({name:tag,email:email(role),role:'user',areaAccessMode:'all',allowedPrefectures:[],reason})).rejects.toMatchObject({code:'FORBIDDEN'});
      await expect(caller(role).staffAdministration.setUserState({userId:staff,expectedRole:'user',expectedDisabledAt:null,disabled:true,reason})).rejects.toMatchObject({code:'FORBIDDEN'});
      await expect(caller(role).staffAdministration.setRegistrationState({registrationId:1,expectedVersion:1,active:false,reason})).rejects.toMatchObject({code:'FORBIDDEN'});
    }
    await expect(appRouter.createCaller({user:null,req:{} as any,res:{} as any}).staffAdministration.list()).rejects.toMatchObject({code:'UNAUTHORIZED'});
  });
  it('新規社員はメールで事前登録し、架空OAuthユーザーは作成しない', async () => {
    const id = await register('pending'); const row = await registration(id);
    expect(row).toMatchObject({state:'pending',userId:null,role:'user',version:1});
    expect(await db.select().from(users).where(eq(users.email,email('pending')))).toHaveLength(0);
    expect(await caller().staffAdministration.history({kind:'staff_registration',targetId:id})).toHaveLength(1);
    await expect(caller().staffAdministration.register({name:tag,email:email('pending').toUpperCase(),role:'user',areaAccessMode:'all',allowedPrefectures:[],reason})).rejects.toMatchObject({code:'CONFLICT'});
  });
  it('既存メール・不正区分・無効メール・空エリア・理由不足を拒否する', async () => {
    const values={name:tag,email:email('existing'),role:'user' as const,areaAccessMode:'all' as const,allowedPrefectures:[],reason};
    await expect(caller().staffAdministration.register(values)).rejects.toMatchObject({code:'CONFLICT'});
    for(const patch of [{email:'bad'},{role:'owner'},{areaAccessMode:'selected'},{name:'   '},{reason:'a'}]) await expect(caller().staffAdministration.register({...values,email:email('invalid'),...patch} as any)).rejects.toMatchObject({code:'BAD_REQUEST'});
  });
  it('初回待ちを取消・再開でき、取消中のOAuth同期はユーザーごと原子的に拒否する', async () => {
    const id=await register('cancel');
    await caller().staffAdministration.setRegistrationState({registrationId:id,expectedVersion:1,active:false,reason});
    expect((await registration(id)).state).toBe('canceled');
    const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
    try { await expect(upsertUser({openId:tag+'-cancel',name:'OAuth名',email:email('cancel')})).rejects.toThrow('取り消'); } finally {errors.mockRestore();}
    expect(await getUserByOpenId(tag+'-cancel')).toBeUndefined();
    await expect(caller().staffAdministration.setRegistrationState({registrationId:id,expectedVersion:1,active:true,reason})).rejects.toMatchObject({code:'CONFLICT'});
    await caller().staffAdministration.setRegistrationState({registrationId:id,expectedVersion:2,active:true,reason});
    expect((await registration(id))).toMatchObject({state:'pending',version:3});
  });
  it.each(['user','admin','executive'] as const)('初回本人ログインで%sを付与し、後日の区分・名前を再ログインで巻き戻さない', async role => {
      const id=await register('claim-'+role,role);
      const openId=tag+'-'+role;
      await upsertUser({openId,name:'OAuth本人名',email:email('claim-'+role).toUpperCase(),loginMethod:'test'});
      let person=(await getUserByOpenId(openId))!;
      expect(person.role).toBe(role);expect(person.name).toContain('新規claim');expect(person.nameOverride).toBe(person.name);
      expect(await registration(id)).toMatchObject({state:'active',userId:person.id,version:2});
      await db.update(users).set({name:'後日の登録名',nameOverride:'後日の登録名',role:'user'}).where(eq(users.id,person.id));
      await upsertUser({openId,name:'古いOAuth名',email:email('claim-'+role)});
      person=(await getUserByOpenId(openId))!;expect(person.name).toBe('後日の登録名');expect(person.role).toBe('user');
      expect(await caller().staffAdministration.history({kind:'staff_registration',targetId:id})).toHaveLength(2);
      await expect(caller().staffAdministration.setRegistrationState({registrationId:id,expectedVersion:2,active:false,reason})).rejects.toMatchObject({code:'CONFLICT'});
  });
  it('別OAuth IDが同じ本人メールを使っても別アカウントを作らず権限を移さない', async () => {
    const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
    try {await expect(upsertUser({openId:tag+'-imposter',email:email('claim-admin'),name:'別人'})).rejects.toThrow('別アカウント');}finally{errors.mockRestore();}
    expect(await getUserByOpenId(tag+'-imposter')).toBeUndefined();
  });
  it('最高管理者自身・他owner・社外アカウントは停止対象にできない', async () => {
    await expect(caller().staffAdministration.setUserState({userId:1,expectedRole:'owner',expectedDisabledAt:null,disabled:true,reason})).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(caller('owner',staff).staffAdministration.setUserState({userId:staff,expectedRole:'user',expectedDisabledAt:null,disabled:true,reason})).rejects.toMatchObject({code:'FORBIDDEN'});
    const external=(await db.insert(users).values({openId:tag+'-partner',name:tag,role:'partner'}).$returningId())[0].id;
    await expect(caller().staffAdministration.setUserState({userId:external,expectedRole:'partner',expectedDisabledAt:null,disabled:true,reason})).rejects.toMatchObject({code:'BAD_REQUEST'});
  });
  it('退職しても担当案件全列は不変、候補から除外し引継ぎ枠と監査に残す', async () => {
    const [before]=await db.select().from(cases).where(eq(cases.id,cid));
    await caller().staffAdministration.setUserState({userId:staff,expectedRole:'user',expectedDisabledAt:null,disabled:true,reason});
    const person=await getStaff();expect(person.disabledAt).toBeTruthy();expect(person.role).toBe('user');
    expect((await db.select().from(cases).where(eq(cases.id,cid)))[0]).toEqual(before);
    expect(buildCaseAssigneeRoster([person],{}).some(x=>x.id===staff)).toBe(false);
    const counted=countStaffAssignments(buildInternalStaffGroups([person],{},[],true),[before]);
    expect(counted.find(x=>x.userIds.includes(staff))).toMatchObject({legacy:true,canAssign:false,total:1,active:1});
    expect((await caller().staffAdministration.list()).users.find(x=>x.id===staff)).toMatchObject({totalCases:1,activeCases:1});
    expect(await caller().staffAdministration.history({kind:'user_lifecycle',targetId:staff})).toHaveLength(1);
    await expect(caller().cases.update({id:cid,data:{assigneeId:staff}})).resolves.toBeTruthy();
    const spare=(await db.insert(cases).values({requestNumber:tag+'-spare',storeName:tag,prefecture:'福岡県'}).$returningId())[0].id;
    try {await expect(caller().cases.update({id:spare,data:{assigneeId:staff}})).rejects.toMatchObject({code:'BAD_REQUEST'});}finally{await deleteCase(spare);}
  });
  it('新規案件・一括登録・ルートから退職者への新規割当を迂回できない', async () => {
    const requestNumber=tag+'-blocked-create';
    const input={requestNumber,storeName:tag,prefecture:'福岡県',assigneeId:staff};
    try {
      await expect(caller().cases.create(input)).rejects.toMatchObject({code:'BAD_REQUEST'});
      expect(await caller().cases.bulkImport({rows:[input]})).toMatchObject({inserted:0,failed:1});
      await expect(caller().routes.upsert({caseId:cid,team:'A',taskType:'survey',scheduledDate:'2026-11-03',assigneeId:staff})).rejects.toMatchObject({code:'BAD_REQUEST'});
      expect(await db.select({id:cases.id}).from(cases).where(eq(cases.requestNumber,requestNumber))).toHaveLength(0);
    } finally {
      for(const row of await db.select({id:cases.id}).from(cases).where(eq(cases.requestNumber,requestNumber))) await deleteCase(row.id);
    }
  });
  it('退職者の既存JWT・通常API・管理API・金額APIを拒否する', async () => {
    const person=await getStaff();
    const token=await sdk.createSessionToken(person.openId,{name:person.name??'',expiresInMs:60000});
    await expect(sdk.authenticateRequest({headers:{cookie:`${COOKIE_NAME}=${token}`}} as any)).rejects.toThrow('利用停止');
    await expect(caller('user',staff,person.disabledAt).cases.get({id:cid})).rejects.toMatchObject({code:'UNAUTHORIZED'});
    await expect(caller('admin',staff,person.disabledAt).users.accessList()).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(caller('executive',staff,person.disabledAt).expenses.list()).rejects.toBeTruthy();
    await expect(caller().staffAdministration.setUserState({userId:staff,expectedRole:'user',expectedDisabledAt:null,disabled:false,reason})).rejects.toMatchObject({code:'CONFLICT'});
  });
  it('明示的に復帰すると同じID・役割・担当で再利用できる', async () => {
    const person=await getStaff();
    await caller().staffAdministration.setUserState({userId:staff,expectedRole:person.role,expectedDisabledAt:person.disabledAt!.toISOString(),disabled:false,reason});
    const restored=await getStaff();expect(restored.disabledAt).toBeNull();expect(restored.role).toBe(person.role);
    const token=await sdk.createSessionToken(restored.openId,{name:restored.name??'',expiresInMs:60000});
    expect((await sdk.authenticateRequest({headers:{cookie:`${COOKIE_NAME}=${token}`}} as any)).id).toBe(staff);
    expect(buildCaseAssigneeRoster([restored],{}).some(x=>x.id===staff)).toBe(true);
    expect(await caller().staffAdministration.history({kind:'user_lifecycle',targetId:staff})).toHaveLength(2);
  });
});
