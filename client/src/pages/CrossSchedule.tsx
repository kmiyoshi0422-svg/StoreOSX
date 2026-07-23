import { useMemo, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CalendarDays,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  RefreshCw,
  Download,
  Image as ImageIcon,
  FileDown,
  Link2,
  Copy,
  Check,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────

function fmtYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - day); // Sunday start
  return r;
}

const STATUS_COLORS: Record<string, string> = {
  "予定": "bg-slate-200 text-slate-700",
  "進行中": "bg-blue-200 text-blue-800",
  "完了": "bg-emerald-200 text-emerald-800",
};

const URGENCY_COLORS: Record<string, string> = {
  S: "bg-red-600 text-white",
  A: "bg-orange-500 text-white",
  B: "bg-yellow-500 text-white",
  C: "bg-emerald-500 text-white",
};

// ─── Types ───────────────────────────────────────────────

type ScheduleItem = {
  id: number;
  caseId: number;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  color: string | null;
  progress: number;
  memo: string | null;
  storeName: string;
  requestNumber: string;
  brand: string;
  partnerId: number | null;
  contractorName: string | null;
  urgency: string;
  progressStage: string;
};

type RouteItem = {
  id: number;
  caseId: number;
  team: string;
  taskType: string;
  scheduledDate: string;
  assigneeId: number | null;
  notes: string | null;
  storeName: string;
  requestNumber: string;
  brand: string;
  partnerId: number | null;
  contractorName: string | null;
  urgency: string;
};

type PartnerRow = {
  id: number | null;
  name: string;
  items: Array<{
    type: "schedule" | "route";
    id: number;
    caseId: number;
    storeName: string;
    requestNumber: string;
    title: string;
    startDate: string;
    endDate: string;
    color: string;
    status: string;
    progress: number;
    urgency: string;
    taskType?: string;
  }>;
};

// ─── Component ───────────────────────────────────────────

export default function CrossSchedule() {
  const [, setLocation] = useLocation();
  const { data: partnersData } = trpc.partners.list.useQuery();
  const utils = trpc.useUtils();

  // View range: default 4 weeks
  const [rangeWeeks, setRangeWeeks] = useState(4);
  const [offset, setOffset] = useState(0);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState<{
    itemType: "schedule" | "route";
    itemId: number;
    originalStart: string;
    originalEnd: string;
    dayOffset: number;
  } | null>(null);
  const dragStartX = useRef(0);
  const dragItemRef = useRef<HTMLDivElement | null>(null);

  const updateSchedule = trpc.schedules.update.useMutation({
    onSuccess: () => {
      utils.crossSchedule.list.invalidate();
      toast.success("日程を更新しました");
    },
    onError: () => toast.error("日程の更新に失敗しました"),
  });

  // Calendar feed
  const { data: feedTokenData } = trpc.schedules.getCalendarFeedToken.useQuery();
  const generateFeedToken = trpc.schedules.generateCalendarFeedToken.useMutation({
    onSuccess: () => {
      utils.schedules.getCalendarFeedToken.invalidate();
      toast.success("カレンダーフィードURLを生成しました");
    },
  });

  const rangeStart = useMemo(() => {
    const today = startOfWeek(new Date());
    return addDays(today, offset * 7);
  }, [offset]);

  const rangeEnd = useMemo(() => addDays(rangeStart, rangeWeeks * 7 - 1), [rangeStart, rangeWeeks]);

  const queryRangeStart = useMemo(() => fmtYmd(addDays(rangeStart, -7)), [rangeStart]);
  const queryRangeEnd = useMemo(() => fmtYmd(addDays(rangeEnd, 7)), [rangeEnd]);
  const { data, isLoading } = trpc.crossSchedule.list.useQuery({ rangeStart: queryRangeStart, rangeEnd: queryRangeEnd });
  const totalDays = rangeWeeks * 7;

  // Build partner map
  const partnerMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string; category: string }>();
    for (const p of partnersData ?? []) {
      m.set(p.id, { id: p.id, name: p.name, category: p.category });
    }
    return m;
  }, [partnersData]);

  // Group schedules and routes by partner
  const partnerRows = useMemo(() => {
    if (!data) return [];
    const rowMap = new Map<string, PartnerRow>();

    for (const s of data.schedules as ScheduleItem[]) {
      const key = s.partnerId ? String(s.partnerId) : "unassigned";
      if (!rowMap.has(key)) {
        const partner = s.partnerId ? partnerMap.get(s.partnerId) : null;
        rowMap.set(key, { id: s.partnerId, name: partner?.name || s.contractorName || "未割当", items: [] });
      }
      rowMap.get(key)!.items.push({
        type: "schedule",
        id: s.id,
        caseId: s.caseId,
        storeName: s.storeName,
        requestNumber: s.requestNumber,
        title: s.title,
        startDate: s.startDate,
        endDate: s.endDate,
        color: s.color || "#3b82f6",
        status: s.status,
        progress: s.progress,
        urgency: s.urgency,
      });
    }

    for (const r of data.routes as RouteItem[]) {
      const key = r.partnerId ? String(r.partnerId) : "unassigned";
      if (!rowMap.has(key)) {
        const partner = r.partnerId ? partnerMap.get(r.partnerId) : null;
        rowMap.set(key, { id: r.partnerId, name: partner?.name || r.contractorName || "未割当", items: [] });
      }
      rowMap.get(key)!.items.push({
        type: "route",
        id: r.id,
        caseId: r.caseId,
        storeName: r.storeName,
        requestNumber: r.requestNumber,
        title: r.taskType === "survey" ? "現調" : "工事",
        startDate: r.scheduledDate,
        endDate: r.scheduledDate,
        color: r.taskType === "survey" ? "#f59e0b" : "#10b981",
        status: "予定",
        progress: 0,
        urgency: r.urgency,
        taskType: r.taskType,
      });
    }

    const rows = Array.from(rowMap.values());
    rows.sort((a, b) => {
      if (a.id === null) return 1;
      if (b.id === null) return -1;
      return a.name.localeCompare(b.name, "ja");
    });
    return rows;
  }, [data, partnerMap]);

  // Filter by partner category
  const filteredRows = useMemo(() => {
    if (filterCategory === "all") return partnerRows;
    return partnerRows.filter((row) => {
      if (!row.id) return filterCategory === "未割当";
      const partner = partnerMap.get(row.id);
      return partner?.category === filterCategory;
    });
  }, [partnerRows, filterCategory, partnerMap]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of partnersData ?? []) cats.add(p.category);
    return Array.from(cats).sort();
  }, [partnersData]);

  // Date header generation
  const dateHeaders = useMemo(() => {
    const headers: Array<{ date: string; label: string; isWeekend: boolean; isToday: boolean; monthLabel?: string }> = [];
    const todayStr = fmtYmd(new Date());
    let lastMonth = -1;
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(rangeStart, i);
      const dateStr = fmtYmd(d);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isToday = dateStr === todayStr;
      const month = d.getMonth();
      const monthLabel = month !== lastMonth ? `${d.getFullYear()}/${month + 1}` : undefined;
      lastMonth = month;
      headers.push({ date: dateStr, label: `${d.getDate()}`, isWeekend, isToday, monthLabel });
    }
    return headers;
  }, [rangeStart, totalDays]);

  const totalSchedules = data?.schedules?.length ?? 0;
  const totalRoutes = data?.routes?.length ?? 0;
  const activePartners = filteredRows.filter((r) => r.items.length > 0).length;

  const ganttRef = useRef<HTMLDivElement>(null);

  // ─── Drag & Drop ──────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, item: PartnerRow["items"][0]) => {
    if (item.type !== "schedule") return; // Only schedules can be dragged
    e.preventDefault();
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    dragStartX.current = clientX;
    setDragState({
      itemType: item.type,
      itemId: item.id,
      originalStart: item.startDate,
      originalEnd: item.endDate,
      dayOffset: 0,
    });

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const cx = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const ganttEl = ganttRef.current;
      if (!ganttEl) return;
      const ganttWidth = ganttEl.querySelector(".flex-1")?.clientWidth || ganttEl.clientWidth - 220;
      const dayPx = ganttWidth / totalDays;
      const dx = cx - dragStartX.current;
      const dayOff = Math.round(dx / dayPx);
      setDragState((prev) => prev ? { ...prev, dayOffset: dayOff } : null);
    };

    const handleEnd = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);

      setDragState((prev) => {
        if (prev && prev.dayOffset !== 0 && prev.itemType === "schedule") {
          const newStart = fmtYmd(addDays(new Date(prev.originalStart), prev.dayOffset));
          const newEnd = fmtYmd(addDays(new Date(prev.originalEnd), prev.dayOffset));
          updateSchedule.mutate({ id: prev.itemId, startDate: newStart, endDate: newEnd });
        }
        return null;
      });
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
  }, [totalDays, updateSchedule]);

  // ─── Export Functions ─────────────────────────────────────
  const handleExportImage = useCallback(async () => {
    const el = ganttRef.current;
    if (!el) return;
    toast.info("画像を生成中...");
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `横断工程表_${fmtYmd(new Date())}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("画像をダウンロードしました");
    } catch (err) {
      toast.error("画像生成に失敗しました");
      console.error(err);
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    const el = ganttRef.current;
    if (!el) return;
    toast.info("PDFを生成中...");
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Header
      pdf.setFontSize(14);
      pdf.text("横断工程表", 10, 12);
      pdf.setFontSize(9);
      pdf.text(`期間: ${fmtYmd(rangeStart)} 〜 ${fmtYmd(rangeEnd)}`, 10, 18);
      pdf.text(`業者数: ${activePartners} / 工程数: ${totalSchedules + totalRoutes}件`, 10, 23);
      pdf.text(`出力日: ${fmtYmd(new Date())}`, pageWidth - 50, 12);

      // Chart image
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      const maxImgHeight = pageHeight - 30;
      const finalHeight = Math.min(imgHeight, maxImgHeight);
      pdf.addImage(imgData, "PNG", 10, 27, imgWidth, finalHeight);

      pdf.save(`横断工程表_${fmtYmd(new Date())}.pdf`);
      toast.success("PDFをダウンロードしました");
    } catch (err) {
      toast.error("PDF生成に失敗しました");
      console.error(err);
    }
  }, [rangeStart, rangeEnd, activePartners, totalSchedules, totalRoutes]);

  // ─── Calendar Feed URL ────────────────────────────────────
  const feedUrl = useMemo(() => {
    if (!feedTokenData?.token) return null;
    return `${window.location.origin}/api/calendar/feed/${feedTokenData.token}.ics`;
  }, [feedTokenData]);

  const handleCopyFeedUrl = useCallback(() => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    toast.success("URLをコピーしました");
    setTimeout(() => setCopied(false), 2000);
  }, [feedUrl]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-l-4 border-l-indigo-500">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground mb-1">
                <Layers className="h-3.5 w-3.5" />
                Cross-Partner Schedule
              </div>
              <h1 className="text-lg sm:text-xl font-bold">横断工程表</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                各業者のスケジュールを横断的に可視化。バーをドラッグして日程変更も可能です。
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-white">
                <Building2 className="h-3 w-3 mr-1" />
                {activePartners} 業者
              </Badge>
              <Badge variant="outline" className="bg-white">
                <CalendarDays className="h-3 w-3 mr-1" />
                {totalSchedules + totalRoutes} 件
              </Badge>
              <Button size="sm" variant="outline" onClick={() => utils.crossSchedule.list.invalidate()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                更新
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t">
            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setOffset(offset - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOffset(0)}>
                今週
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOffset(offset + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Range selector */}
            <Select value={String(rangeWeeks)} onValueChange={(v) => setRangeWeeks(Number(v))}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2週間</SelectItem>
                <SelectItem value="4">4週間</SelectItem>
                <SelectItem value="8">8週間</SelectItem>
                <SelectItem value="12">12週間</SelectItem>
              </SelectContent>
            </Select>

            {/* Category filter */}
            <div className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="業種" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全業種</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="未割当">未割当</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Export & Calendar buttons */}
            <div className="flex items-center gap-1 ml-auto">
              <Button size="sm" variant="outline" onClick={handleExportPdf} title="PDF出力">
                <FileDown className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportImage} title="画像出力">
                <ImageIcon className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">PNG</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCalendarDialog(true)} title="Googleカレンダー連携">
                <Link2 className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">カレンダー</span>
              </Button>
            </div>

            <span className="text-[10px] text-muted-foreground w-full sm:w-auto text-right">
              {fmtYmd(rangeStart)} 〜 {fmtYmd(rangeEnd)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Gantt Chart */}
      {filteredRows.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium">表示するスケジュールがありません</p>
            <p className="text-sm text-muted-foreground mt-1">
              案件に工程を登録するか、ルート割り振りを行うと横断工程表に表示されます。
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto" ref={ganttRef} style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="min-w-[800px]">
              {/* Date header */}
              <div className="flex border-b bg-muted/30 sticky top-0 z-10">
                <div className="w-[180px] sm:w-[220px] flex-shrink-0 px-3 py-2 text-[10px] font-semibold text-muted-foreground border-r bg-muted/30">
                  業者名
                </div>
                <div className="flex-1 flex">
                  {dateHeaders.map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 min-w-[28px] text-center py-1.5 text-[9px] border-r border-border/30 ${
                        h.isWeekend ? "bg-rose-50/60" : ""
                      } ${h.isToday ? "bg-primary/10 font-bold" : ""}`}
                    >
                      {h.monthLabel && (
                        <div className="text-[8px] text-muted-foreground font-medium">{h.monthLabel}</div>
                      )}
                      <div className={h.isToday ? "text-primary" : "text-muted-foreground"}>{h.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Partner rows */}
              {filteredRows.map((row) => {
                const rangeStartStr = fmtYmd(rangeStart);
                const rangeEndStr = fmtYmd(rangeEnd);
                const visibleItems = row.items.filter(
                  (item) => item.endDate >= rangeStartStr && item.startDate <= rangeEndStr
                );

                return (
                  <div key={row.id ?? "unassigned"} className="flex border-b last:border-b-0 hover:bg-muted/10 transition-colors">
                    {/* Partner name column */}
                    <div className="w-[180px] sm:w-[220px] flex-shrink-0 px-2 sm:px-3 py-2 border-r bg-white/50">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${row.id ? "bg-indigo-500" : "bg-gray-300"}`} />
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[11px] sm:text-xs font-medium truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => row.id && setLocation(`/partners/${row.id}`)}
                            title={row.name}
                          >
                            {row.name}
                          </p>
                          {row.id && partnerMap.get(row.id) && (
                            <p className="text-[9px] text-muted-foreground">{partnerMap.get(row.id)!.category}</p>
                          )}
                          <p className="text-[9px] text-muted-foreground">{visibleItems.length} 件</p>
                        </div>
                      </div>
                    </div>

                    {/* Gantt area */}
                    <div className="flex-1 relative py-1" style={{ minHeight: `${Math.max(32, visibleItems.length * 22 + 8)}px` }}>
                      {/* Today line */}
                      {(() => {
                        const todayStr = fmtYmd(new Date());
                        const todayOffset = Math.round(
                          (new Date(todayStr).getTime() - rangeStart.getTime()) / 86400000
                        );
                        if (todayOffset >= 0 && todayOffset < totalDays) {
                          return (
                            <div
                              className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10"
                              style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                            />
                          );
                        }
                        return null;
                      })()}

                      {/* Weekend background stripes */}
                      {dateHeaders.map((h, i) =>
                        h.isWeekend ? (
                          <div
                            key={`bg-${i}`}
                            className="absolute top-0 bottom-0 bg-rose-50/40"
                            style={{ left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%` }}
                          />
                        ) : null
                      )}

                      {/* Schedule bars */}
                      {visibleItems.map((item, idx) => {
                        // Apply drag offset if this item is being dragged
                        let effectiveStart = item.startDate;
                        let effectiveEnd = item.endDate;
                        if (dragState && dragState.itemId === item.id && dragState.itemType === item.type) {
                          effectiveStart = fmtYmd(addDays(new Date(item.startDate), dragState.dayOffset));
                          effectiveEnd = fmtYmd(addDays(new Date(item.endDate), dragState.dayOffset));
                        }

                        const itemStart = new Date(effectiveStart);
                        const itemEnd = new Date(effectiveEnd);
                        const offsetDays = Math.round((itemStart.getTime() - rangeStart.getTime()) / 86400000);
                        const durationDays = Math.max(1, Math.round((itemEnd.getTime() - itemStart.getTime()) / 86400000) + 1);
                        const clampedOffset = Math.max(0, offsetDays);
                        const clampedEnd = Math.min(totalDays, offsetDays + durationDays);
                        const clampedDuration = clampedEnd - clampedOffset;

                        const leftPct = (clampedOffset / totalDays) * 100;
                        const widthPct = (clampedDuration / totalDays) * 100;
                        const topPx = idx * 22 + 4;
                        const isDragging = dragState?.itemId === item.id && dragState?.itemType === item.type;

                        return (
                          <div
                            key={`${item.type}-${item.id}`}
                            ref={isDragging ? dragItemRef : undefined}
                            className={`absolute h-[18px] rounded-sm shadow-sm overflow-hidden transition-all group/bar ${
                              item.type === "schedule" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                            } ${isDragging ? "opacity-80 ring-2 ring-primary z-20 scale-[1.02]" : "hover:brightness-110"}`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 1.5)}%`,
                              top: `${topPx}px`,
                              backgroundColor: `color-mix(in srgb, ${item.color} 35%, transparent)`,
                            }}
                            title={`${item.storeName} - ${item.title}\n${effectiveStart} 〜 ${effectiveEnd}\nステータス: ${item.status}${item.progress > 0 ? ` (${item.progress}%)` : ""}${item.type === "schedule" ? "\n※ドラッグで日程変更" : ""}`}
                            onMouseDown={(e) => handleDragStart(e, item)}
                            onTouchStart={(e) => handleDragStart(e, item)}
                            onClick={(e) => {
                              if (!dragState) setLocation(`/cases/${item.caseId}`);
                              e.stopPropagation();
                            }}
                          >
                            {/* Progress fill */}
                            <div
                              className="absolute inset-y-0 left-0 rounded-sm"
                              style={{ width: `${item.progress}%`, backgroundColor: item.color }}
                            />
                            {/* Label */}
                            <span
                              className="absolute inset-0 flex items-center px-1 text-[9px] font-medium truncate z-[5] drop-shadow-sm"
                              style={{ color: item.progress > 50 ? "#fff" : "#333" }}
                            >
                              {item.urgency && (
                                <span className={`inline-flex h-3 min-w-3 px-0.5 items-center justify-center rounded text-[7px] font-bold mr-0.5 ${URGENCY_COLORS[item.urgency] || ""}`}>
                                  {item.urgency}
                                </span>
                              )}
                              {item.type === "route" && (
                                <span className="mr-0.5">{item.taskType === "survey" ? "🔍" : "🔨"}</span>
                              )}
                              <span className="truncate">
                                {item.storeName.length > 8 ? item.storeName.slice(0, 8) + "…" : item.storeName}
                                {item.type === "schedule" && ` - ${item.title}`}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-xs text-muted-foreground">
            <span className="font-medium text-foreground">凡例:</span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-blue-500/35 border border-blue-500/50" />
              工程スケジュール（ドラッグ可）
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-amber-500/35 border border-amber-500/50" />
              🔍 現調
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-emerald-500/35 border border-emerald-500/50" />
              🔨 工事
            </span>
            <span className="flex items-center gap-1 ml-4">
              <span className="w-px h-4 bg-red-400" />
              今日
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-rose-50 border border-rose-200" />
              土日
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Google Calendar Dialog */}
      <Dialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Googleカレンダー連携
            </DialogTitle>
            <DialogDescription>
              以下のURLをGoogleカレンダーに登録すると、工程スケジュールが自動同期されます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {feedUrl ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">ICSフィードURL</label>
                  <div className="flex gap-2">
                    <Input value={feedUrl} readOnly className="text-xs font-mono" />
                    <Button size="sm" variant="outline" onClick={handleCopyFeedUrl}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
                  <p className="font-medium">Googleカレンダーへの追加方法:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>上のURLをコピー</li>
                    <li>Googleカレンダーを開く</li>
                    <li>左サイドバー「他のカレンダー」の「+」→「URLで追加」</li>
                    <li>コピーしたURLを貼り付けて「カレンダーを追加」</li>
                  </ol>
                  <p className="text-muted-foreground mt-2">
                    ※ 同期間隔はGoogleカレンダー側で約12〜24時間です。Apple/Outlookカレンダーでも同様に購読可能です。
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  カレンダーフィードURLがまだ生成されていません。
                </p>
                <Button onClick={() => generateFeedToken.mutate()} disabled={generateFeedToken.isPending}>
                  {generateFeedToken.isPending ? "生成中..." : "フィードURLを生成"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
