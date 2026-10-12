import { canManageCases } from './accessPolicy';
import { isExcludedCaseAssignee, type RosterUser } from './caseAssigneeRoster';
import { OFFICER_KEYS, officerName, isActiveCase, type ResponsibleOfficerKey } from './caseResponsibility';

export type AssignmentCountCase = { id: number; assigneeId: number | null; status: string };
export type StaffGroup = { key: string; name: string; userIds: number[]; canAssign: boolean; pending: boolean; legacy: boolean };
export function buildInternalStaffGroups(users: RosterUser[], bindings: Record<string, string>, accounts: {userId:number;officerKey:string}[]) {
  const groups = new Map<string, StaffGroup>();
  const accountKeys = new Map(accounts.map(x => [x.userId, x.officerKey]));
  for (const user of users) {
    if (!canManageCases(user.role)) continue;
    const rawKey = (user.email ? bindings[user.email.trim().toLowerCase()] : undefined) ?? accountKeys.get(user.id);
    const officerKey = OFFICER_KEYS.includes(rawKey as ResponsibleOfficerKey) ? rawKey as ResponsibleOfficerKey : null;
    const legacy = isExcludedCaseAssignee(user.id);
    const key = !legacy && officerKey ? `officer:${officerKey}` : `user:${user.id}`;
    const current = groups.get(key);
    if (current) current.userIds.push(user.id);
    else groups.set(key, { key, name: !legacy && officerKey ? officerName(officerKey) : user.name || `User #${user.id}`,
      userIds: [user.id], canAssign: !legacy, pending: false, legacy });
  }
  if (!groups.has('officer:kihara')) groups.set('officer:kihara', {key:'officer:kihara',name:'木原 新',userIds:[],canAssign:false,pending:true,legacy:false});
  return Array.from(groups.values());
}
export function countStaffAssignments(groups: StaffGroup[], rows: AssignmentCountCase[]) {
  const counts = new Map<number,{active:number;total:number;completed:number;lost:number}>();
  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (row.assigneeId === null) continue;
    const count = counts.get(row.assigneeId) ?? {active:0,total:0,completed:0,lost:0};
    count.total++;
    if (isActiveCase(row)) count.active++;
    else if (row.status === '失注') count.lost++;
    else count.completed++;
    counts.set(row.assigneeId,count);
  }
  return groups.map(group => {
    const count={active:0,total:0,completed:0,lost:0};
    for(const id of Array.from(new Set(group.userIds))) {const part=counts.get(id);if(part)for(const key of ['active','total','completed','lost'] as const) count[key]+=part[key];}
    return {...group,...count};
  }).filter(group => !group.legacy || group.total > 0).sort((a,b) => Number(a.legacy)-Number(b.legacy) || b.active-a.active || a.name.localeCompare(b.name,'ja'));
}
