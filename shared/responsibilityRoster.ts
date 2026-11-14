import { RESPONSIBLE_OFFICERS } from './caseResponsibility';
export type OfficerMember = { key: string; name: string; userId: number | null; userIds: number[] };
export type OfficerRoster = { version: number; current: OfficerMember[]; archived: OfficerMember[] };
export type OfficerOption = { key: string; name: string; active: boolean; eligible: boolean };
export const OFFICER_ROSTER_SETTING = 'responsibility.roster.v1';
export function resolveOfficerName(key: string | null | undefined, directory: {key:string;name:string}[]) {
  if (!key) return '未決定';
  return directory.find(member => member.key === key)?.name ?? RESPONSIBLE_OFFICERS.find(member => member.key === key)?.name ?? '旧責任者（名簿取得待ち）';
}
