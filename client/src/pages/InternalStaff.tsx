import { useMemo, useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { canManageCases } from '@shared/accessPolicy';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, Users, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';

type Target = {key:string;name:string;scope:'active'|'all'};
export default function InternalStaff() {
  const {user,loading}=useAuth();const allowed=!!user&&canManageCases(user.role);
  const [search,setSearch]=useState(''),[target,setTarget]=useState<Target|null>(null),[page,setPage]=useState(1);
  const summary=trpc.internalStaff.summary.useQuery(undefined,{enabled:allowed,refetchInterval:60000});
  const details=trpc.internalStaff.assignments.useQuery({staffKey:target?.key??'',scope:target?.scope??'active'},{enabled:allowed&&target!==null,refetchInterval:60000});
  const rows=useMemo(()=>summary.data?.rows.filter(x=>x.name.includes(search.trim()))??[],[summary.data,search]);
  const current=rows.filter(x=>!x.legacy),legacy=rows.filter(x=>x.legacy);
  const selectedRows=details.data??[];const pages=Math.max(1,Math.ceil(selectedRows.length/30));const safePage=Math.min(page,pages);
  function open(row:{key:string;name:string},scope:'active'|'all'){setPage(1);setTarget({...row,scope});}
  if(loading)return <div role="status" className="p-8">読み込み中…</div>;
  if(!allowed)return <div className="space-y-3 p-8"><h1 className="text-xl font-semibold">社内担当者一覧</h1><p>社員以上のみ閲覧できます。</p><Link href="/">ダッシュボードへ戻る</Link></div>;
  function personCard(row:NonNullable<typeof summary.data>['rows'][number]) {return <Card key={row.key} data-staff-key={row.key}><CardContent className="space-y-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-semibold">{row.name}</h2>{row.pending?<Badge variant="outline">初回ログイン待ち</Badge>:row.legacy?<Badge variant="outline">新規割当候補外</Badge>:<Badge variant="secondary">社内担当者</Badge>}</div>
    <div className="grid grid-cols-2 gap-3"><button className="rounded-lg bg-primary/10 p-3 text-left hover:bg-primary/15 focus-visible:outline focus-visible:outline-2" aria-label={`${row.name}の対応中案件を確認`} onClick={()=>open(row,'active')}><span className="block text-xs text-muted-foreground">対応中の担当案件</span><span className="text-3xl font-semibold tabular-nums">{row.active}</span><span className="ml-1 text-sm">件</span></button><button className="rounded-lg bg-muted p-3 text-left hover:bg-muted/70 focus-visible:outline focus-visible:outline-2" aria-label={`${row.name}の全担当案件を確認`} onClick={()=>open(row,'all')}><span className="block text-xs text-muted-foreground">全担当案件</span><span className="text-3xl font-semibold tabular-nums">{row.total}</span><span className="ml-1 text-sm">件</span></button></div>
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span>完了・クローズ {row.completed}件</span><span>失注 {row.lost}件</span>{row.userIds.length>1&&<span>本人確認済み {row.userIds.length}アカウントを合算</span>}</div>
    {row.pending&&<p className="text-xs text-muted-foreground">初回ログイン後に作業担当として割り当て可能になります。案件責任者の件数は含みません。</p>}
  </CardContent></Card>;}
  return <div className="mx-auto max-w-6xl space-y-5" aria-label="社内担当者一覧">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Users className="h-6 w-6"/>社内担当者一覧</h1><p className="mt-1 text-sm text-muted-foreground">作業担当者の現在の担当件数です。案件責任者とは別に集計します。</p></div><Button variant="outline" disabled={summary.isFetching} onClick={()=>{void summary.refetch();if(target)void details.refetch();}}><RefreshCw className={`mr-2 h-4 w-4 ${summary.isFetching?'animate-spin':''}`}/>{summary.isFetching?'更新中…':'最新の件数に更新'}</Button></div>
    <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed"><strong>対応中</strong>＝完了・クローズ・失注以外。<strong>全担当</strong>には過去の完了・失注も含みます。件数を押すと対象案件を確認できます。<br/>{summary.data?.areaLimited?'表示・集計はあなたの許可エリア内だけです。':'表示・集計は閲覧を許可された全エリアです。'}<br/>{summary.data&&<>未割当の対応中案件：<strong>{summary.data.unassignedActive}件</strong> ／ 更新 {new Date(summary.data.updatedAt).toLocaleTimeString('ja-JP')}</>}</div>
    <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="担当者名で検索" aria-label="担当者名で検索" className="max-w-sm"/>
    {summary.isError&&<div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm">件数を取得できませんでした。{summary.error.message} <Button variant="outline" size="sm" onClick={()=>void summary.refetch()}>再試行</Button></div>}
    {summary.isLoading?<div role="status" className="flex items-center gap-2 p-8"><Loader2 className="h-4 w-4 animate-spin"/>担当件数を集計中…</div>:<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{current.map(personCard)}</div>{legacy.length>0&&<section className="space-y-3"><h2 className="text-sm font-semibold text-muted-foreground">候補外の既存担当（引継ぎ確認用）</h2><p className="text-xs text-muted-foreground">新規割当の候補には表示しません。既存担当は自動で解除・変更していません。</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{legacy.map(personCard)}</div></section>}{rows.length===0&&!summary.isError&&<p className="p-8 text-center text-muted-foreground">該当する担当者はいません。</p>}</>}
    <Dialog open={target!==null} onOpenChange={open=>{if(!open)setTarget(null);}}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{target?.name}：{target?.scope==='active'?'対応中':'全担当'}案件</DialogTitle></DialogHeader>
      {details.isLoading?<p role="status">案件を読み込み中…</p>:details.isError?<p role="alert">取得できませんでした。{details.error.message}</p>:<><p className="text-sm text-muted-foreground">{selectedRows.length}件（許可エリア内の作業担当）</p><div className="space-y-2">{selectedRows.slice((safePage-1)*30,safePage*30).map(row=><Link key={row.id} href={`/cases/${row.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent"><div className="min-w-0"><p className="break-words font-medium">{row.storeName}</p><p className="text-xs text-muted-foreground">{row.requestNumber} ／ {row.prefecture}</p><div className="mt-1 flex flex-wrap gap-1"><Badge variant="outline">{row.status}</Badge><Badge variant="secondary">{row.progressStage??'未対応'}</Badge></div></div><ChevronRight className="h-4 w-4 shrink-0"/></Link>)}</div>{selectedRows.length===0&&<p className="py-6 text-center text-muted-foreground">この区分の担当案件はありません。</p>}{pages>1&&<div className="flex items-center justify-between"><Button variant="outline" disabled={safePage<=1} onClick={()=>setPage(safePage-1)}>前へ</Button><span className="text-xs">{safePage} / {pages}</span><Button variant="outline" disabled={safePage>=pages} onClick={()=>setPage(safePage+1)}>次へ</Button></div>}</>}
    </DialogContent></Dialog>
  </div>;
}
