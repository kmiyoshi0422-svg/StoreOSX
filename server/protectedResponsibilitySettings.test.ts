import { describe,it,expect,vi } from 'vitest';
import { isProtectedAppSetting } from '../shared/protectedAppSettings';
import { OFFICER_ROSTER_SETTING } from '../shared/responsibilityRoster';
vi.mock('./db',async importOriginal=>({...await importOriginal<typeof import('./db')>(),getAllAppSettings:async()=>({[OFFICER_ROSTER_SETTING]:{version:5},'responsibility.confirmedEmailBindings':{'private@example.test':'kihara'},reportAuthorPresets:['担当者']})}));
import { appRouter } from './routers';
import { setAppSetting } from './db';
import type { TrpcContext } from './_core/context';
function context(role:NonNullable<TrpcContext['user']>['role']):TrpcContext {
  const now=new Date();return {user:{id:9002001,role,openId:'TEST-PROTECTED-SETTING',name:'合成',email:'test@example.test',createdAt:now,updatedAt:now,lastSignedIn:now,loginMethod:'test'},req:{protocol:'https',headers:{}} as TrpcContext['req'],res:{} as TrpcContext['res']};
}
describe('責任者設定の汎用経路保護',()=>{
 it.each(['owner','admin','executive','user'] as const)('%sも汎用APIから名簿変更できず、本人設定を一般一覧へ返さない',async role=>{
  const caller=appRouter.createCaller(context(role));
  for(const key of [OFFICER_ROSTER_SETTING,'RESPONSIBILITY.ROSTER.V1','responsibility.confirmedEmailBindings']){
   await expect(caller.appSettings.set({key,value:{current:[]}})).rejects.toMatchObject({code:'FORBIDDEN'});
   await expect(caller.appSettings.get({key})).rejects.toMatchObject({code:'FORBIDDEN'});
  }
  expect(await caller.appSettings.getAll()).toEqual({reportAuthorPresets:['担当者']});
 });
 it('DB保存ヘルパーでも拒否し、大文字・幅・アクセント・空白で迂回しない',async()=>{
  for(const key of [OFFICER_ROSTER_SETTING,'RESPONSIBILITY.ROSTER.V1','ｒｅｓｐｏｎｓｉｂｉｌｉｔｙ.roster.v1','réspónsibility.roster.v1',' responsibility.roster.v1 ']){
   expect(isProtectedAppSetting(key)).toBe(true);
   await expect(setAppSetting(key,{})).rejects.toThrow('専用');
  }
  expect(isProtectedAppSetting('reportAuthorPresets')).toBe(false);
 });
});
