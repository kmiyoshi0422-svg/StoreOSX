import { canManageCases } from './accessPolicy';

// ログイン権限と候補除外は別。既存案件・本人アカウントを削除しない。
export const EXCLUDED_CASE_ASSIGNEE_IDS: readonly number[] = [253050001];
export const PENDING_KIHARA_ID = -1;
export function isExcludedCaseAssignee(id: number) { return EXCLUDED_CASE_ASSIGNEE_IDS.includes(id); }
export type RosterUser = { id: number; name: string | null; email: string | null; role: string; areaAccessMode: 'all' | 'selected'; allowedPrefectures: string | null };
export function buildCaseAssigneeRoster(users: RosterUser[], confirmedBindings: Record<string,string>) {
  const matchesKihara = (user: RosterUser) => !!user.email && confirmedBindings[user.email.trim().toLowerCase()] === 'kihara';
  const result = users.filter(user => canManageCases(user.role) && !isExcludedCaseAssignee(user.id)).map(user => ({
    ...user, name: matchesKihara(user) ? '木原 新' : user.name, canAssign: true,
  }));
  if (!result.some(matchesKihara)) result.push({ id: PENDING_KIHARA_ID, name: '木原 新（初回ログイン待ち）', email: null,
    role: 'user', areaAccessMode: 'all', allowedPrefectures: null, canAssign: false });
  return result;
}
