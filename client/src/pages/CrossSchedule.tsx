import { useMemo, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  CalendarDays,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  RefreshCw,
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
  id: number | null; // null = 未割当
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
  const { data, isLoading } = trpc.crossSchedule.list.useQuery();
  const { data: partnersData } = trpc.partners.list.useQuery();
  const utils = trpc.useUtils();

  // View range: default 4 weeks
  const [rangeWeeks, setRangeWeeks] = useState(4);
  const [offset, setOffset] = useState(0); // week offset from today
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const rangeStart = useMemo(() => {
    const today = startOfWeek(new Date());
    return addDays(today, offset * 7);
  }, [offset]);

  const rangeEnd = useMemo(() => addDays(rangeStart, rangeWeeks * 7 - 1), [rangeStart, rangeWeeks]);
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

    const rowMap = new Map<string, PartnerRow>(); // key: partnerId or "unassigned"

    // Process case_schedules
    for (const s of data.schedules as ScheduleItem[]) {
      const key = s.partnerId ? String(s.partnerId) : "unassigned";
      if (!rowMap.has(key)) {
        const partner = s.partnerId ? partnerMap.get(s.partnerId) : null;
        rowMap.set(key, {
          id: s.partnerId,
          name: partner?.name || s.contractorName || "未割当",
          items: [],
        });
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

    // Process route_assignments (convert single-day to schedule-like)
    for (const r of data.routes as RouteItem[]) {
      const key = r.partnerId ? String(r.partnerId) : "unassigned";
      if (!rowMap.has(key)) {
        const partner = r.partnerId ? partnerMap.get(r.partnerId) : null;
        rowMap.set(key, {
          id: r.partnerId,
          name: partner?.name || r.contractorName || "未割当",
          items: [],
        });
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

    // Sort rows: "unassigned" last, then alphabetical
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

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of partnersData ?? []) {
      cats.add(p.category);
    }
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
      headers.push({
        date: dateStr,
        label: `${d.getDate()}`,
        isWeekend,
        isToday,
        monthLabel,
      });
    }
    return headers;
  }, [rangeStart, totalDays]);

  // Stats
  const totalSchedules = data?.schedules?.length ?? 0;
  const totalRoutes = data?.routes?.length ?? 0;
  const activePartners = filteredRows.filter((r) => r.items.length > 0).length;

  const ganttRef = useRef<HTMLDivElement>(null);

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
                各業者のスケジュールを横断的に可視化。工程・現調・工事を一覧で確認できます。
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => utils.crossSchedule.list.invalidate()}
              >
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

            <span className="text-[10px] text-muted-foreground ml-auto">
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
              {/* Month row */}
              <div className="flex border-b bg-muted/20">
                <div className="w-[180px] sm:w-[220px] flex-shrink-0 border-r" />
                <div className="flex-1 flex">
                  {dateHeaders.map((h, i) => (
                    h.monthLabel ? (
                      <div
                        key={`month-${i}`}
                        className="text-[9px] font-bold text-muted-foreground px-1 py-0.5 border-l border-border/60"
                        style={{ position: "absolute", marginLeft: `calc(${(i / totalDays) * 100}%)` }}
                      >
                        {h.monthLabel}
                      </div>
                    ) : null
                  ))}
                </div>
              </div>

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
                // Filter items within the visible range
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
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            row.id ? "bg-indigo-500" : "bg-gray-300"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[11px] sm:text-xs font-medium truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => row.id && setLocation(`/partners/${row.id}`)}
                            title={row.name}
                          >
                            {row.name}
                          </p>
                          {row.id && partnerMap.get(row.id) && (
                            <p className="text-[9px] text-muted-foreground">
                              {partnerMap.get(row.id)!.category}
                            </p>
                          )}
                          <p className="text-[9px] text-muted-foreground">
                            {visibleItems.length} 件
                          </p>
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
                            style={{
                              left: `${(i / totalDays) * 100}%`,
                              width: `${(1 / totalDays) * 100}%`,
                            }}
                          />
                        ) : null
                      )}

                      {/* Schedule bars */}
                      {visibleItems.map((item, idx) => {
                        const itemStart = new Date(item.startDate);
                        const itemEnd = new Date(item.endDate);
                        const offsetDays = Math.max(
                          0,
                          Math.round((itemStart.getTime() - rangeStart.getTime()) / 86400000)
                        );
                        const durationDays = Math.max(
                          1,
                          Math.round((itemEnd.getTime() - itemStart.getTime()) / 86400000) + 1
                        );
                        // Clamp to visible range
                        const clampedOffset = Math.max(0, offsetDays);
                        const clampedEnd = Math.min(totalDays, offsetDays + durationDays);
                        const clampedDuration = clampedEnd - clampedOffset;

                        const leftPct = (clampedOffset / totalDays) * 100;
                        const widthPct = (clampedDuration / totalDays) * 100;
                        const topPx = idx * 22 + 4;

                        return (
                          <div
                            key={`${item.type}-${item.id}`}
                            className="absolute h-[18px] rounded-sm shadow-sm overflow-hidden cursor-pointer hover:brightness-110 transition-all group/bar"
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 1.5)}%`,
                              top: `${topPx}px`,
                              backgroundColor: `color-mix(in srgb, ${item.color} 35%, transparent)`,
                            }}
                            title={`${item.storeName} - ${item.title}\n${item.startDate} 〜 ${item.endDate}\nステータス: ${item.status}${item.progress > 0 ? ` (${item.progress}%)` : ""}`}
                            onClick={() => setLocation(`/cases/${item.caseId}`)}
                          >
                            {/* Progress fill */}
                            <div
                              className="absolute inset-y-0 left-0 rounded-sm"
                              style={{
                                width: `${item.progress}%`,
                                backgroundColor: item.color,
                              }}
                            />
                            {/* Label */}
                            <span className="absolute inset-0 flex items-center px-1 text-[9px] font-medium truncate z-[5] drop-shadow-sm"
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
              工程スケジュール
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
    </div>
  );
}
