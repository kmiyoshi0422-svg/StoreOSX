// チームの担当者選択肢を絞り込む純粋関数群。
// UI（ScheduleBoard）とテストで共有する。

export type TeamKey = "A" | "B";

export type MinimalUser = { id: number; name?: string | null };

export type TeamSettingLike = {
  primaryUserId: number | null;
  memberIds?: number[];
};

/**
 * チームのメンバーID集合を作る。代表担当者（primaryUserId）も必ず含める。
 */
export function buildTeamMemberIdSet(setting: TeamSettingLike | undefined | null): Set<number> {
  const set = new Set<number>();
  if (!setting) return set;
  if (setting.primaryUserId) set.add(setting.primaryUserId);
  for (const id of setting.memberIds ?? []) set.add(id);
  return set;
}

/**
 * 指定チームの担当者選択肢を返す。
 * - メンバー未設定（集合が空）の場合は全ユーザーを返す（フォールバック）。
 * - 設定済みの場合はそのメンバーのみ。ただし現担当者がメンバー外（旧データ）の
 *   場合は、表示が崩れないよう現担当者を末尾に残す。
 */
export function filterAssigneeOptions<T extends MinimalUser>(
  allUsers: T[],
  memberIds: Set<number>,
  currentAssigneeId: number | null,
): T[] {
  if (memberIds.size === 0) return allUsers;
  const list = allUsers.filter((u) => memberIds.has(u.id));
  if (currentAssigneeId != null && !memberIds.has(currentAssigneeId)) {
    const cur = allUsers.find((u) => u.id === currentAssigneeId);
    if (cur) list.push(cur);
  }
  return list;
}
