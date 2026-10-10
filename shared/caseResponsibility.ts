export const RESPONSIBLE_OFFICERS = [
  { key: 'kihara', name: '木原 新' }, { key: 'noguchi', name: '野口 直人' },
  { key: 'kono', name: '河野 陽一郎' }, { key: 'miyoshi', name: '三好 慶' },
  { key: 'shindo', name: '新藤 雅樹' },
] as const;
export type ResponsibleOfficerKey = typeof RESPONSIBLE_OFFICERS[number]['key'];
export const OFFICER_KEYS = ['kihara','noguchi','kono','miyoshi','shindo'] as const;
export const RESPONSIBILITY_START_MS = Date.parse('2026-10-01T00:00:00+09:00');
export const RESPONSIBILITY_DELAY_MS = 5 * 24 * 60 * 60 * 1000;
export function officerName(key: string | null | undefined) { return RESPONSIBLE_OFFICERS.find(x=>x.key===key)?.name ?? '未決定'; }
export function isActiveCase(row: {status: string}) { return !['完了','クローズ','失注'].includes(row.status); }
export function requiresResponsibilityAlert(row: { responsibleOfficer?: string | null; requestDate?: Date | string | number | null; createdAt?: Date | string | number | null; status: string }, now = Date.now()) {
  if(row.responsibleOfficer || !isActiveCase(row) || row.requestDate == null || row.createdAt == null) return false;
  const requested = new Date(row.requestDate).getTime(), created = new Date(row.createdAt).getTime();
  return Number.isFinite(requested) && Number.isFinite(created) && requested >= RESPONSIBILITY_START_MS && now >= created + RESPONSIBILITY_DELAY_MS;
}
export function summarizePersonalCases(rows: {status:string;urgency:string;progressStage?: string | null;responsibleOfficer?:string|null}[]) {
  const byStatus:Record<string,number>={},byUrgency:Record<string,number>={},byStage:Record<string,number>={};
  for(const row of rows){byStatus[row.status]=(byStatus[row.status]??0)+1;byUrgency[row.urgency]=(byUrgency[row.urgency]??0)+1;const stage=row.progressStage??'未対応';byStage[stage]=(byStage[stage]??0)+1;}
  return { total:rows.length, active:rows.filter(isActiveCase).length, completed:rows.filter(x=>['完了','クローズ'].includes(x.status)).length, lost:byStatus['失注']??0, urgent:byUrgency.S??0, byStatus,byUrgency,byStage };
}
