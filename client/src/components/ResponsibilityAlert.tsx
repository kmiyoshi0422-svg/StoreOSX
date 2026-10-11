import { trpc } from '@/lib/trpc';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CaseResponsibilitySelect } from './CaseResponsibilitySelect';
import { RESPONSIBLE_OFFICERS, officerName, type ResponsibleOfficerKey } from '@shared/caseResponsibility';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function ResponsibilityAlert() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [officer, setOfficer] = useState<ResponsibleOfficerKey | ''>('');
  const [confirm, setConfirm] = useState(false);
  const [confirmIds, setConfirmIds] = useState<number[]>([]);
  const utils = trpc.useUtils();
  const { data, error, isLoading, refetch } = trpc.responsibility.alerts.useQuery(undefined, { refetchInterval: 60_000 });
  const mutation = trpc.responsibility.bulkAssign.useMutation({
    onSuccess: result => {
      toast.success(`${result.count}件の案件責任者を${officerName(officer)}に決定しました`);
      setSelected([]); setConfirm(false);
      utils.responsibility.alerts.invalidate(); utils.responsibility.personal.invalidate();
      utils.cases.listSummary.invalidate(); utils.cases.get.invalidate(); utils.responsibility.history.invalidate();
    },
    onError: error => { toast.error(error.message); refetch(); },
  });
  useEffect(() => {
    if (!data) return;
    const validIds = new Set(data.rows.map(row => row.id));
    setSelected(current => current.filter(id => validIds.has(id)));
  }, [data]);
  if (isLoading) return null;
  if (error) return <div className="text-sm text-muted-foreground">責任者アラートを取得できませんでした。<Button size="sm" variant="ghost" onClick={() => refetch()}>再取得</Button></div>;
  if (!data?.eligible || !data.count) return null;
  const pages = Math.ceil(data.rows.length / 10), current = Math.min(page, pages);
  const visibleRows = data.rows.slice((current - 1) * 10, current * 10);
  const selectedRows = data.rows.filter(row => selected.includes(row.id));
  const confirmedRows = data.rows.filter(row => confirmIds.includes(row.id));
  const confirmationValid = confirmIds.length > 0 && confirmedRows.length === confirmIds.length;
  const toggle = (id: number, checked: boolean) => setSelected(current => checked ? Array.from(new Set([...current, id])).slice(0, 100) : current.filter(x => x !== id));
  return <Card className="border-orange-300 bg-orange-50/40" role="alert" aria-label="案件責任者未決定アラート"><CardContent className="p-4 md:p-5 space-y-4">
    <div className="flex items-start gap-3"><AlertTriangle className="h-5 w-5 text-orange-700 shrink-0 mt-0.5" /><div><h2 className="font-semibold text-orange-900">担当者をきめてください — 案件責任者未決定 {data.count}件</h2><p className="text-xs text-muted-foreground mt-1">依頼日2026年10月1日以降・登録から5日経過。木原・野口・河野・三好・新藤のいずれかを責任者に決定してください。現在の作業担当者は変更しません。</p></div></div>
    <div className="flex flex-wrap gap-2 items-center rounded-lg border border-orange-200 bg-background/70 p-3">
      <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => setSelected(current => Array.from(new Set([...current, ...visibleRows.map(x => x.id)])).slice(0, 100))}>このページを選択</Button>
      <Button size="sm" variant="ghost" disabled={!selected.length || mutation.isPending} onClick={() => setSelected([])}>選択解除</Button>
      <span className="text-xs" aria-live="polite">選択 {selectedRows.length}件 / 最大100件</span>
      <Select value={officer} onValueChange={value => setOfficer(value as ResponsibleOfficerKey)} disabled={mutation.isPending}><SelectTrigger className="w-full sm:w-[190px] bg-background" aria-label="一括割当の案件責任者"><SelectValue placeholder="割り当てる責任者" /></SelectTrigger><SelectContent>{RESPONSIBLE_OFFICERS.map(x => <SelectItem key={x.key} value={x.key}>{x.name}</SelectItem>)}</SelectContent></Select>
      <Button size="sm" disabled={!selectedRows.length || !officer || mutation.isPending} onClick={() => { setConfirmIds(selectedRows.map(row => row.id)); setConfirm(true); }}>{mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />割当中…</> : '選択案件の責任者を一括割当'}</Button>
    </div>
    {visibleRows.map(row => <div key={row.id} className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between border-t border-orange-200/60 pt-3">
      <div className="flex gap-3 items-start min-w-0"><Checkbox className="mt-1 shrink-0" aria-label={`${row.requestNumber}の責任者一括割当を選択`} checked={selected.includes(row.id)} disabled={mutation.isPending || (!selected.includes(row.id) && selected.length >= 100)} onCheckedChange={checked => toggle(row.id, checked === true)} /><button className="text-left min-w-0" onClick={() => navigate(`/cases/${row.id}`)}><span className="text-xs font-mono text-muted-foreground">{row.requestNumber} · 登録後{row.elapsedDays}日</span><p className="font-medium text-sm">{row.storeName} · {row.status}</p></button></div>
      {!mutation.isPending && <CaseResponsibilitySelect caseId={row.id} current={row.responsibleOfficer} compact />}
    </div>)}
    {pages > 1 && <div className="flex gap-2 justify-end items-center text-xs"><span>{current} / {pages}ページ</span><Button size="sm" variant="outline" disabled={current === 1 || mutation.isPending} onClick={() => setPage(current - 1)}>前へ</Button><Button size="sm" variant="outline" disabled={current === pages || mutation.isPending} onClick={() => setPage(current + 1)}>次へ</Button></div>}
    <Dialog open={confirm} onOpenChange={open => { if (!mutation.isPending) setConfirm(open); }}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>案件責任者の一括割当を確認</DialogTitle><DialogDescription>{confirmIds.length}件を「{officerName(officer)}」に割り当てます。作業担当者・業者・進捗・日付は変更しません。決定済み案件などが含まれた場合は全件停止します。</DialogDescription></DialogHeader>
      {!confirmationValid && <p role="alert" className="text-sm text-destructive">対象案件が変更されました。閉じて再選択してください。</p>}
      <div className="max-h-60 overflow-y-auto space-y-2 text-sm">{confirmedRows.map(row => <div key={row.id} className="rounded border p-2"><p className="font-medium">{row.storeName}</p><p className="text-xs text-muted-foreground">{row.requestNumber}</p></div>)}</div>
      <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setConfirm(false)}>キャンセル</Button><Button disabled={mutation.isPending || !confirmationValid || !officer} onClick={() => officer && mutation.mutate({ caseIds: confirmIds, officerKey: officer })}>{mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />割当中…</> : `${confirmIds.length}件の割当を実行`}</Button></DialogFooter>
    </DialogContent></Dialog>
  </CardContent></Card>;
}
