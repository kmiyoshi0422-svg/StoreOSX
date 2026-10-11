import { isActiveCase } from './caseResponsibility';
import { jstCalendarDay, parseSurveyCalendarDay } from './emergencySurveyDate';
export type DeadlineState = 'unset' | 'normal' | 'soon' | 'today' | 'overdue' | 'closed';
/** 実績・施工予定日を期限へ転用しない。deadlineには人が定めた期限・明示された工程終了日だけを渡す。 */
export function deadlineInfo(row: { status: string; deadline?: string | null }, now = Date.now()) {
  if (!isActiveCase(row)) return { state: 'closed' as DeadlineState, days: null };
  const date = row.deadline;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { state: 'unset' as DeadlineState, days: null };
  const day = jstCalendarDay(new Date(now));
  const end = parseSurveyCalendarDay(date), today = day ? parseSurveyCalendarDay(day) : null;
  if (!end || !today) return { state: 'unset' as DeadlineState, days: null };
  const days = Math.round((end.getTime() - today.getTime()) / 86400000);
  return { state: (days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 3 ? 'soon' : 'normal') as DeadlineState, days };
}
export function deadlineLabel(state: DeadlineState, days: number | null) {
  if (state === 'overdue') return `期限超過 ${Math.abs(days ?? 0)}日`;
  if (state === 'today') return '本日が期限';
  if (state === 'soon') return `期限まであと${days}日`;
  if (state === 'unset') return '期限未設定';
  return '';
}
