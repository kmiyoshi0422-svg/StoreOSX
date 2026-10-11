import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { deadlineInfo } from '@shared/caseDeadline';
import { PartnerDeadlineBadge, deadlineCardClass } from './PartnerDeadlineSummary';
export function PartnerDeadlineDashboard() {
  const query = trpc.responsibility.personal.useQuery(undefined, { refetchInterval: 60_000 });
  const [, navigate] = useLocation();
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  if (query.isLoading) return <p className="text-sm text-muted-foreground">担当案件の完了期限を確認中…</p>;
  if (query.isError) return <p className="text-sm text-destructive">担当案件の期限を取得できませんでした。<Button variant="ghost" size="sm" onClick={() => query.refetch()}>再取得</Button></p>;
  const rows = (query.data?.rows ?? []).filter(row => ['soon', 'today', 'overdue'].includes(deadlineInfo({ status: row.status, deadline: row.completionDeadline }, clock).state)).sort((a,b) => (a.completionDeadline ?? '').localeCompare(b.completionDeadline ?? ''));
  return <section className="space-y-3" aria-label="協力業者の完了期限ハイライト"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">完了期限が近い担当案件 {rows.length}件</h2><p className="text-xs text-muted-foreground mt-1">自社担当のみ。期限の3日前・当日・超過を表示します。</p></div><Button variant="outline" size="sm" onClick={() => navigate('/my-cases')}>すべての担当案件へ</Button></div>
    {!rows.length && <p className="text-sm text-muted-foreground">期限が近い・超過の担当案件はありません。未設定の期限は推測しません。</p>}
    {rows.slice(0, 5).map(row => <button key={row.id} onClick={() => navigate(`/cases/${row.id}`)} data-deadline-state={deadlineInfo({ status: row.status, deadline: row.completionDeadline }, clock).state} className={`w-full rounded-lg border p-4 text-left space-y-2 ${deadlineCardClass(row.status, row.completionDeadline)}`}><p className="text-sm font-medium">{row.storeName} · {row.status}</p><p className="text-xs font-mono text-muted-foreground">{row.requestNumber}</p><PartnerDeadlineBadge status={row.status} deadline={row.completionDeadline} sourceLabel="完了期限" /></button>)}
    {rows.length > 5 && <p className="text-xs text-muted-foreground">ほか{rows.length - 5}件は「自分の担当案件」で確認できます。</p>}
  </section>;
}
