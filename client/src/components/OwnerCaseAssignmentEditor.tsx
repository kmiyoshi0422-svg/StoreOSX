import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { canAccessPrefecture } from '@shared/accessPolicy';
import { toast } from 'sonner';
import { Settings2, Loader2 } from 'lucide-react';
import type { Case } from '../../../drizzle/schema';

type Values={assigneeId:number|null,partnerId:number|null,contractorName:string|null,contractorPic:string|null,contractorPhone:string|null};
const snapshot=(c:Case):Values=>({assigneeId:c.assigneeId??null,partnerId:c.partnerId??null,contractorName:c.contractorName??null,contractorPic:c.contractorPic??null,contractorPhone:c.contractorPhone??null});
export function OwnerCaseAssignmentEditor({caseData,onUpdated}:{caseData:Case,onUpdated:()=>void}){
  const {user}=useAuth(); const utils=trpc.useUtils(); const owner=user?.role==='owner';
  const [open,setOpen]=useState(false);const [before,setBefore]=useState<Values>(snapshot(caseData));const [next,setNext]=useState<Values>(snapshot(caseData));const [reason,setReason]=useState('');
  const [approved,setApproved]=useState<{caseId:number,expected:Values,next:Values,reason:string}|null>(null);
  const candidates=trpc.users.assignable.useQuery(undefined,{enabled:owner&&open});
  const companies=trpc.partners.list.useQuery(undefined,{enabled:owner&&open});
  const history=trpc.ownerPeople.history.useQuery({kind:'case_assignment',targetId:caseData.id},{enabled:owner});
  const mutate=trpc.ownerPeople.changeCaseAssignment.useMutation({onSuccess:async()=>{
    toast.success('担当情報を更新しました');setOpen(false);setApproved(null);
    await Promise.all([utils.cases.invalidate(),utils.internalStaff.invalidate(),utils.responsibility.personal.invalidate(),utils.ownerPeople.invalidate()]);onUpdated();
  },onError:e=>{toast.error(e.message);setApproved(null);}});
  if(!owner)return null;
  const eligible=(candidates.data??[]).filter(c=>canAccessPrefecture(c,caseData.prefecture));
  const peopleName=(id:number|null)=>id===null?'未割当':eligible.find(c=>c.id===id)?.name??`現在の担当者 ID:${id}`;
  const companyName=(id:number|null)=>id===null?'未選択':companies.data?.find(c=>c.id===id)?.name??`会社 ID:${id}`;
  const busy=mutate.isPending;const error=candidates.isError||companies.isError;
  return <div className="space-y-3 border-t pt-4">
    <Button variant="outline" className="w-full sm:w-auto whitespace-normal h-auto min-h-9 py-2" onClick={()=>{setBefore(snapshot(caseData));setNext(snapshot(caseData));setReason('');setOpen(true);}}><Settings2 className="mr-2 h-4 w-4"/>担当情報を変更（最高管理者）</Button>
    <p className="text-xs text-muted-foreground">社内担当者と取引先の担当者は別です。会社マスタを選択しても、下段の記載は自動で書き換えません。</p>
    {!!history.data?.length&&<details className="text-xs"><summary className="cursor-pointer">最高管理者の担当変更履歴</summary><div className="mt-2 space-y-2">{history.data.map(log=><p key={log.id} className="break-words">{new Date(log.changedAt).toLocaleString('ja-JP')} ／ {log.changedByName} ／ {log.reason}</p>)}</div></details>}
    <Dialog open={open} onOpenChange={value=>{if(!busy&&!approved)setOpen(value);}}><DialogContent className="max-h-[88vh] overflow-y-auto"><DialogHeader><DialogTitle>担当情報の変更</DialogTitle><DialogDescription>{caseData.storeName} ／ {caseData.requestNumber}。元の依頼PDF・案件責任者・進捗・金額は変更しません。</DialogDescription></DialogHeader>
      {error?<div role="alert">候補を取得できませんでした。<Button variant="outline" onClick={()=>{void candidates.refetch();void companies.refetch();}}>再取得</Button></div>:<div className="space-y-4">
        <div className="space-y-1"><Label>社内担当者（ログイン利用者）</Label><Select value={next.assigneeId===null?'none':String(next.assigneeId)} disabled={busy||!!approved||candidates.isLoading} onValueChange={v=>setNext(n=>({...n,assigneeId:v==='none'?null:Number(v)}))}><SelectTrigger aria-label="変更する社内担当者"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">未割当（解除）</SelectItem>{next.assigneeId!==null&&!eligible.some(c=>c.id===next.assigneeId)&&<SelectItem value={String(next.assigneeId)} disabled>現在の担当者（候補外）ID:{next.assigneeId}</SelectItem>}{eligible.map(c=><SelectItem key={c.id} value={String(c.id)} disabled={c.canAssign===false}>{c.name??`ID:${c.id}`}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>協力会社・マスタ連携</Label><Select value={next.partnerId===null?'none':String(next.partnerId)} disabled={busy||!!approved||companies.isLoading} onValueChange={v=>setNext(n=>({...n,partnerId:v==='none'?null:Number(v)}))}><SelectTrigger aria-label="変更する協力会社"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">未選択（解除）</SelectItem>{(companies.data??[]).map(p=><SelectItem key={p.id} value={String(p.id)} disabled={!p.isActive&&p.id!==before.partnerId}>{p.name}{!p.isActive?'（非アクティブ）':''}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 border-t pt-3"><p className="text-sm font-semibold">システム記載の取引先（この案件だけの訂正）</p>
          <Label htmlFor="owner-company">協力会社名</Label><Input id="owner-company" maxLength={255} value={next.contractorName??''} disabled={busy||!!approved} onChange={e=>setNext(n=>({...n,contractorName:e.target.value}))}/>
          <Label htmlFor="owner-contact">取引先の担当者名</Label><Input id="owner-contact" maxLength={128} value={next.contractorPic??''} disabled={busy||!!approved} onChange={e=>setNext(n=>({...n,contractorPic:e.target.value}))}/>
          <Label htmlFor="owner-phone">取引先の連絡先</Label><Input id="owner-phone" type="tel" maxLength={32} value={next.contractorPhone??''} disabled={busy||!!approved} onChange={e=>setNext(n=>({...n,contractorPhone:e.target.value}))}/>
        </div>
        <div className="space-y-1"><Label htmlFor="owner-assignment-reason">変更理由（3文字以上）</Label><Input id="owner-assignment-reason" maxLength={500} value={reason} disabled={busy||!!approved} onChange={e=>setReason(e.target.value)}/></div>
      </div>}
      <DialogFooter><Button variant="outline" disabled={busy||!!approved} onClick={()=>setOpen(false)}>キャンセル</Button><Button disabled={busy||error||candidates.isLoading||companies.isLoading||reason.trim().length<3||!!approved} onClick={()=>setApproved({caseId:caseData.id,expected:{...before},next:{...next},reason:reason.trim()})}>変更内容を確認</Button></DialogFooter>
    </DialogContent></Dialog>
    <AlertDialog open={approved!==null} onOpenChange={value=>{if(!value&&!busy)setApproved(null);}}><AlertDialogContent className="max-h-[85vh] overflow-y-auto"><AlertDialogHeader><AlertDialogTitle>この案件の担当情報を変更しますか？</AlertDialogTitle><AlertDialogDescription>会社マスタ・元PDF・既存の報告書は書き換えません。変更前後と理由を記録します。</AlertDialogDescription></AlertDialogHeader>
      {approved&&<div className="space-y-2 text-sm break-words"><p>案件：{caseData.storeName} ／ {caseData.requestNumber}</p><p>社内担当：{peopleName(approved.expected.assigneeId)} → {peopleName(approved.next.assigneeId)}</p><p>マスタ：{companyName(approved.expected.partnerId)} → {companyName(approved.next.partnerId)}</p><p>会社記載：{approved.expected.contractorName||'未設定'} → {approved.next.contractorName||'未設定'}</p><p>担当者記載：{approved.expected.contractorPic||'未設定'} → {approved.next.contractorPic||'未設定'}</p><p>電話：{approved.expected.contractorPhone||'未設定'} → {approved.next.contractorPhone||'未設定'}</p><p>理由：{approved.reason}</p></div>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>戻る</AlertDialogCancel><Button disabled={busy} onClick={()=>approved&&mutate.mutate(approved)}>{busy?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>保存中…</>:'確認して変更'}</Button></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}
