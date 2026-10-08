import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { FileText, Archive, Download, ExternalLink, Loader2, Undo2, MessageSquare } from 'lucide-react';
import { BULK_REPORT_LIMIT } from '../../../shared/reportBulk';

export default function CompletedReports() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: reports = [], isLoading, error } = trpc.cases.listCompletedReports.useQuery();
  const [filterBrand, setFilterBrand] = useState('all');
  const [onlyCompletion, setOnlyCompletion] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'completedAt' | 'storeName'>('completedAt');
  const [rejectTarget, setRejectTarget] = useState<{ id: number; storeName: string | null } | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const rejectMut = trpc.cases.rejectReport.useMutation({
    onSuccess: () => { toast.success('報告書を差し戻しました'); setRejectTarget(null); setRejectComment(''); utils.cases.listCompletedReports.invalidate(); },
    onError: e => toast.error(e.message || '差し戻しに失敗しました'),
  });
  const brands = useMemo(() => Array.from(new Set(reports.map(r => r.brand).filter(Boolean))).sort(), [reports]);
  const filtered = useMemo(() => reports.filter(r => (filterBrand === 'all' || r.brand === filterBrand) && (!onlyCompletion || r.canCompletion))
    .sort((a,b) => sortBy === 'storeName' ? (a.storeName ?? '').localeCompare(b.storeName ?? '') :
      new Date(b.completedAt ?? b.reportCompletedAt ?? 0).getTime() - new Date(a.completedAt ?? a.reportCompletedAt ?? 0).getTime()), [reports,filterBrand,onlyCompletion,sortBy]);
  // 絞り込み後に画面から消えた案件を一括出力へ含めない。
  const selectedVisible = selectedIds.filter(id => filtered.some(r => r.id === id && r.canCompletion));
  const available = filtered.filter(r => r.canCompletion);
  const toggleSelection = (id: number) => {
    if (selectedVisible.includes(id)) setSelectedIds(selectedVisible.filter(v => v !== id));
    else if (selectedVisible.length >= BULK_REPORT_LIMIT) toast.warning(`一度に${BULK_REPORT_LIMIT}件まで選択できます`);
    else setSelectedIds([...selectedVisible,id]);
  };
  const selectVisible = () => setSelectedIds(available.slice(0,BULK_REPORT_LIMIT).map(r => r.id));
  const formatDate = (value: Date | null) => value ? new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}) : '—';
  if (isLoading) return <div className="flex items-center justify-center gap-2 py-12" role="status"><Loader2 className="h-6 w-6 animate-spin" />読み込み中…</div>;
  if (error) return <p role="alert" className="text-destructive">{error.message}</p>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">完了報告書一覧</h1><p className="text-sm text-muted-foreground mt-1">工事完了案件を選択して、複数の完了報告書を1つのPDFにまとめて出力できます。</p></div>
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => setLocation('/reports/bulk')}><Archive className="h-4 w-4 mr-2" />現調・完了の一括PDF／ZIP</Button><Badge variant="outline">{filtered.length}件</Badge></div>
    </div>
    <div className="flex items-center gap-3 flex-wrap">
      <label className="text-sm">ブランド <select aria-label="報告書ブランド" className="border rounded-md bg-background px-2 py-1" value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setSelectedIds([]); }}><option value="all">全ブランド</option>{brands.map(b => <option key={b} value={b!}>{b}</option>)}</select></label>
      <label className="text-sm">並び替え <select className="border rounded-md bg-background px-2 py-1" value={sortBy} onChange={e => setSortBy(e.target.value as 'completedAt' | 'storeName')}><option value="completedAt">完了日（新しい順）</option><option value="storeName">店舗名</option></select></label>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={onlyCompletion} onCheckedChange={v => { setOnlyCompletion(!!v); setSelectedIds([]); }} />工事完了案件のみ（完了報告書の対象）</label>
    </div>
    <Card><CardContent className="pt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3"><span className="font-medium text-sm">完了報告書を選択：{selectedVisible.length} / {BULK_REPORT_LIMIT}件</span>
        <Button disabled={selectedVisible.length < 2} onClick={() => setLocation(`/reports/bulk?reportType=completion&caseIds=${selectedVisible.join(',')}`)}><Download className="h-4 w-4 mr-2" />選択した完了報告書を一括PDF出力</Button>
        <Button variant="outline" size="sm" disabled={!available.length} onClick={selectVisible}>表示中から最大{BULK_REPORT_LIMIT}件を選択</Button>
        <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>選択解除</Button>
      </div>
      <p className="text-xs text-muted-foreground">2〜{BULK_REPORT_LIMIT}件を選択。全件プレビューを確認後、1つのPDFで保存できます。個別PDFをZIPで保存する形式も選べます。個別の生成履歴も残します。工事未完了の現調報告書は完了報告書として選択できません。</p>
    </CardContent></Card>
    {filtered.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>選択条件に一致する完了報告書の対象案件はありません</p></CardContent></Card> :
      <div className="border rounded-lg overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>
        <th className="px-3 py-3"><Checkbox aria-label="表示中の完了報告書を選択" checked={available.length > 0 && selectedVisible.length === Math.min(available.length,BULK_REPORT_LIMIT) ? true : selectedVisible.length ? 'indeterminate' : false} disabled={!available.length} onCheckedChange={v => v ? selectVisible() : setSelectedIds([])} /></th>
        {['店舗名','依頼番号','ブランド','工事完了日','報告書作成','操作'].map(label => <th key={label} className="text-left px-4 py-3 font-medium whitespace-nowrap">{label}</th>)}
      </tr></thead><tbody className="divide-y">{filtered.map(report => <tr key={report.id} className="hover:bg-muted/30">
        <td className="px-3 py-3"><Checkbox aria-label={`${report.requestNumber}の完了報告書を選択`} checked={selectedVisible.includes(report.id)} disabled={!report.canCompletion} onCheckedChange={() => toggleSelection(report.id)} /></td>
        <td className="px-4 py-3 font-medium">{report.storeName}</td><td className="px-4 py-3 text-muted-foreground">{report.requestNumber}</td><td className="px-4 py-3"><Badge variant="secondary">{report.brand}</Badge></td>
        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(report.completedAt)}{report.canCompletion && !report.completedAt && <p className="text-xs">ステータスは完了・完了日は未入力</p>}</td>
        <td className="px-4 py-3"><Badge variant={report.reportStatus === 'completed' ? 'default' : 'outline'}>{report.reportStatus === 'completed' ? '作成完了' : '未完了'}</Badge><p className="text-xs mt-1 text-muted-foreground">{report.reportCompletedBy ?? '—'} · {formatDate(report.reportCompletedAt)}</p></td>
        <td className="px-4 py-3"><div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation(`/cases/${report.id}/${report.canCompletion ? 'completion-report' : 'survey-report'}`)}><ExternalLink className="h-3.5 w-3.5 mr-1" />開く</Button>
          <Button size="sm" onClick={() => setLocation(`/cases/${report.id}/${report.canCompletion ? 'completion-report' : 'survey-report'}`)}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
          <Button variant="destructive" size="sm" disabled={report.reportStatus !== 'completed'} onClick={() => setRejectTarget({id:report.id,storeName:report.storeName})}><Undo2 className="h-3.5 w-3.5 mr-1" />差し戻し</Button>
        </div></td>
      </tr>)}</tbody></table></div>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[
      ['工事完了案件',reports.filter(r => r.canCompletion).length],['報告書作成完了',reports.filter(r => r.reportStatus === 'completed').length],['選択中',selectedVisible.length],
    ].map(([label,n]) => <Card key={label}><CardContent className="py-4"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-bold mt-1">{n}件</div></CardContent></Card>)}</div>
    {rejectTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="bg-background text-foreground rounded-lg p-6 max-w-md mx-4 shadow-xl w-full">
      <h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><MessageSquare className="h-5 w-5 text-destructive" />報告書を差し戻す</h3><p className="text-sm mb-4">{rejectTarget.storeName}の報告書への修正依頼コメントを入力してください。</p>
      <Textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} placeholder="写真の順番や所感の修正内容" rows={3} className="mb-4" />
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setRejectTarget(null); setRejectComment(''); }}>キャンセル</Button><Button variant="destructive" disabled={!rejectComment.trim() || rejectMut.isPending} onClick={() => rejectMut.mutate({caseId:rejectTarget.id,comment:rejectComment})}>{rejectMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}差し戻す</Button></div>
    </div></div>}
  </div>;
}
