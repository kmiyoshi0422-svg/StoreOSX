import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { appRouter } from './routers';
import { getDb, deleteCase } from './db';
import { cases, caseInternalMemos } from '../drizzle/schema';
import type { TrpcContext } from './_core/context';
import fs from 'node:fs';
function caller(role: NonNullable<TrpcContext['user']>['role'], area?: string[]) {
  const now = new Date(); return appRouter.createCaller({ user: { id: 1, role, name: '社内メモ検証者', openId: 'memo-test', email: 'memo@example.test', loginMethod: 'manus', areaAccessMode: area ? 'selected' : 'all', allowedPrefectures: area ? JSON.stringify(area) : null, createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: 'https', headers: {} } as TrpcContext['req'], res: {} as TrpcContext['res'] });
}
describe('独立社内メモ 実DB', () => {
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>; let id=0;
  beforeAll(async () => { db=(await getDb())!; const [row]=await db.insert(cases).values({ requestNumber:`TEST-INTERNAL-MEMO-${Date.now()}`, storeName:'社内メモ検証店', prefecture:'山口県', notes:'既存備考', surveyImpression:'既存所感' }).$returningId(); id=row.id; },30000);
  afterAll(async () => { if(id)await deleteCase(id); },30000);
  it('初期空欄、社員が改行付き保存し記入者・日時・バージョン、案件本体完全不変', async () => {
    expect(await caller('user').internalMemo.get({caseId:id})).toMatchObject({body:'',version:0,canEdit:true});
    const [before]=await db.select().from(cases).where(eq(cases.id,id));
    await caller('user').internalMemo.save({caseId:id,body:'連絡済み\n部品手配を確認',expectedVersion:0});
    const got=await caller('user').internalMemo.get({caseId:id});expect(got).toMatchObject({body:'連絡済み\n部品手配を確認',version:1,updatedByName:'社内メモ検証者'});expect(got.updatedAt).toBeInstanceOf(Date);
    const [after]=await db.select().from(cases).where(eq(cases.id,id));expect(after).toEqual(before);
  });
  it('同文再送は無変更、古い版は競合停止して本文を保持', async () => {
    expect((await caller('admin').internalMemo.save({caseId:id,body:'連絡済み\n部品手配を確認',expectedVersion:1})).changed).toBe(false);
    await expect(caller('admin').internalMemo.save({caseId:id,body:'古い画面',expectedVersion:0})).rejects.toMatchObject({code:'CONFLICT'});
    expect((await caller('admin').internalMemo.get({caseId:id})).body).toContain('連絡済み');
  });
  it('社員・役員・管理者・最高管理者のエリア権限を検証、外部と未認証を拒否', async () => {
    for(const role of ['owner','admin','executive','user'] as const)expect((await caller(role).internalMemo.get({caseId:id})).version).toBe(1);
    for(const role of ['partner','customer'] as const){ await expect(caller(role).internalMemo.get({caseId:id})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(caller(role).internalMemo.save({caseId:id,body:'社外',expectedVersion:1})).rejects.toMatchObject({code:'FORBIDDEN'}); }
    await expect(caller('user',['東京都']).internalMemo.get({caseId:id})).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(caller('user',['東京都']).internalMemo.save({caseId:id,body:'エリア外',expectedVersion:1})).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(appRouter.createCaller({user:null,req:{} as any,res:{} as any}).internalMemo.get({caseId:id})).rejects.toMatchObject({code:'UNAUTHORIZED'});
  });
  it('金額記述は非閲覧社員へ全文非表示・上書き不可、管理者のみ編集可', async () => {
    await expect(caller('user').internalMemo.save({caseId:id,body:'見積12万円',expectedVersion:1})).rejects.toMatchObject({code:'FORBIDDEN'});
    await caller('owner').internalMemo.save({caseId:id,body:'見積12万円\n社内連絡',expectedVersion:1});
    expect(await caller('user').internalMemo.get({caseId:id})).toMatchObject({body:'金額に関する記述を含むため非表示',masked:true,canEdit:false});
    await expect(caller('user').internalMemo.save({caseId:id,body:'伏せられた内容を上書き',expectedVersion:2})).rejects.toMatchObject({code:'FORBIDDEN'});
    expect((await caller('admin').internalMemo.get({caseId:id})).body).toContain('12万円');
  });
  it('一般案件DTOや社外案件へ自由メモを混入しない、10000文字上限', async () => {
    const got=await caller('partner').cases.get({id});expect(got).not.toHaveProperty('internalMemo');expect(JSON.stringify(got)).not.toContain('社内連絡');
    await expect(caller('owner').internalMemo.save({caseId:id,body:'あ'.repeat(10001),expectedVersion:2})).rejects.toMatchObject({code:'BAD_REQUEST'});
  });
  it('空欄への保存と案件削除時のメモ清掃', async () => {
    await caller('admin').internalMemo.save({caseId:id,body:'',expectedVersion:2});expect((await caller('user').internalMemo.get({caseId:id})).body).toBe('');
    await deleteCase(id);expect(await db.select().from(caseInternalMemos).where(eq(caseInternalMemos.caseId,id))).toHaveLength(0);id=0;
  });
});
describe('社内メモタブ画面契約',()=>{
  it('基本情報のすぐ横・社内限定・タブ切替入力保持・保存中と失敗保持',()=>{
    const detail=fs.readFileSync('client/src/pages/CaseDetail.tsx','utf8'), panel=fs.readFileSync('client/src/components/CaseInternalMemoPanel.tsx','utf8');
    expect(detail.indexOf('value="memo"')).toBeGreaterThan(detail.indexOf('value="info"'));expect(detail.indexOf('value="memo"')).toBeLessThan(detail.indexOf('value="checklist"'));expect(detail).toContain('value="memo" forceMount');expect(detail).toContain('canManageCase && <TabsTrigger value="memo"');
    for(const value of ['保存中…','未保存の変更があります','beforeunload','expectedVersion: draft.version',"err.data?.code === 'CONFLICT'",'最新の保存内容に戻す'])expect(panel).toContain(value);
  });
});
