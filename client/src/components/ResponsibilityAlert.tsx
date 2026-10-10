import { trpc } from '@/lib/trpc';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card,CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CaseResponsibilitySelect } from './CaseResponsibilitySelect';
import { useLocation } from 'wouter';
import { useState } from 'react';
export function ResponsibilityAlert(){
 const [,navigate]=useLocation();const [page,setPage]=useState(1);
 const {data,error,isLoading,refetch}=trpc.responsibility.alerts.useQuery(undefined,{refetchInterval:60_000});
 if(isLoading)return null;
 if(error)return <div className="text-sm text-muted-foreground">責任者アラートを取得できませんでした。<Button size="sm" variant="ghost" onClick={()=>refetch()}>再取得</Button></div>;
 if(!data?.eligible||!data.count)return null;
 const pages=Math.ceil(data.rows.length/10),current=Math.min(page,pages);
 return <Card className="border-orange-300 bg-orange-50/40" role="alert" aria-label="案件責任者未決定アラート"><CardContent className="p-4 md:p-5 space-y-4">
  <div className="flex items-start gap-3"><AlertTriangle className="h-5 w-5 text-orange-700 shrink-0 mt-0.5"/><div><h2 className="font-semibold text-orange-900">担当者をきめてください — 案件責任者未決定 {data.count}件</h2><p className="text-xs text-muted-foreground mt-1">依頼日2026年10月1日以降・登録から5日経過。木原・野口・河野・三好・新藤のいずれかを責任者に決定してください。現在の作業担当者は変更しません。</p></div></div>
  {data.rows.slice((current-1)*10,current*10).map(row=><div key={row.id} className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between border-t border-orange-200/60 pt-3"><button className="text-left min-w-0" onClick={()=>navigate(`/cases/${row.id}`)}><span className="text-xs font-mono text-muted-foreground">{row.requestNumber} · 登録後{row.elapsedDays}日</span><p className="font-medium text-sm">{row.storeName} · {row.status}</p></button><CaseResponsibilitySelect caseId={row.id} current={row.responsibleOfficer} compact /></div>)}
  {pages>1&&<div className="flex gap-2 justify-end items-center text-xs"><span>{current} / {pages}ページ</span><Button size="sm" variant="outline" disabled={current===1} onClick={()=>setPage(current-1)}>前へ</Button><Button size="sm" variant="outline" disabled={current===pages} onClick={()=>setPage(current+1)}>次へ</Button></div>}
 </CardContent></Card>;
}
