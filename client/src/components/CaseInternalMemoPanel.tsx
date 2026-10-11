import { useEffect, useState } from 'react';
import { Loader2, Save, MessageSquareText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function CaseInternalMemoPanel({ caseId, active }: { caseId: number; active: boolean }) {
  const utils = trpc.useUtils();
  const query = trpc.internalMemo.get.useQuery({ caseId }, { enabled: active, refetchOnWindowFocus: true });
  const [draft, setDraft] = useState<{ body: string; version: number } | null>(null);
  const [savedBody, setSavedBody] = useState('');
  const [error, setError] = useState('');
  const dirty = !!draft && draft.body !== savedBody;
  useEffect(() => {
    if (query.data && (!draft || (!dirty && draft.version < query.data.version))) {
      setDraft({ body: query.data.body, version: query.data.version });
      setSavedBody(query.data.body);
    }
  }, [query.data, dirty, draft]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  const save = trpc.internalMemo.save.useMutation({
    onSuccess: async (result, variables) => {
      setDraft({ body: variables.body, version: result.version }); setSavedBody(variables.body); setError('');
      await utils.internalMemo.get.invalidate({ caseId }); toast.success('メモを保存しました');
    },
    onError: (err) => { setError(err.message); toast.error(err.message); if (err.data?.code === 'CONFLICT') void query.refetch(); },
  });
  const remoteChanged = !!draft && !!query.data && draft.version < query.data.version;
  const replaceWithLatest = () => {
    if (!query.data || (dirty && !window.confirm('入力中の未保存メモを破棄して、最新の保存内容に戻しますか？'))) return;
    setDraft({ body: query.data.body, version: query.data.version }); setSavedBody(query.data.body); setError('');
  };
  return <Card aria-label="案件の社内メモ">
    <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5" />メモ</CardTitle>
      <p className="text-sm text-muted-foreground">連絡事項、確認内容、引き継ぎなどを自由に記入できます。社内専用で、協力業者・顧客や報告書には公開されません。</p>
    </CardHeader>
    <CardContent className="space-y-4">
      {query.isLoading && !draft ? <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />読み込み中…</p> : query.isError ? <div role="alert"><p>{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>再読み込み</Button></div> : draft && <>
        {query.data?.masked ? <p className="rounded-md border p-4 text-muted-foreground">{query.data.body}。編集には金額閲覧権限が必要です。</p> : <Textarea id="internal-memo-body" aria-label="自由記入メモ" placeholder="例：店舗への連絡内容、次回確認する事項、担当者への引き継ぎなど" value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} maxLength={10000} rows={12} disabled={save.isPending || query.data?.canEdit === false} className="min-h-[280px] resize-y leading-7" />}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{dirty ? '未保存の変更があります（タブを切り替えても入力は保持されます）' : '保存済みの内容です'}</span><span>{draft.body.length.toLocaleString()}/10,000文字</span></div>
        {query.data?.updatedAt && <p className="text-xs text-muted-foreground">最終更新：{new Date(query.data.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ／ {query.data.updatedByName}</p>}
        {(error || remoteChanged) && <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert"><p>{error || '他の利用者が更新しています。入力はそのまま保持しています。最新内容を確認してください。'}</p>{remoteChanged && <><p className="whitespace-pre-wrap break-words">最新の保存内容：{query.data?.body || '（空欄）'}</p><Button size="sm" variant="outline" onClick={replaceWithLatest}>最新の保存内容に戻す</Button></>}</div>}
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={save.isPending} onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" />保存内容を再確認</Button><Button disabled={!dirty || save.isPending || query.data?.canEdit === false || remoteChanged} onClick={() => save.mutate({ caseId, body: draft.body, expectedVersion: draft.version })}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{save.isPending ? '保存中…' : 'メモを保存'}</Button></div>
      </>}
    </CardContent>
  </Card>;
}
