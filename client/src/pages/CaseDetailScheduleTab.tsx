import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { fileToUprightDataUrl } from "@/lib/imageOrientation";
import { Lightbox, useLightbox } from "@/components/Lightbox";
import {
  syncStatusFromStage,
  syncStageFromStatus,
  type ProgressStage,
  type CaseStatus,
} from "@shared/stageStatus";
import { useLocation } from "wouter";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Trash2,
  FileText,
  ImageIcon,
  ListChecks,
  Info,
  Loader2,
  Phone,
  MapPin,
  Save,
  Download,
  Wallet,
  Users,
  Camera,
  Briefcase,
  Smartphone,
  Receipt,
  Link2,
  Copy,
  Sparkles,
  PenLine,
  Wand2,
  RotateCw,
  RotateCcw,
  Clock,
  CheckSquare,
  CalendarDays,
  Calendar,
  ExternalLink,
  X,
  FolderOpen,
  Plus,
  Folder,
  FileUp,
  Eye,
  Globe,
  Tag,
  Repeat,
  ShieldCheck,
  Minus as MinusIcon,
  Plus as PlusIcon,
  Building2,
  SkipForward,
} from "lucide-react";
import { generateQuotePDF, generateCompletionReportPDF } from "@/lib/documentPdf";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";
import html2canvas from "html2canvas-pro";
import {
  CATEGORY_LARGE_OPTIONS,
  CATEGORY_MEDIUM_OPTIONS,
  recommendPartnerCategories,
} from "../../../shared/checklist-template";
import type { Case, ChecklistItem, Photo } from "../../../drizzle/schema";
import { PREFECTURES, detectPrefecture } from "@shared/prefecture";
import { StoreEquipmentPanel } from "./StoreEquipmentPanel";
import { StoreMasterLinkPanel } from "./StoreMasterLinkPanel";

const STATUS_COLORS: Record<string, string> = {
  受付: "bg-slate-100 text-slate-700 border-slate-200",
  現調中: "bg-amber-50 text-amber-700 border-amber-200",
  見積中: "bg-blue-50 text-blue-700 border-blue-200",
  施工待ち: "bg-purple-50 text-purple-700 border-purple-200",
  施工中: "bg-orange-50 text-orange-700 border-orange-200",
  完了: "bg-emerald-50 text-emerald-700 border-emerald-200",
  クローズ: "bg-zinc-100 text-zinc-600 border-zinc-200",
};
const URGENCY_COLORS: Record<string, string> = {
  S: "bg-red-600 text-white",
  A: "bg-orange-500 text-white",
  B: "bg-yellow-500 text-white",
  C: "bg-emerald-500 text-white",
};
const URGENCY_LABEL: Record<string, string> = { S: "緊急", A: "高", B: "中", C: "低" };

const PHOTO_TYPES = [
  "施工前A",
  "施工前B",
  "施工中",
  "施工後A",
  "施工後B",
  "設置状況",
  "メーカー型番",
  "現調",
  "その他",
] as const;

export default function ScheduleTab({ caseId, caseData }: { caseId: number; caseData: any }) {
  const utils = trpc.useUtils();
  const { data: schedules = [], isLoading } = trpc.schedules.listByCase.useQuery({ caseId });
  const createMut = trpc.schedules.create.useMutation({
    onSuccess: () => { utils.schedules.listByCase.invalidate({ caseId }); toast.success("工程を追加しました"); },
  });
  const updateMut = trpc.schedules.update.useMutation({
    onSuccess: () => { utils.schedules.listByCase.invalidate({ caseId }); },
  });
  const deleteMut = trpc.schedules.delete.useMutation({
    onSuccess: () => { utils.schedules.listByCase.invalidate({ caseId }); toast.success("工程を削除しました"); },
  });

  // ICSカレンダーフィード
  const { data: feedData } = trpc.schedules.getCaseCalendarFeedToken.useQuery({ caseId });
  const generateFeedMut = trpc.schedules.generateCaseCalendarFeedToken.useMutation({
    onSuccess: () => { utils.schedules.getCaseCalendarFeedToken.invalidate({ caseId }); },
  });
  const [showCalendarPanel, setShowCalendarPanel] = useState(false);

  // Export
  const scheduleExportRef = useRef<HTMLDivElement>(null);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);

  const handleExportImage = async () => {
    if (!scheduleExportRef.current) return;
    setExportingImage(true);
    try {
      // Show export header temporarily
      const header = scheduleExportRef.current.querySelector('.export-header') as HTMLElement;
      if (header) header.style.display = 'block';
      const canvas = await html2canvas(scheduleExportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      if (header) header.style.display = 'none';
      const link = document.createElement("a");
      link.download = `工程表_${caseData?.storeName || caseId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("画像をダウンロードしました");
    } catch (e) {
      toast.error("エクスポートに失敗しました");
    } finally {
      setExportingImage(false);
    }
  };

  // Templates
  const { data: templates } = trpc.scheduleTemplates.list.useQuery();
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const saveTemplateMut = trpc.scheduleTemplates.saveFromCase.useMutation({
    onSuccess: () => {
      utils.scheduleTemplates.list.invalidate();
      setShowSaveTemplate(false);
      setTemplateName("");
      toast.success("テンプレートを保存しました");
    },
  });
  const applyTemplateMut = trpc.scheduleTemplates.applyToCase.useMutation({
    onSuccess: () => {
      utils.schedules.listByCase.invalidate({ caseId });
      setShowTemplatePanel(false);
      toast.success("テンプレートを適用しました");
    },
  });
  const deleteTemplateMut = trpc.scheduleTemplates.delete.useMutation({
    onSuccess: () => { utils.scheduleTemplates.list.invalidate(); },
  });

  // AI工程提案
  const suggestMut = trpc.schedules.suggestSchedules.useMutation();
  const [suggestions, setSuggestions] = useState<Array<{ title: string; startDate: string; endDate: string; color: string; memo: string }> | null>(null);
  const [suggestReasoning, setSuggestReasoning] = useState<string>("");

  const handleSuggest = async () => {
    try {
      const result = await suggestMut.mutateAsync({ caseId });
      setSuggestions(result.schedules);
      setSuggestReasoning(result.reasoning);
    } catch (e: any) {
      toast.error(e.message || "AI提案に失敗しました");
    }
  };

  const handleApplySuggestions = async () => {
    if (!suggestions) return;
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      await createMut.mutateAsync({
        caseId,
        title: s.title,
        startDate: s.startDate,
        endDate: s.endDate,
        color: s.color,
        memo: s.memo,
        status: "予定",
        progress: 0,
        orderNo: i,
      });
    }
    setSuggestions(null);
    setSuggestReasoning("");
    toast.success("工程を登録しました");
  };

  const feedUrl = feedData?.token
    ? `${window.location.origin}/api/calendar/feed/${feedData.token}.ics`
    : null;

  const googleCalendarSubscribeUrl = feedUrl
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl.replace(/^https?:\/\//, ""))}`
    : null;

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", startDate: "", endDate: "", status: "予定" as "予定" | "進行中" | "完了", color: "#3b82f6", memo: "", progress: 0 });

  const STATUS_COLORS_SCHEDULE: Record<string, string> = {
    "予定": "bg-slate-100 text-slate-700",
    "進行中": "bg-blue-100 text-blue-700",
    "完了": "bg-emerald-100 text-emerald-700",
  };

  const PRESET_COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6"];

  // Gantt chart date range calculation
  const ganttData = useMemo(() => {
    if (schedules.length === 0) return null;
    const allDates = schedules.flatMap(s => [s.startDate, s.endDate]);
    const minDate = allDates.reduce((a, b) => a < b ? a : b);
    const maxDate = allDates.reduce((a, b) => a > b ? a : b);
    // Extend range by 1 day on each side
    const start = new Date(minDate);
    start.setDate(start.getDate() - 1);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 1);
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    return { start, end, totalDays };
  }, [schedules]);

  // Drag state for gantt bars
  const [drag, setDrag] = useState<{
    id: number;
    mode: "move" | "resize-start" | "resize-end";
    startX: number;
    origStartDate: string;
    origEndDate: string;
    containerWidth: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ startDate: string; endDate: string } | null>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  function dateToDayOffset(dateStr: string, ganttStart: Date) {
    return Math.round((new Date(dateStr).getTime() - ganttStart.getTime()) / 86400000);
  }
  function dayOffsetToDate(offset: number, ganttStart: Date) {
    const d = new Date(ganttStart);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  }

  const handleDragStart = useCallback((e: React.PointerEvent | React.MouseEvent, id: number, mode: "move" | "resize-start" | "resize-end", startDate: string, endDate: string) => {
    e.preventDefault();
    e.stopPropagation();
    const container = ganttContainerRef.current;
    if (!container) return;
    const ganttArea = container.querySelector('[data-gantt-area]') as HTMLElement;
    if (!ganttArea) return;
    const containerWidth = ganttArea.getBoundingClientRect().width;
    const clientX = 'clientX' in e ? e.clientX : 0;
    setDrag({ id, mode, startX: clientX, origStartDate: startDate, origEndDate: endDate, containerWidth });
    setDragPreview({ startDate, endDate });
    // Capture pointer for touch support
    if ('pointerId' in e && (e as React.PointerEvent).pointerId) {
      (e.currentTarget as HTMLElement).setPointerCapture((e as React.PointerEvent).pointerId);
    }
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    if (!drag || !ganttData) return;
    const clientX = 'clientX' in e ? e.clientX : 0;
    const deltaX = clientX - drag.startX;
    const deltaDays = Math.round((deltaX / drag.containerWidth) * ganttData.totalDays);
    if (deltaDays === 0 && dragPreview?.startDate === drag.origStartDate) return;

    let newStart = drag.origStartDate;
    let newEnd = drag.origEndDate;

    if (drag.mode === "move") {
      const origStartOffset = dateToDayOffset(drag.origStartDate, ganttData.start);
      const origEndOffset = dateToDayOffset(drag.origEndDate, ganttData.start);
      newStart = dayOffsetToDate(origStartOffset + deltaDays, ganttData.start);
      newEnd = dayOffsetToDate(origEndOffset + deltaDays, ganttData.start);
    } else if (drag.mode === "resize-start") {
      const origStartOffset = dateToDayOffset(drag.origStartDate, ganttData.start);
      const newOffset = Math.min(origStartOffset + deltaDays, dateToDayOffset(drag.origEndDate, ganttData.start));
      newStart = dayOffsetToDate(newOffset, ganttData.start);
      newEnd = drag.origEndDate;
    } else if (drag.mode === "resize-end") {
      const origEndOffset = dateToDayOffset(drag.origEndDate, ganttData.start);
      const newOffset = Math.max(origEndOffset + deltaDays, dateToDayOffset(drag.origStartDate, ganttData.start));
      newStart = drag.origStartDate;
      newEnd = dayOffsetToDate(newOffset, ganttData.start);
    }
    setDragPreview({ startDate: newStart, endDate: newEnd });
  }, [drag, ganttData, dragPreview]);

  const handleDragEnd = useCallback(() => {
    if (!drag || !dragPreview) { setDrag(null); setDragPreview(null); return; }
    if (dragPreview.startDate !== drag.origStartDate || dragPreview.endDate !== drag.origEndDate) {
      updateMut.mutate({ id: drag.id, startDate: dragPreview.startDate, endDate: dragPreview.endDate });
    }
    setDrag(null);
    setDragPreview(null);
  }, [drag, dragPreview, updateMut]);

  function handleSubmit() {
    if (!form.title || !form.startDate || !form.endDate) {
      toast.error("工程名・開始日・終了日は必須です");
      return;
    }
    if (form.startDate > form.endDate) {
      toast.error("終了日は開始日以降にしてください");
      return;
    }
    if (editId) {
      updateMut.mutate({ id: editId, ...form });
      setEditId(null);
    } else {
      createMut.mutate({ caseId, ...form });
    }
    setShowForm(false);
    setForm({ title: "", startDate: "", endDate: "", status: "予定", color: "#3b82f6", memo: "", progress: 0 });
  }

  function startEdit(s: typeof schedules[0]) {
    setEditId(s.id);
    setForm({ title: s.title, startDate: s.startDate, endDate: s.endDate, status: s.status as "予定" | "進行中" | "完了", color: s.color || "#3b82f6", memo: s.memo || "", progress: s.progress ?? 0 });
    setShowForm(true);
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">工程スケジュール</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplatePanel(!showTemplatePanel)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="テンプレート"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">テンプレート</span>
          </button>
          {schedules.length > 0 && (
            <button
              onClick={() => setShowSaveTemplate(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              title="現在の工程をテンプレートとして保存"
            >
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">保存</span>
            </button>
          )}
          <button
            onClick={handleSuggest}
            disabled={suggestMut.isPending}
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50 transition-colors"
            title="AIが工程表を提案"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{suggestMut.isPending ? "提案中..." : "AI提案"}</span>
          </button>
          {schedules.length > 0 && (
            <button
              onClick={handleExportImage}
              disabled={exportingImage}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="画像でダウンロード"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{exportingImage ? "出力中..." : "エクスポート"}</span>
            </button>
          )}
          {schedules.length > 0 && (
            <button
              onClick={() => setShowExportPreview(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              title="PDFプレビュー"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          )}
          <button
            onClick={() => setShowCalendarPanel(!showCalendarPanel)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="カレンダー連動"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">カレンダー連動</span>
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ title: "", startDate: "", endDate: "", status: "予定", color: "#3b82f6", memo: "", progress: 0 }); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {showForm ? "キャンセル" : "+ 工程を追加"}
          </button>
        </div>
      </div>

      {/* Template Panel */}
      {showTemplatePanel && (
        <Card className="p-4 border-blue-200 bg-blue-50/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-medium text-blue-900">工程テンプレート</h4>
              </div>
              <button onClick={() => setShowTemplatePanel(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            {(!templates || templates.length === 0) ? (
              <p className="text-xs text-muted-foreground">保存済みのテンプレートはありません。工程を作成後「保存」ボタンでテンプレート化できます。</p>
            ) : (
              <div className="space-y-2">
                {templates.map((tpl) => {
                  const items = JSON.parse(tpl.items) as Array<{ title: string; durationDays: number; color: string }>;
                  return (
                    <div key={tpl.id} className="flex items-center gap-2 p-2 rounded-md border bg-white hover:bg-blue-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{tpl.name}</p>
                        <p className="text-[10px] text-muted-foreground">{items.length}工程・合計{items.reduce((s, i) => s + i.durationDays, 0)}日間</p>
                      </div>
                      <button
                        onClick={() => {
                          const startDate = new Date().toISOString().slice(0, 10);
                          applyTemplateMut.mutate({ templateId: tpl.id, caseId, startDate });
                        }}
                        disabled={applyTemplateMut.isPending}
                        className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        適用
                      </button>
                      <button
                        onClick={() => { if (confirm("このテンプレートを削除しますか？")) deleteTemplateMut.mutate({ id: tpl.id }); }}
                        className="text-[10px] px-1.5 py-1 text-destructive hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Save Template Dialog */}
      {showSaveTemplate && (
        <Card className="p-4 border-green-200 bg-green-50/50">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-green-900">現在の工程をテンプレートとして保存</h4>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="テンプレート名（例: サッシ修理5工程セット）"
              className="w-full text-xs border rounded-md px-3 py-2 bg-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveTemplateMut.mutate({ caseId, name: templateName })}
                disabled={!templateName.trim() || saveTemplateMut.isPending}
                className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {saveTemplateMut.isPending ? "保存中..." : "保存"}
              </button>
              <button onClick={() => { setShowSaveTemplate(false); setTemplateName(""); }} className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted">キャンセル</button>
            </div>
          </div>
        </Card>
      )}

      {/* AI Suggestion Panel */}
      {suggestions && (
        <Card className="p-4 border-amber-200 bg-amber-50/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <h4 className="text-sm font-medium text-amber-900">AI工程提案 <span className="text-[10px] font-normal text-amber-600">(クリックで編集可能)</span></h4>
              </div>
              <button
                onClick={() => { setSuggestions(null); setSuggestReasoning(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                閉じる
              </button>
            </div>
            {suggestReasoning && (
              <p className="text-xs text-amber-700 bg-amber-100/50 p-2 rounded">{suggestReasoning}</p>
            )}
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="p-2.5 bg-white rounded border border-amber-100 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={s.color}
                      onChange={(e) => {
                        const updated = [...suggestions];
                        updated[i] = { ...updated[i], color: e.target.value };
                        setSuggestions(updated);
                      }}
                      className="w-5 h-5 rounded border-0 cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={s.title}
                      onChange={(e) => {
                        const updated = [...suggestions];
                        updated[i] = { ...updated[i], title: e.target.value };
                        setSuggestions(updated);
                      }}
                      className="flex-1 text-xs font-medium bg-transparent border-b border-transparent hover:border-amber-200 focus:border-amber-400 focus:outline-none px-1 py-0.5"
                    />
                    <button
                      onClick={() => {
                        const updated = suggestions.filter((_, idx) => idx !== i);
                        setSuggestions(updated);
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="削除"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <input
                      type="date"
                      value={s.startDate}
                      onChange={(e) => {
                        const updated = [...suggestions];
                        updated[i] = { ...updated[i], startDate: e.target.value };
                        setSuggestions(updated);
                      }}
                      className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 focus:border-amber-400 focus:outline-none"
                    />
                    <span className="text-[10px] text-muted-foreground">〜</span>
                    <input
                      type="date"
                      value={s.endDate}
                      onChange={(e) => {
                        const updated = [...suggestions];
                        updated[i] = { ...updated[i], endDate: e.target.value };
                        setSuggestions(updated);
                      }}
                      className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div className="pl-7">
                    <input
                      type="text"
                      value={s.memo}
                      onChange={(e) => {
                        const updated = [...suggestions];
                        updated[i] = { ...updated[i], memo: e.target.value };
                        setSuggestions(updated);
                      }}
                      placeholder="メモ"
                      className="w-full text-[10px] text-amber-600 bg-transparent border-b border-transparent hover:border-amber-200 focus:border-amber-400 focus:outline-none px-1 py-0.5"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleApplySuggestions}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-md hover:bg-amber-700 transition-colors"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                この工程を登録
              </button>
              <button
                onClick={handleSuggest}
                disabled={suggestMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 text-amber-700 text-xs font-medium rounded-md hover:bg-amber-50 disabled:opacity-50 transition-colors"
              >
                <RotateCw className="h-3.5 w-3.5" />
                再提案
              </button>
              <button
                onClick={() => { setSuggestions(null); setSuggestReasoning(""); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Calendar Sync Panel */}
      {showCalendarPanel && (
        <Card className="p-4 border-blue-200 bg-blue-50/50">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-medium text-blue-900">カレンダー連動（ICS購読）</h4>
            </div>
            <p className="text-xs text-blue-700">
              この案件の工程スケジュールをGoogleカレンダーやAppleカレンダーに同期できます。工程の追加・変更は自動的に反映されます。
            </p>
            {!feedData?.token ? (
              <button
                onClick={() => generateFeedMut.mutate({ caseId })}
                disabled={generateFeedMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Calendar className="h-3.5 w-3.5" />
                {generateFeedMut.isPending ? "生成中..." : "購読URLを生成"}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={feedUrl || ""}
                    className="flex-1 text-[11px] px-2 py-1.5 bg-white border rounded font-mono truncate"
                  />
                  <button
                    onClick={() => {
                      if (feedUrl) {
                        navigator.clipboard.writeText(feedUrl).then(
                          () => toast.success("URLをコピーしました"),
                          () => toast.error("コピーに失敗しました")
                        );
                      }
                    }}
                    className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                    title="URLをコピー"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {googleCalendarSubscribeUrl && (
                    <a
                      href={googleCalendarSubscribeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-medium rounded-md hover:bg-blue-50 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Googleカレンダーに追加
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-blue-600/70">
                  ※ Googleカレンダーの反映は数時間かかる場合があります。AppleカレンダーやOutlookは上記URLを「照会」で追加してください。
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs">工程名</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例：現場調査、解体工事、仕上げ工事..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">開始日</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">終了日</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">ステータス</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="予定">予定</SelectItem>
                  <SelectItem value="進行中">進行中</SelectItem>
                  <SelectItem value="完了">完了</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">表示色</Label>
              <div className="flex gap-1.5 mt-1.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">進捗率: {form.progress}%</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.progress}
                  onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                  className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
                />
                <span className="text-xs font-medium w-10 text-right">{form.progress}%</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">メモ</Label>
              <Textarea
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                placeholder="備考..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {editId ? "更新" : "追加"}
            </button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {schedules.length === 0 && !showForm && (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium">工程が登録されていません</p>
            <p className="text-sm text-muted-foreground mt-1">「+ 工程を追加」から工程を登録すると、ガントチャートで進捗を確認できます。</p>
          </CardContent>
        </Card>
      )}

      {/* Export target wrapper */}
      <div ref={scheduleExportRef} className="schedule-export-area">
      {/* Export Header (visible in export) */}
      <div className="export-header hidden print:block" style={{ display: 'none' }}>
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-base font-bold text-gray-900 mb-1">工程表: {caseData?.storeName || ''} {caseData?.requestNumber || ''}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600">
            {caseData?.address && <span>現場: {caseData.address}</span>}
            {schedules.length > 0 && (
              <span>施工期間: {schedules.reduce((min: string, s: any) => s.startDate < min ? s.startDate : min, schedules[0].startDate)} 〜 {schedules.reduce((max: string, s: any) => s.endDate > max ? s.endDate : max, schedules[0].endDate)}</span>
            )}
            {caseData?.repairCategory && <span>工事区分: {caseData.repairCategory}</span>}
          </div>
        </div>
      </div>
      {/* Gantt Chart */}
      {schedules.length > 0 && ganttData && (
        <Card className="overflow-hidden">
          <div
            className="overflow-x-auto -webkit-overflow-scrolling-touch"
            ref={ganttContainerRef}
            onMouseMove={drag ? handleDragMove : undefined}
            onMouseUp={drag ? handleDragEnd : undefined}
            onMouseLeave={drag ? handleDragEnd : undefined}
            onPointerMove={drag ? handleDragMove : undefined}
            onPointerUp={drag ? handleDragEnd : undefined}
            style={{ WebkitOverflowScrolling: drag ? "auto" : "touch", touchAction: drag ? "none" : "auto" }}
          >
            <div className={`min-w-[480px] sm:min-w-[600px] ${drag ? "select-none" : ""}`}>
              {/* Date header */}
              <div className="flex border-b bg-muted/30">
                <div className="w-[120px] sm:w-[200px] flex-shrink-0 px-2 sm:px-3 py-2 text-[10px] font-medium text-muted-foreground border-r">
                  工程名
                </div>
                <div className="flex-1 relative" data-gantt-area>
                  <div className="flex">
                    {Array.from({ length: Math.min(ganttData.totalDays, 60) }, (_, i) => {
                      const d = new Date(ganttData.start);
                      d.setDate(d.getDate() + i);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isToday = d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
                      return (
                        <div
                          key={i}
                          className={`flex-1 min-w-[24px] text-center py-1 text-[9px] border-r border-border/50 ${isWeekend ? "bg-muted/50" : ""} ${isToday ? "bg-primary/10 font-bold" : ""}`}
                        >
                          <div className="text-muted-foreground">{d.getMonth() + 1}/{d.getDate()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Rows */}
              {schedules.map((s) => {
                // Use drag preview dates if this is the dragged item
                const isDragging = drag?.id === s.id;
                const displayStart = isDragging && dragPreview ? dragPreview.startDate : s.startDate;
                const displayEnd = isDragging && dragPreview ? dragPreview.endDate : s.endDate;
                const sStart = new Date(displayStart);
                const sEnd = new Date(displayEnd);
                const offsetDays = Math.max(0, Math.round((sStart.getTime() - ganttData.start.getTime()) / 86400000));
                const durationDays = Math.max(1, Math.round((sEnd.getTime() - sStart.getTime()) / 86400000) + 1);
                const leftPct = (offsetDays / ganttData.totalDays) * 100;
                const widthPct = (durationDays / ganttData.totalDays) * 100;
                return (
                  <div key={s.id} className="flex border-b last:border-b-0 hover:bg-muted/20 transition-colors group">
                    <div className="w-[120px] sm:w-[200px] flex-shrink-0 px-2 sm:px-3 py-2.5 border-r flex items-center gap-1.5 sm:gap-2">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || "#3b82f6" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] sm:text-xs font-medium truncate">{s.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge className={`text-[8px] sm:text-[9px] px-1 py-0 h-3.5 sm:h-4 ${STATUS_COLORS_SCHEDULE[s.status] || ""}`}>
                            {s.status}
                          </Badge>
                          {isDragging && dragPreview && (
                            <span className="text-[8px] sm:text-[9px] text-primary font-medium">
                              {dragPreview.startDate.slice(5)} 〜 {dragPreview.endDate.slice(5)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex gap-0.5 transition-opacity">
                        <button onClick={() => startEdit(s)} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                          <PenLine className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => { if (confirm("この工程を削除しますか？")) deleteMut.mutate({ id: s.id }); }}
                          className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 relative py-2" data-gantt-area>
                      {/* Today line */}
                      {(() => {
                        const todayOffset = Math.round((new Date().getTime() - ganttData.start.getTime()) / 86400000);
                        if (todayOffset >= 0 && todayOffset <= ganttData.totalDays) {
                          return <div className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10" style={{ left: `${(todayOffset / ganttData.totalDays) * 100}%` }} />;
                        }
                        return null;
                      })()}
                      {/* Bar with progress + drag handles */}
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-full shadow-sm overflow-hidden ${isDragging ? "h-6 ring-2 ring-primary/40 z-20" : "hover:h-6"} ${s.status === "完了" ? "opacity-80" : ""}`}
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(widthPct, 2)}%`,
                          backgroundColor: `color-mix(in srgb, ${s.color || "#3b82f6"} 30%, transparent)`,
                          transition: isDragging ? "none" : "all 0.15s ease-out",
                        }}
                        title={`${s.title}: ${displayStart} 〜 ${displayEnd} (進捗${s.progress}%)`}
                      >
                        {/* Progress fill */}
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${s.progress}%`,
                            backgroundColor: s.color || "#3b82f6",
                            transition: isDragging ? "none" : "all 0.3s",
                          }}
                        />
                        {/* Left resize handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-3 sm:w-2 cursor-ew-resize z-20 hover:bg-white/30 rounded-l-full"
                          onMouseDown={(e) => handleDragStart(e, s.id, "resize-start", s.startDate, s.endDate)}
                          onPointerDown={(e) => handleDragStart(e, s.id, "resize-start", s.startDate, s.endDate)}
                          style={{ touchAction: "none" }}
                        />
                        {/* Center move area */}
                        <div
                          className="absolute left-3 right-3 sm:left-2 sm:right-2 top-0 bottom-0 cursor-grab active:cursor-grabbing z-10"
                          onMouseDown={(e) => handleDragStart(e, s.id, "move", s.startDate, s.endDate)}
                          onPointerDown={(e) => handleDragStart(e, s.id, "move", s.startDate, s.endDate)}
                          style={{ touchAction: "none" }}
                        />
                        {/* Right resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-3 sm:w-2 cursor-ew-resize z-20 hover:bg-white/30 rounded-r-full"
                          onMouseDown={(e) => handleDragStart(e, s.id, "resize-end", s.startDate, s.endDate)}
                          onPointerDown={(e) => handleDragStart(e, s.id, "resize-end", s.startDate, s.endDate)}
                          style={{ touchAction: "none" }}
                        />
                        {/* Label with status icon (clickable to cycle status) */}
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-medium truncate px-3 z-[5] drop-shadow-sm gap-0.5">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-white/30 active:scale-90 transition-transform cursor-pointer z-30"
                            title="クリックでステータス切替（予定→進行中→完了）"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = s.status === "予定" ? "進行中" : s.status === "進行中" ? "完了" : "予定";
                              const prog = next === "完了" ? 100 : next === "進行中" ? 50 : 0;
                              updateMut.mutate({ id: s.id, status: next, progress: prog });
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {s.status === "完了" && "✓"}
                            {s.status === "進行中" && <span className="animate-pulse">▶</span>}
                            {s.status === "予定" && "○"}
                          </button>
                          {s.progress > 0 ? `${s.progress}%` : (durationDays > 2 ? `${durationDays}日` : "")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* List view (details) */}
      {schedules.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">工程一覧</h4>
          {schedules.map((s) => (
            <Card key={s.id} className="p-2.5 sm:p-3">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: s.color || "#3b82f6" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-xs sm:text-sm font-medium">{s.title}</span>
                    <Badge className={`text-[9px] sm:text-[10px] ${STATUS_COLORS_SCHEDULE[s.status] || ""}`}>{s.status}</Badge>
                    <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">{s.progress}%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${s.progress}%`, backgroundColor: s.color || "#3b82f6" }} />
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground w-8">{s.progress}%</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                    {s.startDate.replace(/-/g, "/")} 〜 {s.endDate.replace(/-/g, "/")}
                    <span className="ml-1 sm:ml-2">
                      ({Math.round((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 86400000) + 1}日間)
                    </span>
                  </p>
                  {s.memo && <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">{s.memo}</p>}
                </div>
                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-1">
                  {s.status !== "完了" && (
                    <button
                      onClick={() => updateMut.mutate({ id: s.id, status: s.status === "予定" ? "進行中" : "完了" })}
                      className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                      title={s.status === "予定" ? "進行中にする" : "完了にする"}
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => startEdit(s)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <PenLine className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm("この工程を削除しますか？")) deleteMut.mutate({ id: s.id }); }}
                    className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>{/* end schedule-export-area */}

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        open={showExportPreview}
        onOpenChange={setShowExportPreview}
        containerRef={scheduleExportRef}
        fileName={`工程表_${caseId}`}
        pageSelector=".schedule-export-area"
      />
    </div>
  );
}

