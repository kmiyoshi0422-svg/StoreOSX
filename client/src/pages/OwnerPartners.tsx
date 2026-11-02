import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import PageHeader from '@/components/PageHeader';
import { Building2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../server/routers';

type Company = inferRouterOutputs<AppRouter>['ownerPeople']['companies']['companies'][number];
type Payload = inferRouterInputs<AppRouter>['ownerPeople']['updateCompany'];
type Editor = { company: Company; name: string; isActive: boolean; userId: number | null; reason: string };
export default function OwnerPartners() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const query = trpc.ownerPeople.companies.useQuery(undefined, { enabled: user?.role === 'owner' });
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [approved, setApproved] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const people = query.data?.users ?? [];
  const personName = (id: number | null) => id === null ? '未紐付け' : `${people.find(p => p.id === id)?.name || '名称未設定'}（ID ${id}）`;
  const companies = useMemo(() => (query.data?.companies ?? []).filter(p => `${p.name} ${p.id}`.toLocaleLowerCase('ja').includes(search.trim().toLocaleLowerCase('ja'))), [query.data, search]);
  const update = trpc.ownerPeople.updateCompany.useMutation({
    onSuccess: async () => {
      toast.success('協力会社情報を変更しました。案件の記録・写真・報告書は維持しています。');
      setApproved(null); setEditor(null); setError(null);
      await Promise.all([utils.ownerPeople.companies.invalidate(), utils.ownerPeople.list.invalidate(), utils.partners.invalidate(), utils.cases.invalidate(), utils.responsibility.personal.invalidate()]);
    },
    onError: e => { setError(e.message); toast.error(e.message); },
  });
  if (loading) return <p role="status">権限を確認中…</p>;
  if (user?.role !== 'owner') return <Card><CardContent className="p-6">最高管理者専用です。この管理画面は表示できません。</CardContent></Card>;
  const valid = !!editor && editor.name.trim().length > 0 && editor.name.trim().length <= 255 && editor.reason.trim().length >= 3;
  const requestConfirmation = () => {
    if (!editor || !valid) return;
    const p = editor.company;
    setError(null);
    setApproved({ partnerId: p.id, expected: { name: p.name, isActive: p.isActive, userId: p.userId }, next: { name: editor.name.trim(), isActive: editor.isActive, userId: editor.userId }, reason: editor.reason.trim() });
  };
  return <div className="mx-auto max-w-7xl space-y-5">
    <PageHeader title="協力会社の入替管理" icon={<Building2 className="h-6 w-6" />} description="最高管理者が登録名・有効状態・ログイン担当を変更できます。会社IDと既存案件は維持します。" actions={<Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className="mr-2 h-4 w-4" />一覧を更新</Button>} />
    <Card className="border-amber-300"><CardContent className="space-y-2 p-4 text-sm"><p>ログイン担当を入れ替えると、この会社に割り当てられた案件の編集権限が旧利用者から新利用者へ移ります。金額は引き続き非公開です。</p><p>会社名だけの変更では、依頼PDFに記載された取引先名や過去の報告書を上書きしません。別会社への案件変更は、案件詳細の「担当情報を変更（最高管理者）」から行ってください。</p><Link href="/settings/people" className="inline-block underline">利用者の登録名・社員／管理者／協力業者区分を変更</Link></CardContent></Card>
    <Input aria-label="協力会社を検索" placeholder="会社名・会社IDで検索" value={search} onChange={e => setSearch(e.target.value)} />
    {query.isLoading && <p role="status">協力会社を読み込み中…</p>}
    {query.isError && <p role="alert">取得できませんでした。{query.error.message}<Button onClick={() => void query.refetch()}>再試行</Button></p>}
    {!query.isLoading && !query.isError && companies.length === 0 && <p>該当する協力会社はありません。</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{companies.map(p => <Card key={p.id}><CardContent className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-2"><h2 className="min-w-0 break-words font-semibold">{p.name}</h2><Badge variant="outline">{p.isActive ? '有効' : '新規選択停止'}</Badge></div>
      <p className="text-xs text-muted-foreground">会社ID: {p.id}</p><p className="break-words text-sm">ログイン担当：{personName(p.userId)}</p>
      <p className="text-sm">対応中 {p.activeCases}件 ／ 全担当 {p.totalCases}件</p>
      <Button size="sm" variant="outline" onClick={() => { setEditor({ company: p, name: p.name, isActive: p.isActive, userId: p.userId, reason: '' }); setError(null); }}>会社情報・ログイン担当を変更</Button>
    </CardContent></Card>)}</div>
    <Dialog open={!!editor} onOpenChange={open => { if (!open && !update.isPending) { setEditor(null); setApproved(null); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" showCloseButton={!update.isPending}><DialogHeader><DialogTitle>会社情報・ログイン担当の変更</DialogTitle><DialogDescription>会社IDと既存案件は変えません。変更内容を確認して確定します。</DialogDescription></DialogHeader>
        {editor && <fieldset disabled={!!approved || update.isPending} className="space-y-4">
          <p className="text-xs">対象会社ID: {editor.company.id} ／ 対応中 {editor.company.activeCases}件</p>
          <div className="space-y-2"><Label htmlFor="company-name">登録会社名</Label><Input id="company-name" value={editor.name} maxLength={255} onChange={e => setEditor({ ...editor, name: e.target.value })} /></div>
          <label className="flex items-center gap-2"><Checkbox checked={editor.isActive} onCheckedChange={v => setEditor({ ...editor, isActive: v === true })} />新規割当候補として有効にする</label>
          <p className="text-xs text-muted-foreground">無効化しても既存担当のログイン権限は残ります。権限を外す場合はログイン担当を「未紐付け」に変更してください。</p>
          <div className="space-y-2"><Label htmlFor="company-user">ログイン担当</Label><Select value={editor.userId === null ? 'none' : String(editor.userId)} onValueChange={v => setEditor({ ...editor, userId: v === 'none' ? null : Number(v) })}>
            <SelectTrigger id="company-user"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未紐付け（担当ログインを解除）</SelectItem>{people.filter(p => p.role === 'partner' || p.id === editor.company.userId).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name || '名称未設定'}（ID {p.id}）</SelectItem>)}</SelectContent>
          </Select></div>
          <p className="text-xs text-muted-foreground">別会社の紐付け・利用者区分は変更しません。社員／管理者を指定する場合は先に利用者区分を確認してください。</p>
          <div className="space-y-2"><Label htmlFor="company-reason">変更理由（3文字以上）</Label><Textarea id="company-reason" value={editor.reason} maxLength={500} onChange={e => setEditor({ ...editor, reason: e.target.value })} /></div>
        </fieldset>}
        {error && !approved && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={update.isPending} onClick={() => setEditor(null)}>キャンセル</Button><Button disabled={!valid || update.isPending} onClick={requestConfirmation}>内容を確認</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!approved} onOpenChange={open => { if (!open && !update.isPending) setApproved(null); }}><AlertDialogContent className="max-h-[90vh] overflow-y-auto"><AlertDialogHeader><AlertDialogTitle>会社情報・ログイン担当の変更を確定しますか？</AlertDialogTitle><AlertDialogDescription>担当ログインの変更は既存担当案件の編集権限にも反映されます。</AlertDialogDescription></AlertDialogHeader>
      {approved && <div className="space-y-3 break-words text-sm"><p>会社ID：{approved.partnerId}</p><p>登録名：{approved.expected.name} → {approved.next.name}</p><p>ログイン担当：{personName(approved.expected.userId)} → {personName(approved.next.userId)}</p><p>新規割当候補：{approved.expected.isActive ? '有効' : '停止'} → {approved.next.isActive ? '有効' : '停止'}</p><p className="whitespace-pre-wrap">理由：{approved.reason}</p><p className="rounded border border-amber-300 p-3">旧担当者の別会社への紐付けは維持します。役割の自動変更や、案件・写真・報告書の削除は行いません。</p></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={update.isPending}>キャンセル</AlertDialogCancel><Button disabled={update.isPending} onClick={() => approved && update.mutate(approved)}>{update.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />更新中…</> : '変更を確定する'}</Button></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}
