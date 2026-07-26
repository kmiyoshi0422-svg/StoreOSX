import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Users } from "lucide-react";
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
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
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
  address: string | null;
  assigneeId: number | null;
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

type CaseRow = {
  caseId: number;
  storeName: string;
  requestNumber: string;
  brand: string;
  assigneeName: string | null;
  urgency: string;
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
  const { data: usersData } = trpc.users.list.useQuery();
  const utils = trpc.useUtils();

  // View mode: "partner" (業者ベース) or "case" (案件ベース)
  const [viewMode, setViewMode] = useState<"partner" | "case">("partner");

  // View range: default 4 weeks
  const [rangeWeeks, setRangeWeeks] = useState(4);
  const [offset, setOffset] = useState(0);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState<{
    itemType: "schedule" | "route";
    itemId: number;
    originalStart: string;
    originalEnd: string;
    dayOffset: number;
    resizeMode?: "left" | "right" | null; // null = move entire bar
  } | null>(null);
  const dragStartX = useRef(0);
  const dragItemRef = useRef<HTMLDivElement | null>(null);

  // Undo/Redo history stacks
  const [undoStack, setUndoStack] = useState<Array<{
    scheduleId: number;
    previousStart: string;
    previousEnd: string;
    newStart: string;
    newEnd: string;
  }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{
    scheduleId: number;
    previousStart: string;
    previousEnd: string;
    newStart: string;
    newEnd: string;
  }>>([]);

  // Zoom level: "day" | "week" | "month"
  const [zoomLevel, setZoomLevel] = useState<"day" | "week" | "month">("week");

  const updateSchedule = trpc.schedules.update.useMutation({
    onSuccess: () => {
      utils.crossSchedule.list.invalidate();
      toast.success("日程を更新しました");
    },
    onError: () => toast.error("日程の更新に失敗しました"),
  });

  const undoSchedule = trpc.schedules.update.useMutation({
    onSuccess: () => {
      utils.crossSchedule.list.invalidate();
      toast.success("操作を元に戻しました");
    },
    onError: () => toast.error("元に戻す操作に失敗しました"),
  });

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
    undoSchedule.mutate({ id: last.scheduleId, startDate: last.previousStart, endDate: last.previousEnd });
  }, [undoStack, undoSchedule]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev.slice(-9), last]);
    undoSchedule.mutate({ id: last.scheduleId, startDate: last.newStart, endDate: last.newEnd });
  }, [redoStack, undoSchedule]);

  // Keyboard shortcuts: Ctrl+Z (Undo), Ctrl+Y (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Calendar feed
  const { data: feedTokenData } = trpc.schedules.getCalendarFeedToken.useQuery();
  const generateFeedToken = trpc.schedules.generateCalendarFeedToken.useMutation({
    onSuccess: () => {
      utils.schedules.getCalendarFeedToken.invalidate();
      toast.success("カレンダーフィードURLを生成しました");
    },
  });

  // Compute display range based on zoom level
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    const today = new Date();
    if (zoomLevel === "day") {
      // Show rangeWeeks * 7 days but each column = 1 day
      const start = addDays(startOfWeek(today), offset * 7);
      const days = rangeWeeks * 7;
      return { rangeStart: start, rangeEnd: addDays(start, days - 1), totalDays: days };
    } else if (zoomLevel === "month") {
      // Show rangeWeeks weeks but grouped by month columns
      const start = addDays(startOfWeek(today), offset * 28);
      const days = rangeWeeks * 28; // 4x wider view
      return { rangeStart: start, rangeEnd: addDays(start, days - 1), totalDays: days };
    } else {
      // week (default)
      const start = addDays(startOfWeek(today), offset * 7);
      const days = rangeWeeks * 7;
      return { rangeStart: start, rangeEnd: addDays(start, days - 1), totalDays: days };
    }
  }, [offset, rangeWeeks, zoomLevel]);

  const queryRangeStart = useMemo(() => fmtYmd(addDays(rangeStart, -7)), [rangeStart]);
  const queryRangeEnd = useMemo(() => fmtYmd(addDays(rangeEnd, 7)), [rangeEnd]);
  const { data, isLoading } = trpc.crossSchedule.list.useQuery({ rangeStart: queryRangeStart, rangeEnd: queryRangeEnd });

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

  // Case-based view: group by case
  const userMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of usersData ?? []) m.set(u.id, u.name ?? `ID:${u.id}`);
    return m;
  }, [usersData]);

  const caseRows = useMemo((): CaseRow[] => {
    if (!data) return [];
    const rowMap = new Map<number, CaseRow>();

    for (const s of data.schedules ?? []) {
      if (!rowMap.has(s.caseId)) {
        rowMap.set(s.caseId, {
          caseId: s.caseId,
          storeName: s.storeName,
          requestNumber: s.requestNumber ?? "",
          brand: s.brand ?? "",
          assigneeName: s.assigneeId ? (userMap.get(s.assigneeId) ?? null) : null,
          urgency: s.urgency ?? "",
          items: [],
        });
      }
      rowMap.get(s.caseId)!.items.push({
        type: "schedule",
        id: s.id,
        caseId: s.caseId,
        storeName: s.storeName,
        requestNumber: s.requestNumber ?? "",
        title: s.title,
        startDate: s.startDate,
        endDate: s.endDate,
        color: s.color ?? STATUS_COLORS[s.status] ?? "#6366f1",
        status: s.status,
        progress: s.progress ?? 0,
        urgency: s.urgency ?? "",
      });
    }

    for (const r of data.routes ?? []) {
      if (!rowMap.has(r.caseId)) {
        rowMap.set(r.caseId, {
          caseId: r.caseId,
          storeName: r.storeName,
          requestNumber: r.requestNumber ?? "",
          brand: r.brand ?? "",
          assigneeName: null,
          urgency: r.urgency ?? "",
          items: [],
        });
      }
      const dateStr = r.scheduledDate;
      rowMap.get(r.caseId)!.items.push({
        type: "route",
        id: r.id,
        caseId: r.caseId,
        storeName: r.storeName,
        requestNumber: r.requestNumber ?? "",
        title: r.taskType === "survey" ? "現調" : "工事",
        startDate: dateStr,
        endDate: dateStr,
        color: r.taskType === "survey" ? "#f59e0b" : "#10b981",
        status: "active",
        progress: 0,
        urgency: r.urgency ?? "",
        taskType: r.taskType,
      });
    }

    const rows = Array.from(rowMap.values());
    rows.sort((a, b) => a.storeName.localeCompare(b.storeName, "ja"));
    return rows;
  }, [data, userMap]);

  // Unique assignee names and brands for filter options
  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of caseRows) {
      if (row.assigneeName) names.add(row.assigneeName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ja"));
  }, [caseRows]);

  const brandOptions = useMemo(() => {
    const brands = new Set<string>();
    for (const row of caseRows) {
      if (row.brand) brands.add(row.brand);
    }
    return Array.from(brands).sort((a, b) => a.localeCompare(b, "ja"));
  }, [caseRows]);

  // Filtered case rows
  const filteredCaseRows = useMemo(() => {
    let rows = caseRows;
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "__unassigned__") {
        rows = rows.filter((r) => !r.assigneeName);
      } else {
        rows = rows.filter((r) => r.assigneeName === assigneeFilter);
      }
    }
    if (brandFilter !== "all") {
      rows = rows.filter((r) => r.brand === brandFilter);
    }
    return rows;
  }, [caseRows, assigneeFilter, brandFilter]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of partnersData ?? []) cats.add(p.category);
    return Array.from(cats).sort();
  }, [partnersData]);

  // Date header generation (adapts to zoom level)
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

      let label = `${d.getDate()}`;
      if (zoomLevel === "day") {
        const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
        label = `${d.getDate()}(${weekday})`;
      } else if (zoomLevel === "month") {
        // Show label only every 7 days (week start)
        label = i % 7 === 0 ? `${d.getMonth() + 1}/${d.getDate()}` : "";
      }
      headers.push({ date: dateStr, label, isWeekend, isToday, monthLabel: zoomLevel === "month" ? (i % 7 === 0 ? monthLabel : undefined) : monthLabel });
    }
    return headers;
  }, [rangeStart, totalDays, zoomLevel]);

  const totalSchedules = data?.schedules?.length ?? 0;
  const totalRoutes = data?.routes?.length ?? 0;
  const activePartners = filteredRows.filter((r) => r.items.length > 0).length;

  const ganttRef = useRef<HTMLDivElement>(null);

  // ─── Drag & Drop (Move entire bar) ────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, item: PartnerRow["items"][0]) => {
    if (item.type !== "schedule") return;
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
      resizeMode: null,
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
          // Push to undo stack before mutating, clear redo
          setUndoStack((stack) => [...stack.slice(-9), { scheduleId: prev.itemId, previousStart: prev.originalStart, previousEnd: prev.originalEnd, newStart, newEnd }]);
          setRedoStack([]);
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

  // ─── Resize (Left/Right edge drag) ────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, item: PartnerRow["items"][0], edge: "left" | "right") => {
    if (item.type !== "schedule") return;
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
      resizeMode: edge,
    });

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const cx = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const ganttEl = ganttRef.current;
      if (!ganttEl) return;
      const ganttWidth = ganttEl.querySelector(".flex-1")?.clientWidth || ganttEl.clientWidth - 220;
      const dayPx = ganttWidth / totalDays;
      const dx = cx - dragStartX.current;
      const dayOff = Math.round(dx / dayPx);
      setDragState((prev) => {
        if (!prev) return null;
        // Ensure minimum 1 day duration
        if (edge === "left") {
          const origDuration = Math.round((new Date(prev.originalEnd).getTime() - new Date(prev.originalStart).getTime()) / 86400000);
          const maxLeftShift = origDuration; // can't go past end date
          const clampedOff = Math.min(dayOff, maxLeftShift);
          return { ...prev, dayOffset: clampedOff };
        } else {
          const origDuration = Math.round((new Date(prev.originalEnd).getTime() - new Date(prev.originalStart).getTime()) / 86400000);
          const minRightShift = -origDuration; // can't go before start date
          const clampedOff = Math.max(dayOff, minRightShift);
          return { ...prev, dayOffset: clampedOff };
        }
      });
    };

    const handleEnd = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);

      setDragState((prev) => {
        if (prev && prev.dayOffset !== 0 && prev.itemType === "schedule" && prev.resizeMode) {
          let newStart = prev.originalStart;
          let newEnd = prev.originalEnd;
          if (prev.resizeMode === "left") {
            newStart = fmtYmd(addDays(new Date(prev.originalStart), prev.dayOffset));
          } else {
            newEnd = fmtYmd(addDays(new Date(prev.originalEnd), prev.dayOffset));
          }
          // Push to undo stack before mutating, clear redo
          setUndoStack((stack) => [...stack.slice(-9), { scheduleId: prev.itemId, previousStart: prev.originalStart, previousEnd: prev.originalEnd, newStart, newEnd }]);
          setRedoStack([]);
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

  // Collect unique addresses for PDF header
  const uniqueAddresses = useMemo(() => {
    if (!data?.schedules) return [];
    const addrSet = new Set<string>();
    for (const s of data.schedules as ScheduleItem[]) {
      if (s.address) addrSet.add(`${s.storeName}: ${s.address}`);
    }
    return Array.from(addrSet).slice(0, 5); // max 5 addresses in header
  }, [data]);

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

      // Header - Logo (left side)
      const logoSize = 14;
      try {
        const logoResp = await fetch("/manus-storage/mdo-logo_4253fe3c.png");
        const logoBlob = await logoResp.blob();
        const logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        pdf.addImage(logoDataUrl, "PNG", 10, 5, logoSize, logoSize);
      } catch {
        // Logo load failed - continue without it
      }

      // Header - Company info (right side)
      pdf.setFontSize(10);
      pdf.text("三好\u3000慶", pageWidth - 50, 10);
      pdf.setFontSize(8);
      pdf.text("TEL: 090-9240-1656", pageWidth - 50, 15);

      // Header - Title (next to logo)
      const titleX = 10 + logoSize + 3;
      pdf.setFontSize(14);
      pdf.text("横断工程表", titleX, 12);
      pdf.setFontSize(9);
      pdf.text(`期間: ${fmtYmd(rangeStart)} 〜 ${fmtYmd(rangeEnd)}`, titleX, 18);

      // Header - Stats (below logo)
      pdf.setFontSize(8);
      pdf.text(`業者数: ${activePartners} / 工程数: ${totalSchedules + totalRoutes}件`, 10, 5 + logoSize + 5);
      pdf.text(`出力日: ${fmtYmd(new Date())}`, 10, 5 + logoSize + 9);

      // Header - Case addresses
      let headerY = 5 + logoSize + 14;
      if (uniqueAddresses.length > 0) {
        pdf.setFontSize(7);
        pdf.setTextColor(80, 80, 80);
        for (const addr of uniqueAddresses) {
          pdf.text(addr, 10, headerY);
          headerY += 3.5;
        }
        pdf.setTextColor(0, 0, 0);
      }

      // Chart image
      const chartTopY = headerY + 2;
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      const maxImgHeight = pageHeight - chartTopY - 5;
      const finalHeight = Math.min(imgHeight, maxImgHeight);
      pdf.addImage(imgData, "PNG", 10, chartTopY, imgWidth, finalHeight);

      pdf.save(`横断工程表_${fmtYmd(new Date())}.pdf`);
      toast.success("PDFをダウンロードしました");
    } catch (err) {
      toast.error("PDF生成に失敗しました");
      console.error(err);
    }
  }, [rangeStart, rangeEnd, activePartners, totalSchedules, totalRoutes, uniqueAddresses]);

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
                {viewMode === "partner" ? "各業者のスケジュールを横断的に可視化" : "各案件のスケジュールを担当者付きで可視化"}。バーをドラッグして日程変更も可能です。
              </p>
              {/* View mode toggle */}
              <div className="flex items-center gap-0.5 mt-2 border rounded-md p-0.5 w-fit">
                <Button
                  size="sm"
                  variant={viewMode === "partner" ? "default" : "ghost"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setViewMode("partner")}
                >
                  <Building2 className="h-3.5 w-3.5 mr-1" />
                  業者ベース
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "case" ? "default" : "ghost"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setViewMode("case")}
                >
                  <Users className="h-3.5 w-3.5 mr-1" />
                  案件ベース
                </Button>
              </div>
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
              <Button
                size="sm"
                variant={undoStack.length > 0 ? "default" : "outline"}
                onClick={handleUndo}
                disabled={undoStack.length === 0 || undoSchedule.isPending}
                title={`元に戻す (Ctrl+Z)${undoStack.length > 0 ? ` ${undoStack.length}件` : ""}`}
                className={undoStack.length > 0 ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
              >
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                戻す{undoStack.length > 0 && ` (${undoStack.length})`}
              </Button>
              <Button
                size="sm"
                variant={redoStack.length > 0 ? "default" : "outline"}
                onClick={handleRedo}
                disabled={redoStack.length === 0 || undoSchedule.isPending}
                title={`やり直す (Ctrl+Y)${redoStack.length > 0 ? ` ${redoStack.length}件` : ""}`}
                className={redoStack.length > 0 ? "bg-sky-500 hover:bg-sky-600 text-white" : ""}
              >
                <Redo2 className="h-3.5 w-3.5 mr-1" />
                やり直す{redoStack.length > 0 && ` (${redoStack.length})`}
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

            {/* Zoom level */}
            <div className="flex items-center gap-0.5 border rounded-md p-0.5">
              <Button
                size="sm"
                variant={zoomLevel === "day" ? "default" : "ghost"}
                className="h-6 px-2 text-[10px]"
                onClick={() => setZoomLevel("day")}
                title="日単位表示"
              >
                <ZoomIn className="h-3 w-3 mr-0.5" />
                日
              </Button>
              <Button
                size="sm"
                variant={zoomLevel === "week" ? "default" : "ghost"}
                className="h-6 px-2 text-[10px]"
                onClick={() => setZoomLevel("week")}
                title="週単位表示"
              >
                週
              </Button>
              <Button
                size="sm"
                variant={zoomLevel === "month" ? "default" : "ghost"}
                className="h-6 px-2 text-[10px]"
                onClick={() => setZoomLevel("month")}
                title="月単位表示"
              >
                <ZoomOut className="h-3 w-3 mr-0.5" />
                月
              </Button>
            </div>

            {/* Category filter (partner view) */}
            {viewMode === "partner" && (
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
            )}

            {/* Assignee & Brand filter (case view) */}
            {viewMode === "case" && (
              <div className="flex items-center gap-1">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="担当者" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全担当者</SelectItem>
                    {assigneeOptions.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                    <SelectItem value="__unassigned__">未割当</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="ブランド" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全ブランド</SelectItem>
                    {brandOptions.map((brand) => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
      {(viewMode === "partner" ? filteredRows.length : filteredCaseRows.length) === 0 ? (
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
              <div className="flex border-b-2 border-border/60 bg-muted/50 sticky top-0 z-10">
                <div className="w-[200px] sm:w-[260px] flex-shrink-0 px-3 py-2.5 text-[11px] font-bold text-foreground/80 border-r-2 border-border/60 bg-muted/50">
                  {viewMode === "partner" ? "業者名" : "案件名"}
                </div>
                <div className="flex-1 flex">
                  {dateHeaders.map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 ${zoomLevel === "day" ? "min-w-[52px]" : zoomLevel === "month" ? "min-w-[5px]" : "min-w-[32px]"} text-center py-2 text-[10px] border-r border-border/40 ${
                        h.isWeekend ? "bg-rose-50/80" : ""
                      } ${h.isToday ? "bg-red-50 font-bold border-l-2 border-l-red-500" : ""}`}
                    >
                      {h.monthLabel && (
                        <div className="text-[9px] text-foreground/60 font-semibold">{h.monthLabel}</div>
                      )}
                      {h.label && <div className={h.isToday ? "text-red-600 font-bold" : "text-foreground/70 font-medium"}>{h.label}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows - partner or case based */}
              {viewMode === "partner" ? (
                <>
              {filteredRows.map((row, rowIdx) => {
                const rangeStartStr = fmtYmd(rangeStart);
                const rangeEndStr = fmtYmd(rangeEnd);
                const visibleItems = row.items.filter(
                  (item) => item.endDate >= rangeStartStr && item.startDate <= rangeEndStr
                );

                return (
                  <div key={row.id ?? "unassigned"} className={`flex border-b last:border-b-0 hover:bg-blue-50/40 transition-colors ${rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    {/* Partner name column */}
                    <div className="w-[200px] sm:w-[260px] flex-shrink-0 px-2 sm:px-3 py-2.5 border-r-2 border-border/40">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${row.id ? "bg-indigo-500" : "bg-gray-300"}`} />
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs sm:text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => row.id && setLocation(`/partners/${row.id}`)}
                            title={row.name}
                          >
                            {row.name}
                          </p>
                          {row.id && partnerMap.get(row.id) && (
                            <p className="text-[10px] text-muted-foreground font-medium">{partnerMap.get(row.id)!.category}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">{visibleItems.length} 件</p>
                        </div>
                      </div>
                    </div>

                    {/* Gantt area */}
                    <div className="flex-1 relative py-2" style={{ minHeight: `${Math.max(40, visibleItems.length * 28 + 12)}px` }}>
                      {/* Today line - prominent red indicator */}
                      {(() => {
                        const todayStr = fmtYmd(new Date());
                        const todayOffset = Math.round(
                          (new Date(todayStr).getTime() - rangeStart.getTime()) / 86400000
                        );
                        if (todayOffset >= 0 && todayOffset < totalDays) {
                          return (
                            <>
                              <div
                                className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-20 shadow-sm"
                                style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                              />
                              <div
                                className="absolute top-0 z-20 -translate-x-1/2"
                                style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                              >
                                <div className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-b font-bold whitespace-nowrap shadow-sm">
                                  TODAY
                                </div>
                              </div>
                            </>
                          );
                        }
                        return null;
                      })()}

                      {/* Weekend background stripes */}
                      {dateHeaders.map((h, i) =>
                        h.isWeekend ? (
                          <div
                            key={`bg-${i}`}
                            className="absolute top-0 bottom-0 bg-rose-50/60"
                            style={{ left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%` }}
                          />
                        ) : null
                      )}

                      {/* Schedule bars */}
                      {visibleItems.map((item, idx) => {
                        // Apply drag/resize offset if this item is being dragged
                        let effectiveStart = item.startDate;
                        let effectiveEnd = item.endDate;
                        if (dragState && dragState.itemId === item.id && dragState.itemType === item.type) {
                          if (!dragState.resizeMode) {
                            // Move entire bar
                            effectiveStart = fmtYmd(addDays(new Date(item.startDate), dragState.dayOffset));
                            effectiveEnd = fmtYmd(addDays(new Date(item.endDate), dragState.dayOffset));
                          } else if (dragState.resizeMode === "left") {
                            effectiveStart = fmtYmd(addDays(new Date(item.startDate), dragState.dayOffset));
                          } else if (dragState.resizeMode === "right") {
                            effectiveEnd = fmtYmd(addDays(new Date(item.endDate), dragState.dayOffset));
                          }
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
                        const topPx = idx * 28 + 4;
                        const isDragging = dragState?.itemId === item.id && dragState?.itemType === item.type;

                        return (
                          <div
                            key={`${item.type}-${item.id}`}
                            ref={isDragging ? dragItemRef : undefined}
                            className={`absolute h-[24px] rounded shadow-md overflow-hidden transition-all group/bar border ${
                              item.type === "schedule" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                            } ${isDragging ? "opacity-80 ring-2 ring-primary z-20 scale-[1.03]" : "hover:brightness-105 hover:shadow-lg"}`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 1.5)}%`,
                              top: `${topPx}px`,
                              backgroundColor: `color-mix(in srgb, ${item.color} 55%, transparent)`,
                              borderColor: `color-mix(in srgb, ${item.color} 70%, transparent)`,
                            }}
                            title={isDragging ? undefined : `${item.storeName} - ${item.title}\n${effectiveStart} 〜 ${effectiveEnd}\nステータス: ${item.status}${item.progress > 0 ? ` (${item.progress}%)` : ""}${item.type === "schedule" ? "\n※ドラッグで日程変更 / 端をドラッグで工期変更" : ""}`}
                            onMouseDown={(e) => handleDragStart(e, item)}
                            onTouchStart={(e) => handleDragStart(e, item)}
                            onClick={(e) => {
                              if (!dragState) setLocation(`/cases/${item.caseId}`);
                              e.stopPropagation();
                            }}
                          >
                            {/* Realtime date tooltip during drag/resize */}
                            {isDragging && (
                              <div
                                className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none"
                                style={{ minWidth: "max-content" }}
                              >
                                {dragState?.resizeMode === "left" && (
                                  <span>開始: <strong>{effectiveStart}</strong></span>
                                )}
                                {dragState?.resizeMode === "right" && (
                                  <span>終了: <strong>{effectiveEnd}</strong></span>
                                )}
                                {!dragState?.resizeMode && (
                                  <span>{effectiveStart} 〜 {effectiveEnd}</span>
                                )}
                              </div>
                            )}
                            {/* Left resize handle */}
                            {item.type === "schedule" && (
                              <div
                                className="absolute left-0 top-0 bottom-0 w-[7px] cursor-col-resize z-10 hover:bg-black/20 transition-colors flex items-center justify-center"
                                onMouseDown={(e) => handleResizeStart(e, item, "left")}
                                onTouchStart={(e) => handleResizeStart(e, item, "left")}
                                onClick={(e) => e.stopPropagation()}
                                title="左端をドラッグして開始日を変更"
                              >
                                <div className="w-[2px] h-[12px] bg-black/30 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                              </div>
                            )}
                            {/* Right resize handle */}
                            {item.type === "schedule" && (
                              <div
                                className="absolute right-0 top-0 bottom-0 w-[7px] cursor-col-resize z-10 hover:bg-black/20 transition-colors flex items-center justify-center"
                                onMouseDown={(e) => handleResizeStart(e, item, "right")}
                                onTouchStart={(e) => handleResizeStart(e, item, "right")}
                                onClick={(e) => e.stopPropagation()}
                                title="右端をドラッグして終了日を変更"
                              >
                                <div className="w-[2px] h-[12px] bg-black/30 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                              </div>
                            )}
                            {/* Progress fill */}
                            <div
                              className="absolute inset-y-0 left-0 rounded-sm"
                              style={{ width: `${item.progress}%`, backgroundColor: item.color }}
                            />
                            {/* Label */}
                            <span
                              className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold truncate z-[5] drop-shadow-sm gap-0.5"
                              style={{ color: item.progress > 50 ? "#fff" : "#1e293b" }}
                            >
                              {item.urgency && (
                                <span className={`inline-flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded text-[8px] font-bold mr-0.5 ${URGENCY_COLORS[item.urgency] || ""}`}>
                                  {item.urgency}
                                </span>
                              )}
                              {item.type === "route" && (
                                <span className="mr-0.5 text-[11px]">{item.taskType === "survey" ? "🔍" : "🔨"}</span>
                              )}
                              {item.status && item.type === "schedule" && (
                                <span className={`inline-flex h-3.5 items-center px-1 rounded text-[7px] font-bold mr-0.5 ${STATUS_COLORS[item.status] || "bg-slate-200 text-slate-700"}`}>
                                  {item.status === "完了" ? "✓" : item.status === "進行中" ? "▶" : "○"}
                                </span>
                              )}
                              <span className="truncate">
                                {item.storeName.length > 10 ? item.storeName.slice(0, 10) + "…" : item.storeName}
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
                </>
              ) : (
                <>
              {filteredCaseRows.map((row, rowIdx) => {
                const rangeStartStr = fmtYmd(rangeStart);
                const rangeEndStr = fmtYmd(rangeEnd);
                const visibleItems = row.items.filter(
                  (item) => item.endDate >= rangeStartStr && item.startDate <= rangeEndStr
                );

                return (
                  <div key={row.caseId} className={`flex border-b last:border-b-0 hover:bg-blue-50/40 transition-colors ${rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    {/* Case name column */}
                    <div className="w-[200px] sm:w-[260px] flex-shrink-0 px-2 sm:px-3 py-2.5 border-r-2 border-border/40">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-emerald-500" />
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs sm:text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => setLocation(`/cases/${row.caseId}`)}
                            title={row.storeName}
                          >
                            {row.storeName}
                          </p>
                          {row.assigneeName && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 font-medium">
                              <Users className="h-3 w-3" />
                              {row.assigneeName}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            {row.brand && <span className="mr-1">{row.brand}</span>}
                            {visibleItems.length} 件
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Gantt area */}
                    <div className="flex-1 relative py-2" style={{ minHeight: `${Math.max(40, visibleItems.length * 28 + 12)}px` }}>
                      {/* Today line */}
                      {(() => {
                        const todayStr = fmtYmd(new Date());
                        const todayOffset = Math.round(
                          (new Date(todayStr).getTime() - rangeStart.getTime()) / 86400000
                        );
                        if (todayOffset >= 0 && todayOffset < totalDays) {
                          return (
                            <>
                              <div
                                className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-20 shadow-sm"
                                style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                              />
                              <div
                                className="absolute top-0 z-20 -translate-x-1/2"
                                style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                              >
                                <div className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-b font-bold whitespace-nowrap shadow-sm">
                                  TODAY
                                </div>
                              </div>
                            </>
                          );
                        }
                        return null;
                      })()}

                      {/* Weekend background stripes */}
                      {dateHeaders.map((h, i) =>
                        h.isWeekend ? (
                          <div
                            key={`bg-${i}`}
                            className="absolute top-0 bottom-0 bg-rose-50/60"
                            style={{ left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%` }}
                          />
                        ) : null
                      )}

                      {/* Schedule bars */}
                      {visibleItems.map((item, idx) => {
                        let effectiveStart = item.startDate;
                        let effectiveEnd = item.endDate;
                        if (dragState && dragState.itemId === item.id && dragState.itemType === item.type) {
                          if (!dragState.resizeMode) {
                            effectiveStart = fmtYmd(addDays(new Date(item.startDate), dragState.dayOffset));
                            effectiveEnd = fmtYmd(addDays(new Date(item.endDate), dragState.dayOffset));
                          } else if (dragState.resizeMode === "left") {
                            effectiveStart = fmtYmd(addDays(new Date(item.startDate), dragState.dayOffset));
                          } else if (dragState.resizeMode === "right") {
                            effectiveEnd = fmtYmd(addDays(new Date(item.endDate), dragState.dayOffset));
                          }
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
                        const topPx = idx * 28 + 4;
                        const isDragging = dragState?.itemId === item.id && dragState?.itemType === item.type;

                        return (
                          <div
                            key={`${item.type}-${item.id}`}
                            ref={isDragging ? dragItemRef : undefined}
                            className={`absolute h-[24px] rounded shadow-md overflow-hidden transition-all group/bar border ${
                              item.type === "schedule" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                            } ${isDragging ? "opacity-80 ring-2 ring-primary z-20 scale-[1.03]" : "hover:brightness-105 hover:shadow-lg"}`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 1.5)}%`,
                              top: `${topPx}px`,
                              backgroundColor: `color-mix(in srgb, ${item.color} 55%, transparent)`,
                              borderColor: `color-mix(in srgb, ${item.color} 70%, transparent)`,
                            }}
                            title={isDragging ? undefined : `${item.storeName} - ${item.title}\n${effectiveStart} 〜 ${effectiveEnd}\nステータス: ${item.status}${item.progress > 0 ? ` (${item.progress}%)` : ""}${item.type === "schedule" ? "\n※ドラッグで日程変更 / 端をドラッグで工期変更" : ""}`}
                            onMouseDown={(e) => handleDragStart(e, item)}
                            onTouchStart={(e) => handleDragStart(e, item)}
                            onClick={(e) => {
                              if (!dragState) setLocation(`/cases/${item.caseId}`);
                              e.stopPropagation();
                            }}
                          >
                            {/* Realtime date tooltip during drag/resize */}
                            {isDragging && (
                              <div
                                className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none"
                                style={{ minWidth: "max-content" }}
                              >
                                {dragState?.resizeMode === "left" && (
                                  <span>開始: <strong>{effectiveStart}</strong></span>
                                )}
                                {dragState?.resizeMode === "right" && (
                                  <span>終了: <strong>{effectiveEnd}</strong></span>
                                )}
                                {!dragState?.resizeMode && (
                                  <span>{effectiveStart} 〜 {effectiveEnd}</span>
                                )}
                              </div>
                            )}
                            {/* Left resize handle */}
                            {item.type === "schedule" && (
                              <div
                                className="absolute left-0 top-0 bottom-0 w-[7px] cursor-col-resize z-10 hover:bg-black/20 transition-colors flex items-center justify-center"
                                onMouseDown={(e) => handleResizeStart(e, item, "left")}
                                onTouchStart={(e) => handleResizeStart(e, item, "left")}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="w-[2px] h-[12px] bg-black/30 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                              </div>
                            )}
                            {/* Right resize handle */}
                            {item.type === "schedule" && (
                              <div
                                className="absolute right-0 top-0 bottom-0 w-[7px] cursor-col-resize z-10 hover:bg-black/20 transition-colors flex items-center justify-center"
                                onMouseDown={(e) => handleResizeStart(e, item, "right")}
                                onTouchStart={(e) => handleResizeStart(e, item, "right")}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="w-[2px] h-[12px] bg-black/30 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                              </div>
                            )}
                            {/* Progress fill */}
                            <div
                              className="absolute inset-y-0 left-0 rounded-sm"
                              style={{ width: `${item.progress}%`, backgroundColor: item.color }}
                            />
                            {/* Label */}
                            <span
                              className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold truncate z-[5] drop-shadow-sm gap-0.5"
                              style={{ color: item.progress > 50 ? "#fff" : "#1e293b" }}
                            >
                              {item.urgency && (
                                <span className={`inline-flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded text-[8px] font-bold mr-0.5 ${URGENCY_COLORS[item.urgency] || ""}`}>
                                  {item.urgency}
                                </span>
                              )}
                              {item.type === "route" && (
                                <span className="mr-0.5 text-[11px]">{item.taskType === "survey" ? "🔍" : "🔨"}</span>
                              )}
                              {item.status && item.type === "schedule" && (
                                <span className={`inline-flex h-3.5 items-center px-1 rounded text-[7px] font-bold mr-0.5 ${STATUS_COLORS[item.status] || "bg-slate-200 text-slate-700"}`}>
                                  {item.status === "完了" ? "✓" : item.status === "進行中" ? "▶" : "○"}
                                </span>
                              )}
                              <span className="truncate">{item.title}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-4 text-[11px] sm:text-xs">
            <span className="font-bold text-foreground text-xs">凡例</span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-4 rounded shadow-sm bg-blue-500/55 border border-blue-500/70" />
              <span className="text-foreground/80 font-medium">工程スケジュール（ドラッグ可）</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-4 rounded shadow-sm bg-amber-500/55 border border-amber-500/70" />
              <span className="text-foreground/80 font-medium">🔍 現調</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-4 rounded shadow-sm bg-emerald-500/55 border border-emerald-500/70" />
              <span className="text-foreground/80 font-medium">🔨 工事</span>
            </span>
            <span className="border-l border-border/60 pl-4 flex items-center gap-1.5">
              <span className="w-[3px] h-5 bg-red-500 rounded-full" />
              <span className="text-foreground/80 font-medium">今日</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-4 rounded bg-rose-50 border border-rose-300" />
              <span className="text-foreground/80 font-medium">土日</span>
            </span>
            <span className="border-l border-border/60 pl-4 flex items-center gap-1.5">
              <span className="inline-flex h-4 items-center px-1 rounded bg-slate-200 text-slate-700 text-[8px] font-bold">○</span>
              <span className="text-foreground/80 font-medium">予定</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-4 items-center px-1 rounded bg-blue-200 text-blue-800 text-[8px] font-bold">▶</span>
              <span className="text-foreground/80 font-medium">進行中</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-4 items-center px-1 rounded bg-emerald-200 text-emerald-800 text-[8px] font-bold">✓</span>
              <span className="text-foreground/80 font-medium">完了</span>
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
