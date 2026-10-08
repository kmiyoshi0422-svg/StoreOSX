import { jstCalendarDay, parseSurveyCalendarDay } from './emergencySurveyDate';
export const CASE_DATE_FIELDS = [
  { value: 'firstResponseDate', label: '初回対応日（実績）' },
  { value: 'responsePlannedDate', label: '対応予定日' },
  { value: 'surveyDate', label: '現調実施日（実績）' },
  { value: 'constructionDate', label: '施工予定日' },
  { value: 'requestDate', label: '依頼日' },
] as const;
export type CaseDateField = typeof CASE_DATE_FIELDS[number]['value'];
export type CaseDateFilter = { field: CaseDateField; mode: 'all' | 'set' | 'unset'; from: string; to: string };
export type DateFilterCase = Partial<Record<CaseDateField, Date | string | null>>;
export function validCaseDateRange(filter: Pick<CaseDateFilter,'from'|'to'>): boolean {
  return (!filter.from || !!parseSurveyCalendarDay(filter.from)) && (!filter.to || !!parseSurveyCalendarDay(filter.to))
    && (!filter.from || !filter.to || filter.from <= filter.to);
}
/** 選んだ列だけ比較。現調・施工・依頼日から未入力の実績を補完しない。 */
export function matchesCaseDateFilter(item: DateFilterCase, filter: CaseDateFilter): boolean {
  if (!validCaseDateRange(filter)) return false;
  const day = jstCalendarDay(item[filter.field]);
  if (filter.mode === 'unset') return day === null;
  if (!day) return filter.mode === 'all' && !filter.from && !filter.to;
  return (!filter.from || day >= filter.from) && (!filter.to || day <= filter.to);
}
