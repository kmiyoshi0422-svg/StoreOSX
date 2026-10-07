import { useEffect, useState } from "react";
import type { Case } from "../../../drizzle/schema";
import { isEmergencySurveyCase, jstCalendarDay, sameDaySurveyLabel } from "../../../shared/emergencySurveyDate";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const evidenceNames = {
  completion_report: "完了報告書",
  survey_report: "現調報告書",
  staff_confirmation: "担当者への確認",
  other: "その他の記録",
} as const;
type EvidenceType = keyof typeof evidenceNames;

export function EmergencySurveyDateCard({ caseData, onUpdated }: { caseData: Case; onUpdated: () => void }) {
  const eligible = isEmergencySurveyCase(caseData);
  const currentDay = jstCalendarDay(caseData.surveyDate);
  const [date, setDate] = useState(currentDay ?? "");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("completion_report");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();
  const { data: history = [] } = trpc.cases.emergencySurveyDateHistory.useQuery({ id: caseData.id }, { enabled: eligible });
  const save = trpc.cases.setEmergencySurveyDate.useMutation({
    onSuccess: async (result) => {
      toast.success(result.changed ? "現調実施日と変更履歴を保存しました" : "日付に変更はありません");
      if (result.changed) setNote("");
      await utils.cases.emergencySurveyDateHistory.invalidate({ id: caseData.id });
      await utils.cases.list.invalidate();
      onUpdated();
    },
    onError: (error) => toast.error(error.message),
  });
  useEffect(() => setDate(currentDay ?? ""), [currentDay, caseData.id]);
  if (!eligible) return null;
  const requestDay = jstCalendarDay(caseData.requestDate);
  const sameDay = sameDaySurveyLabel(caseData.requestDate, caseData.surveyDate);
  const canSave = date && date !== currentDay && note.trim().length >= 5 && date <= (jstCalendarDay(new Date()) ?? "");
  const canClear = currentDay && note.trim().length >= 5;
  const dateDisplay = (value: Date | string | null) => jstCalendarDay(value) ?? "未登録";
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-serif-jp font-semibold">緊急案件の現地対応日（現調実施日）</h3>
          <p className="text-xs text-muted-foreground mt-1">実際に現地調査した日だけを入力してください。依頼日からの自動補完はしません。施工・完了ステータスも変更しません。</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">依頼日</span><p className="font-medium">{requestDay ?? "未登録"}</p></div>
          <div><span className="text-muted-foreground">現調実施日</span><p className="font-medium">{currentDay ?? "未登録"}</p></div>
          <div><span className="text-muted-foreground">依頼日との比較</span><p className="font-medium">{sameDay === "判定不可" ? "日付未登録・判定不可" : sameDay === "同日" ? "当日現調（登録日付に基づく）" : "別日対応"}</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor={`survey-date-${caseData.id}`}>実際の現調実施日</Label><Input id={`survey-date-${caseData.id}`} className="mt-1" type="date" max={jstCalendarDay(new Date()) ?? undefined} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label>確認根拠の種類</Label><Select value={evidenceType} onValueChange={v => setEvidenceType(v as EvidenceType)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(evidenceNames).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div><Label htmlFor={`survey-evidence-${caseData.id}`}>根拠・確認内容（必須、5文字以上）</Label><Textarea id={`survey-evidence-${caseData.id}`} className="mt-1" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="例：完了報告書の現調欄を確認。記録の名称と該当日を記入" rows={2} /><p className="text-xs text-muted-foreground mt-1">選択した資料や担当者から実際の日付を確認して入力してください。資料未確認の一括入力はしないでください。</p></div>
        <div className="flex flex-wrap gap-2"><Button disabled={!canSave || save.isPending} onClick={() => save.mutate({ id: caseData.id, date, evidenceType, evidenceNote: note.trim() })}>現調実施日を保存</Button>{currentDay && <Button variant="outline" disabled={!canClear || save.isPending} onClick={() => { if (window.confirm("現調実施日を解除しますか？解除理由を履歴に残します。")) save.mutate({ id: caseData.id, date: null, evidenceType, evidenceNote: note.trim() }); }}>誤登録を解除</Button>}</div>
        {history.length > 0 && <div className="border-t pt-3 space-y-1"><p className="text-xs font-medium">変更履歴（新しい順）</p>{history.slice(0, 5).map(row => <p key={row.id} className="text-xs text-muted-foreground break-words">{new Date(row.recordedAt).toLocaleString("ja-JP")}　{row.recordedByName}：{dateDisplay(row.beforeDate)} → {dateDisplay(row.afterDate)}／{evidenceNames[row.evidenceType]}／{row.evidenceNote}</p>)}</div>}
      </CardContent>
    </Card>
  );
}
