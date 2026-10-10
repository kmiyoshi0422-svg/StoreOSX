import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { RESPONSIBLE_OFFICERS, type ResponsibleOfficerKey } from '@shared/caseResponsibility';
import { toast } from 'sonner';
export function CaseResponsibilitySelect({caseId,current,onUpdated,compact=false}:{caseId:number;current:string|null|undefined;onUpdated?:()=>void;compact?:boolean}){
 const utils=trpc.useUtils();
 const mutation=trpc.responsibility.set.useMutation({onSuccess:()=>{toast.success('案件責任者を決定しました');utils.responsibility.alerts.invalidate();utils.responsibility.personal.invalidate();utils.cases.listSummary.invalidate();utils.cases.get.invalidate({id:caseId});utils.responsibility.history.invalidate({caseId});onUpdated?.();},onError:error=>toast.error(error.message)});
 return <Select value={current??'__pending__'} disabled={mutation.isPending} onValueChange={value=>{if(value!==current&&value!=='__pending__')mutation.mutate({caseId,officerKey:value as ResponsibleOfficerKey});}}>
  <SelectTrigger aria-label="案件責任者を選択" onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} className={compact?'h-8 w-full min-w-[145px] max-w-[210px] text-xs bg-background':'w-full bg-background'}><SelectValue placeholder="案件責任者を決めてください"/></SelectTrigger>
  <SelectContent><SelectItem value="__pending__" disabled>責任者未決定</SelectItem>{RESPONSIBLE_OFFICERS.map(x=><SelectItem key={x.key} value={x.key}>{x.name}</SelectItem>)}</SelectContent>
 </Select>;
}
