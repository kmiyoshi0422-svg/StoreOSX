import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { appSettings, responsibleOfficerAccounts, users } from '../drizzle/schema';
import { getDb } from './db';
import { canManageCases } from '../shared/accessPolicy';
import { RESPONSIBLE_OFFICERS } from '../shared/caseResponsibility';
import { OFFICER_ROSTER_SETTING, type OfficerRoster, type OfficerMember } from '../shared/responsibilityRoster';
export type RosterDb = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, 'select' | 'insert' | 'update'>;

/** current/archivedとも本人対応を更新するが、人物キー・在籍構成・保存名は変えない。 */
export async function hydrateOfficerIdentities(db: RosterDb, roster: OfficerRoster): Promise<OfficerRoster> {
  const allUsers = await db.select().from(users);
  const accounts = await db.select().from(responsibleOfficerAccounts);
  const [bindingRow] = await db.select().from(appSettings).where(eq(appSettings.settingKey, 'responsibility.confirmedEmailBindings')).limit(1);
  let bindings: Record<string,string> = {};
  try { bindings = JSON.parse(bindingRow?.settingValue ?? '{}'); } catch { /* explicit records still apply */ }
  const hydrate = (member: OfficerMember): OfficerMember => {
    const storedIds = new Set(member.userIds);
    const storedEmails = new Set(allUsers.filter(user => storedIds.has(user.id) && user.email).map(user => user.email!.trim().toLowerCase()));
    const isLegacy = RESPONSIBLE_OFFICERS.some(original => original.key === member.key);
    const ids = Array.from(new Set([...member.userIds,
      ...accounts.filter(account => isLegacy && account.officerKey === member.key).map(account => account.userId),
      ...allUsers.filter(user => user.email && ((isLegacy && bindings[user.email.trim().toLowerCase()] === member.key) || storedEmails.has(user.email.trim().toLowerCase()))).map(user => user.id)]));
    const primary = member.userId ?? ids.find(id => allUsers.some(user => user.id === id && !user.disabledAt && canManageCases(user.role))) ?? ids[0] ?? null;
    return {...member,userId:primary,userIds:ids};
  };
  return {...roster,current:roster.current.map(hydrate),archived:roster.archived.map(hydrate)};
}
export async function loadOfficerRoster(db: RosterDb): Promise<OfficerRoster> {
  const [setting] = await db.select().from(appSettings).where(eq(appSettings.settingKey, OFFICER_ROSTER_SETTING)).limit(1);
  let roster: OfficerRoster;
  if (setting) {
    try {
      roster = JSON.parse(setting.settingValue) as OfficerRoster;
      if (!Number.isInteger(roster.version) || roster.current.length !== 5 || !Array.isArray(roster.archived) || [...roster.current,...roster.archived].some(member=>typeof member.key!=='string'||typeof member.name!=='string'||!Array.isArray(member.userIds))) throw new Error('invalid roster');
    } catch { throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'責任者メンバー設定を読み込めません。最高管理者に確認してください'}); }
  } else roster = {version:0,current:RESPONSIBLE_OFFICERS.map(member=>({...member,userId:null,userIds:[]})),archived:[]};
  return hydrateOfficerIdentities(db,roster);
}
export async function officerDirectory(db: RosterDb) {
  const roster = await loadOfficerRoster(db);
  const people = await db.select({id:users.id,role:users.role,disabledAt:users.disabledAt}).from(users);
  return [...roster.current.map(member => ({key:member.key,name:member.name,active:true,
    eligible:member.userIds.some(id => people.some(user => user.id === id && !user.disabledAt && canManageCases(user.role)))})),
    ...roster.archived.map(member => ({key:member.key,name:member.name,active:false,eligible:false}))];
}
export async function assertCurrentOfficer(db: RosterDb, key: string) {
  // 名簿入替と案件割当は同じ設定行で直列化。トランザクション内の再検証が最終判定。
  await db.select().from(appSettings).where(eq(appSettings.settingKey,OFFICER_ROSTER_SETTING)).for('update');
  const member = (await officerDirectory(db)).find(item => item.key === key && item.active);
  if (!member) throw new TRPCError({code:'BAD_REQUEST',message:'現在の案件責任者5名から選択してください。旧責任者へ新規割当はできません'});
  if (!member.eligible) throw new TRPCError({code:'BAD_REQUEST',message:'この責任者は未登録・退職・社外区分のため新規割当できません'});
}
export function rosterMemberForUser(roster: OfficerRoster, userId: number): OfficerMember | undefined {
  return roster.current.find(member => member.userIds.includes(userId));
}
