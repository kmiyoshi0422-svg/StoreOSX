import { useEffect, useState } from "react";
import type { Case } from "../../../drizzle/schema";
import { isEmergencySurveyCase, jstCalendarDay } from "../../../shared/emergencySurveyDate";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";

type DateCase = Pick<Case, "id" | "urgency" | "requestContent" | "categoryLarge" | "categoryMedium" | "categorySmall" | "firstResponseDate" | "responsePlannedDate">;

export function CaseResponseDateEditor({ item, canEdit, onUpdated }: { item: DateCase; canEdit: boolean; onUpdated: () => void }) {
  const emergency = isEmergencySurveyCase(item);
  const kind = emergency ? "first_response" as const : "planned_response" as const;
  const current = jstCalendarDay(emergency ? item.firstResponseDate : item.responsePlannedDate);
  const label = emergency ? "初回対応日（実績）" : "対応予定日";
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(current ?? "");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();
  const { data: history = [] } = trpc.cases.responseDateHistory.useQuery({ id: item.id }, { enabled: open && canEdit });
  const save = trpc.cases.setResponseDate.useMutation({
    onSuccess: async ({ changed }) => {
      toast.success(changed ? `${label}を記録しました` : "日付に変更はありません");
      await utils.cases.responseDateHistory.invalidate({ id: item.id });
      if (changed) {
        await utils.cases.listSummary.invalidate();
        await utils.cases.get.invalidate({ id: item.id });
        onUpdated();
      }
      setNote("");
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });
  useEffect(() => setDate(current ?? ""), [current, item.id, kind]);
  const noteRequired = emergency && note.trim().length < 5;
  const today = jstCalendarDay(new Date()) ?? "";
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && (!emergency || date <= today);
  const submit = (value: string | null) => save.mutate({ id: item.id, kind, date: value, note: note.trim() });

  const summary = <span className="inline-flex items-center gap-1.5 text-xs"><CalendarDays className="h-3.5 w-3.5" /><span>{label}：{current ?? "未入力"}</span></span>;
  if (!canEdit) return <span className="text-muted-foreground">{summary}</span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs bg-background" aria-label={`${label}を入力・変更`} onClick={e => e.stopPropagation()}>
          {summary}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] space-y-3" onClick={e => e.stopPropagation()}>
        <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground mt-1">{emergency ? "連絡・手配など、最初に実際に対応した日。現調実施日・完了日とは別です。" : "これから対応する予定の日。施工予定日・完了日とは別です。"}</p></div>
        <div className="space-y-1"><Label htmlFor={`response-date-${item.id}`}>{label}</Label><Input id={`response-date-${item.id}`} type="date" max={emergency ? today : undefined} value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor={`response-note-${item.id}`}>{emergency ? "確認根拠（必須・5文字以上）" : "変更理由・補足（任意）"}</Label><Textarea id={`response-note-${item.id}`} value={note} maxLength={500} rows={2} placeholder={emergency ? "例：担当者の当日電話記録を確認" : "例：担当者と予定調整済み"} onChange={e => setNote(e.target.value)} /></div>
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={save.isPending || !validDate || date === current || noteRequired} onClick={() => submit(date)}>保存</Button>{current && <Button size="sm" variant="outline" disabled={save.isPending || noteRequired} onClick={() => submit(null)}>日付を解除</Button>}</div>
        {history.length > 0 && <div className="border-t pt-2 space-y-1 max-h-36 overflow-y-auto"><p className="text-xs font-medium">変更履歴</p>{history.slice(0, 5).map(row => <p key={row.id} className="text-xs text-muted-foreground break-words">{new Date(row.recordedAt).toLocaleString("ja-JP")} {row.recordedByName}：{jstCalendarDay(row.beforeDate) ?? "未入力"} → {jstCalendarDay(row.afterDate) ?? "未入力"}（{row.kind === "first_response" ? "初回対応" : "予定"}）{row.note && `／${row.note}`}</p>)}</div>}
      </PopoverContent>
    </Popover>
  );
}
