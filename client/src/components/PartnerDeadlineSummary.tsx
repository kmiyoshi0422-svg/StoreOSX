import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { deadlineInfo, deadlineLabel, type DeadlineState } from '@shared/caseDeadline';
export function PartnerDeadlineBadge({ deadline, status, sourceLabel }: { deadline?: string | null; status: string; sourceLabel: string }) {
  const info = deadlineInfo({ status, deadline });
  if (info.state === 'closed') return null;
  const emphasized = ['soon', 'today', 'overdue'].includes(info.state);
  return <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="完了期限の状況">
    <span>{sourceLabel}: {deadline ?? '未設定'}</span>
    {emphasized && <Badge className={info.state === 'overdue' ? 'bg-red-100 text-red-800 border-red-300' : info.state === 'today' ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-amber-100 text-amber-800 border-amber-300'} variant="outline">{deadlineLabel(info.state, info.days)}</Badge>}
  </div>;
}
export function PartnerDeadlineSummary({ rows, filter, onFilter, sourceLabel }: {
  rows: { status: string; deadline?: string | null }[];
  filter: 'all' | 'attention'; onFilter: (filter: 'all' | 'attention') => void; sourceLabel: string;
}) {
  const counts: Record<DeadlineState, number> = { unset: 0, normal: 0, soon: 0, today: 0, overdue: 0, closed: 0 };
  for (const row of rows) counts[deadlineInfo(row).state]++;
  return <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 space-y-3" aria-label="担当案件の期限アラート">
    <div><h2 className="font-semibold text-sm">担当案件の期限</h2><p className="text-xs text-muted-foreground mt-1">{sourceLabel}を基準に、3日前から強調します。完了・クローズ・失注は除外。未設定の期限は推測しません。</p></div>
    <div className="flex flex-wrap gap-2 text-xs"><Badge variant="outline" className="text-red-800">超過 {counts.overdue}件</Badge><Badge variant="outline" className="text-orange-800">本日 {counts.today}件</Badge><Badge variant="outline" className="text-amber-800">3日以内 {counts.soon}件</Badge><Badge variant="outline">未設定 {counts.unset}件</Badge></div>
    <Button size="sm" variant={filter === 'attention' ? 'default' : 'outline'} onClick={() => onFilter(filter === 'attention' ? 'all' : 'attention')}>{filter === 'attention' ? '期限の絞り込みを解除' : '期限が近い・超過の案件だけ表示'}</Button>
  </section>;
}
export function deadlineCardClass(status: string, deadline?: string | null) {
  const { state } = deadlineInfo({ status, deadline });
  return state === 'overdue' ? 'border-red-300 bg-red-50/40' : state === 'today' ? 'border-orange-300 bg-orange-50/40' : state === 'soon' ? 'border-amber-300 bg-amber-50/40' : 'border-border/80';
}
