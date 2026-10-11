import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseSurveyCalendarDay } from '@shared/emergencySurveyDate';
import { PartnerDeadlineBadge } from './PartnerDeadlineSummary';
export function CompletionDeadlineCard({ caseId, canEdit }: { caseId: number; canEdit: boolean }) {
  const query = trpc.deadline.get.useQuery({ caseId });
  const history = trpc.deadline.history.useQuery({ caseId }, { enabled: canEdit });
  const [date, setDate] = useState(''), [reason, setReason] = useState(''), [remove, setRemove] = useState(false);
  const utils = trpc.useUtils();
  useEffect(() => { setDate(query.data?.deadline ?? ''); }, [query.data?.deadline, caseId]);
  const save = trpc.deadline.set.useMutation({
    onSuccess: async ({ changed }) => {
      toast.success(changed ? '完了期限を更新しました' : '完了期限に変更はありません');
      setReason(''); setRemove(false);
      await Promise.all([utils.deadline.get.invalidate({ caseId }), utils.deadline.history.invalidate({ caseId }), utils.responsibility.personal.invalidate(), utils.cases.get.invalidate({ id: caseId })]);
    },
    onError: error => { toast.error(error.message); if (error.data?.code === 'CONFLICT') query.refetch(); },
  });
  if (query.isLoading) return <p className="text-sm text-muted-foreground">完了期限を読込中…</p>;
  if (query.isError) return <p className="text-sm text-destructive">完了期限を取得できませんでした。<Button variant="ghost" size="sm" onClick={() => query.refetch()}>再取得</Button></p>;
  const current = query.data?.deadline ?? null;
  const submit = (deadline: string | null) => save.mutate({ caseId, deadline, expectedDeadline: current, reason: reason.trim() });
  return <Card aria-label="完了期限の設定"><CardHeader><CardTitle className="text-base">完了期限</CardTitle><CardDescription>約束した工事の完了期限。対応予定日・施工予定日・実際の完了日とは別に管理します。</CardDescription></CardHeader><CardContent className="space-y-4">
    <PartnerDeadlineBadge status={query.data?.status ?? '受付'} deadline={current} sourceLabel="完了期限" />
    {canEdit && <><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor={`deadline-${caseId}`}>完了期限</Label><Input id={`deadline-${caseId}`} aria-label="完了期限の日付" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={save.isPending} /></div><div className="space-y-1.5"><Label htmlFor={`deadline-reason-${caseId}`}>設定・変更理由（必須・3文字以上）</Label><Textarea id={`deadline-reason-${caseId}`} aria-label="完了期限の変更理由" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={2} disabled={save.isPending} placeholder="例：担当業者と納期確認済み" /></div></div>
    <div className="flex flex-wrap gap-2"><Button disabled={save.isPending || !parseSurveyCalendarDay(date) || date === current || reason.trim().length < 3} onClick={() => submit(date)}>{save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />保存中…</> : '完了期限を保存'}</Button>{current && <Button variant="outline" disabled={save.isPending || reason.trim().length < 3} onClick={() => setRemove(true)}>完了期限を解除</Button>}</div>
    {history.isError && <p className="text-xs text-destructive">変更履歴の取得に失敗しました。</p>}
    {!!history.data?.length && <div className="border-t pt-3 space-y-2 max-h-48 overflow-y-auto"><p className="font-medium text-sm">完了期限の変更履歴</p>{history.data.map(row => <div key={row.id} className="text-xs text-muted-foreground break-words">{new Date(row.changedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} {row.changedByName}：{row.beforeDeadline ?? '未設定'} → {row.afterDeadline ?? '未設定'}／{row.reason}</div>)}</div>}
    <Dialog open={remove} onOpenChange={open => { if (!save.isPending) setRemove(open); }}><DialogContent><DialogHeader><DialogTitle>完了期限を解除しますか？</DialogTitle><DialogDescription>現在の期限「{current}」を未設定に戻します。変更理由「{reason}」を履歴に残し、業者画面の期限ハイライトは解除されます。状態や施工日は変更しません。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={save.isPending} onClick={() => setRemove(false)}>キャンセル</Button><Button disabled={save.isPending || reason.trim().length < 3} onClick={() => submit(null)}>解除を実行</Button></DialogFooter></DialogContent></Dialog>
    </>}
  </CardContent></Card>;
}
