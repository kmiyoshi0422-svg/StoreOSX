import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { appSettings, cases, users, responsibilityRosterLogs } from '../drizzle/schema';
import { OFFICER_ROSTER_SETTING, type OfficerRoster } from '../shared/responsibilityRoster';
import { resolveOfficerName } from '../shared/responsibilityRoster';
import type { TrpcContext } from './_core/context';
const state = vi.hoisted(() => ({db: null as any,onTransaction:null as (()=>Promise<void>)|null}));
vi.mock('./db', async importOriginal => {
  const actual = await importOriginal<typeof import('./db')>();
  return {...actual,getDb:async()=>state.db ?? await actual.getDb(),getCaseById:async(id:number)=>{
    if(!state.db)return actual.getCaseById(id);
    return (await state.db.select().from(cases).where(eq(cases.id,id)))[0];
  }};

});
import { caseResponsibilityRouter } from './caseResponsibilityRouter';
function caller(id:number,role:NonNullable<TrpcContext['user']>['role']='user') {
  const now=new Date();return caseResponsibilityRouter.createCaller({user:{id,role,name:'テスト本人',openId:`TEST-ROSTER-${id}`,email:`${id}@example.test`,createdAt:now,updatedAt:now,lastSignedIn:now,loginMethod:'test',areaAccessMode:'all',allowedPrefectures:null},req:{protocol:'https',headers:{}} as TrpcContext['req'],res:{} as TrpcContext['res']});
}
describe('最高管理者の責任者5名入替（非公開トランザクション内）',()=>{
  let ids:number[]=[],owner=0,external=0,stopped=0,caseId=0,pendingId=0;
  let release:()=>void,done:Promise<unknown>;
  beforeAll(async()=>{
    const actual = await vi.importActual<typeof import('./db')>('./db');const real=(await actual.getDb())!;
    let readyResolve:()=>void;const ready=new Promise<void>(r=>{readyResolve=r;});const hold=new Promise<void>(r=>{release=r;});
    done=real.transaction(async tx=>{
      state.db=new Proxy(tx,{get(target,prop){if(prop==='transaction')return async(fn:any)=>{const event=state.onTransaction;state.onTransaction=null;if(event)await event();return fn(state.db);};const value=Reflect.get(target,prop);return typeof value==='function'?value.bind(target):value;}});
      const tag=`TEST-ROSTER-${Date.now()}`;
      for(let i=0;i<9;i++){const[r]=await tx.insert(users).values({openId:`${tag}-${i}`,name:`合成責任者${i}`,email:`${tag}-${i}@example.test`,role:i===6?'owner':i===7?'partner':'user',disabledAt:i===8?new Date():null}).$returningId();ids.push(r.id);}
      owner=ids[6];external=ids[7];stopped=ids[8];
      const keys=['kihara','noguchi','kono','miyoshi','shindo'];
      const roster:OfficerRoster={version:0,current:ids.slice(0,5).map((id,i)=>({key:keys[i],name:`合成責任者${i}`,userId:id,userIds:[id]})),archived:[]};
      await tx.insert(appSettings).values({settingKey:OFFICER_ROSTER_SETTING,settingValue:JSON.stringify(roster)}).onDuplicateKeyUpdate({set:{settingValue:JSON.stringify(roster)}});
      const[r]=await tx.insert(cases).values({requestNumber:`${tag}-case`,storeName:'合成旧責任者案件',prefecture:'福岡県',responsibleOfficer:'kihara',status:'施工中',assigneeId:ids[0],requestDate:new Date('2026-10-01'),createdAt:new Date(Date.now()-6*86400000),estimatedCost:1000}).$returningId();caseId=r.id;
      const[p]=await tx.insert(cases).values({requestNumber:`${tag}-pending`,storeName:'合成未決定',prefecture:'福岡県',requestDate:new Date('2026-10-01'),createdAt:new Date(Date.now()-6*86400000)}).$returningId();pendingId=p.id;
      readyResolve!();await hold;throw new Error('EXPECTED_TEST_ROLLBACK');
    }).catch(error=>{if(error.message!=='EXPECTED_TEST_ROLLBACK')throw error;});
    await Promise.race([ready,done.then(()=>{throw new Error('fixture not initialized');})]);
  },30000);
  afterAll(async()=>{release?.();await done;state.db=null;},30000);
  it.each(['admin','user','executive','partner','customer'] as const)('%sは管理閲覧・入替を拒否',async role=>{
    await expect(caller(ids[0],role).rosterManagement()).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(caller(ids[0],role).replaceRoster({expectedVersion:0,members:ids.slice(0,5),reason:'テスト'})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('4名・重複・同本人・退職・社外・理由空欄を拒否',async()=>{
    for(const members of [ids.slice(0,4),[ids[0],ids[0],...ids.slice(2,5)],[...ids.slice(0,4),external],[...ids.slice(0,4),stopped]])await expect(caller(owner,'owner').replaceRoster({expectedVersion:0,members,reason:'テスト'})).rejects.toMatchObject({code:'BAD_REQUEST'});
    await expect(caller(owner,'owner').replaceRoster({expectedVersion:0,members:ids.slice(0,5),reason:' '})).rejects.toMatchObject({code:'BAD_REQUEST'});
    expect((await caller(owner,'owner').rosterManagement()).version).toBe(0);
  });
  it('1名を入替・監査・旧案件と利用者権限を変更しない',async()=>{
    const beforeCase=(await state.db.select().from(cases).where(eq(cases.id,caseId)))[0];
    const beforeUsers=await state.db.select().from(users);
    const result=await caller(owner,'owner').replaceRoster({expectedVersion:0,members:[ids[5],...ids.slice(1,5)],reason:'合成人事異動'});
    expect(result).toMatchObject({success:true,version:1});
    const management=await caller(owner,'owner').rosterManagement();
    expect(management.current[0]).toMatchObject({key:`member_${ids[5]}`,name:'合成責任者5'});
    expect(management.archived).toContainEqual(expect.objectContaining({key:'kihara',name:'合成責任者0'}));
    expect((await state.db.select().from(cases).where(eq(cases.id,caseId)))[0]).toEqual(beforeCase);
    expect(await state.db.select().from(users)).toEqual(beforeUsers);
    expect(management.history[0]).toMatchObject({reason:'合成人事異動',changedBy:owner});
  });
  it('旧本人のアラート停止・新本人のみ対象、旧案件の責任集計は維持',async()=>{
    expect(await caller(ids[0]).alerts()).toMatchObject({eligible:false,count:0});
    expect(await caller(ids[5]).alerts()).toMatchObject({eligible:true,officerKey:`member_${ids[5]}`});
    expect((await caller(ids[0]).personal()).rows.some(row=>row.id===caseId)).toBe(true);
    expect((await caller(ids[5]).personal()).rows.some(row=>row.id===caseId)).toBe(false);
  });
  it('旧責任者新規割当を拒否し、新責任者を保存・一括割当にも対応',async()=>{
    await expect(caller(owner,'owner').set({caseId:pendingId,officerKey:'kihara'})).rejects.toMatchObject({code:'BAD_REQUEST'});
    const result=await caller(ids[5]).bulkAssign({caseIds:[pendingId],officerKey:`member_${ids[5]}`});expect(result.count).toBe(1);
    expect((await caller(ids[5]).personal()).rows.some(row=>row.id===pendingId)).toBe(true);
    expect(resolveOfficerName('kihara',await caller(owner,'owner').directory())).toBe('合成責任者0');
  });
  it('保存後の確認済み別メール/別IDを同じ本人に解決し、旧案件を保持・二重登録を拒否',async()=>{
    const email=`TEST-ROSTER-alias-${Date.now()}@example.test`;
    const [alias]=await state.db.insert(users).values({openId:email,name:'合成本人別ログイン',email,role:'user'}).$returningId();
    const [binding]=await state.db.select().from(appSettings).where(eq(appSettings.settingKey,'responsibility.confirmedEmailBindings'));
    const data=JSON.parse(binding?.settingValue??'{}');data[email.toLowerCase()]='kihara';
    await state.db.insert(appSettings).values({settingKey:'responsibility.confirmedEmailBindings',settingValue:JSON.stringify(data)}).onDuplicateKeyUpdate({set:{settingValue:JSON.stringify(data)}});
    expect(await caller(alias.id).alerts()).toMatchObject({eligible:false});
    expect((await caller(alias.id).personal()).rows.some(row=>row.id===caseId)).toBe(true);
    await expect(caller(owner,'owner').replaceRoster({expectedVersion:1,members:[ids[0],alias.id,...ids.slice(1,4)],reason:'合成別IDの重複'})).rejects.toMatchObject({code:'BAD_REQUEST'});
  },30000);
  it('古い画面のversionで上書きしない・5人全部を選択変更できる',async()=>{
    await expect(caller(owner,'owner').replaceRoster({expectedVersion:0,members:ids.slice(0,5),reason:'古い画面'})).rejects.toMatchObject({code:'CONFLICT'});
    const result=await caller(owner,'owner').replaceRoster({expectedVersion:1,members:[ids[4],ids[3],ids[2],ids[1],ids[0]],reason:'合成復帰と5欄の変更'});expect(result.version).toBe(2);
    expect((await caller(owner,'owner').rosterManagement()).current.map(row=>row.key)).toEqual(['shindo','miyoshi','kono','noguchi','kihara']);
  });
  it('外側の資格確認後に本人が外れても、一括割当はロック後の再認可で拒否',async()=>{
    const [row]=await state.db.insert(cases).values({requestNumber:`TEST-ROSTER-RACE-${Date.now()}`,storeName:'合成競合案件',prefecture:'福岡県',requestDate:new Date('2026-10-01'),createdAt:new Date(Date.now()-6*86400000)}).$returningId();
    const [saved]=await state.db.select().from(appSettings).where(eq(appSettings.settingKey,OFFICER_ROSTER_SETTING));
    const roster=JSON.parse(saved.settingValue) as OfficerRoster;
    state.onTransaction=async()=>{
      const former=roster.current.find(m=>m.key==='kihara')!;const next=roster.archived.find(m=>m.key===`member_${ids[5]}`)!;
      const changed={version:3,current:[...roster.current.filter(m=>m.key!=='kihara'),next],archived:[...roster.archived.filter(m=>m.key!==next.key),former]};
      await state.db.update(appSettings).set({settingValue:JSON.stringify(changed)}).where(eq(appSettings.id,saved.id));
    };
    await expect(caller(ids[0]).bulkAssign({caseIds:[row.id],officerKey:'noguchi'})).rejects.toMatchObject({code:'FORBIDDEN'});
    expect((await state.db.select().from(cases).where(eq(cases.id,row.id)))[0].responsibleOfficer).toBeNull();
    await state.db.update(appSettings).set({settingValue:saved.settingValue}).where(eq(appSettings.id,saved.id));
  },30000);
});
