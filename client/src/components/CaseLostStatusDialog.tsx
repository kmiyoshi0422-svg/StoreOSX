import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { LOST_REASON_OPTIONS, type LostReason } from "@shared/caseLost";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function LostReasonChoices({ value, onChange, disabled = false }: { value: LostReason; onChange: (value: LostReason) => void; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="space-y-2">
    <legend className="text-sm font-medium mb-2">失注理由</legend>
    {LOST_REASON_OPTIONS.map(option => <label key={option.value} className={`flex items-center gap-3 rounded-lg border p-3 min-h-11 text-sm cursor-pointer ${value === option.value ? "border-primary bg-primary/5" : "border-border"}`}>
      <input type="radio" name="case-lost-reason" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="h-4 w-4 shrink-0 accent-primary" />
      <span>{option.label}</span>
    </label>)}
  </fieldset>;
}

export type CaseLostAction = { caseId: number; requestNumber: string; storeName: string; mode: "lost" | "revive"; status?: string };

export function CaseLostStatusDialog({ action, onClose, onUpdated }: { action: CaseLostAction | null; onClose: () => void; onUpdated: (status: string) => void }) {
  const [reason, setReason] = useState<LostReason>("高額なため");
  const [detail, setDetail] = useState("");
  const utils = trpc.useUtils();
  useEffect(() => { setReason("高額なため"); setDetail(""); }, [action]);
  const refresh = (status: string) => {
    utils.cases.invalidate(); utils.dashboard.invalidate(); utils.responsibility.invalidate();
    utils.internalStaff.invalidate(); utils.reportBulk.invalidate(); onUpdated(status); onClose();
  };
  const markLost = trpc.dashboard.markCaseLost.useMutation({
    onSuccess: result => { toast.success("失注にしました。失注前の状態へ復活できます"); refresh(result.status); },
    onError: error => toast.error(error.message),
  });
  const revive = trpc.dashboard.reviveLostCase.useMutation({
    onSuccess: result => { toast.success(`案件を「${result.status}」へ復活しました`); refresh(result.status); },
    onError: error => toast.error(error.message),
  });
  const busy = markLost.isPending || revive.isPending;
  const submit = () => {
    if (!action || busy) return;
    if (action.mode === "revive") { revive.mutate({ caseId: action.caseId }); return; }
    if (reason === "その他" && !detail.trim()) return;
    markLost.mutate({ caseId: action.caseId, reason, reasonDetail: detail.trim() || null });
  };
  return <Dialog open={Boolean(action)} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
      <DialogHeader><DialogTitle>{action?.mode === "revive" ? "失注案件を復活する" : "案件を失注にする"}</DialogTitle>
        <DialogDescription>{action?.requestNumber} / {action?.storeName}<br />
          {action?.mode === "revive" ? "失注前のステータスへ戻します。担当者・予定日・写真は変更しません。" : "理由を記録して要対応一覧から外します。キャンセルした場合は変更しません。後から復活できます。"}
        </DialogDescription>
      </DialogHeader>
      {action?.mode === "lost" && <div className="space-y-4">
        <LostReasonChoices value={reason} onChange={setReason} disabled={busy} />
        <div><Label htmlFor="case-lost-detail">補足{reason === "その他" ? "（必須）" : "（任意）"}</Label>
          <Textarea id="case-lost-detail" rows={3} maxLength={1000} value={detail} onChange={e => setDetail(e.target.value)} disabled={busy} className="mt-2" placeholder="理由や再提出時の注意点を入力" />
          <p className="text-xs text-muted-foreground mt-1">{detail.length}/1000文字</p>
        </div>
      </div>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>キャンセル</Button>
        <Button type="button" onClick={submit} disabled={busy || !action || (action.mode === "lost" && reason === "その他" && !detail.trim())}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{busy ? "保存中..." : action?.mode === "revive" ? "復活する" : "失注にする"}
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}
