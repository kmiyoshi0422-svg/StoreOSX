import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Filter, X, Search, Calendar } from "lucide-react";
import { useLocation } from "wouter";

type ScheduleRow = {
  scheduleId: number;
  caseId: number;
  title: string;
  startDate: string;
  endDate: string;
  status: "予定" | "進行中" | "完了";
  color: string | null;
  progress: number;
  orderNo: number;
  memo: string | null;
  storeName: string | null;
  requestNumber: string | null;
  brand: string | null;
  prefecture: string | null;
  caseStatus: string | null;
  assigneeId: number | null;
};

type ViewMode = "month" | "week";

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const STATUS_COLORS: Record<string, string> = {
  "予定": "bg-gray-100 text-gray-700 border-gray-300",
  "進行中": "bg-blue-100 text-blue-700 border-blue-300",
  "完了": "bg-green-100 text-green-700 border-green-300",
};

export default function CrossSchedule() {
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPrefecture, setFilterPrefecture] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: schedules, isLoading } = trpc.schedules.listAll.useQuery();

  // Collect unique filter values
  const { prefectures, brands } = useMemo(() => {
    if (!schedules) return { prefectures: [] as string[], brands: [] as string[] };
    const prefSet = new Set<string>();
    const brandSet = new Set<string>();
    schedules.forEach((s: ScheduleRow) => {
      if (s.prefecture) prefSet.add(s.prefecture);
      if (s.brand) brandSet.add(s.brand);
    });
    return {
      prefectures: Array.from(prefSet).sort(),
      brands: Array.from(brandSet).sort(),
    };
  }, [schedules]);

  // Filter schedules
  const filteredSchedules = useMemo(() => {
    if (!schedules) return [];
    return (schedules as ScheduleRow[]).filter((s) => {
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (filterPrefecture !== "all" && s.prefecture !== filterPrefecture) return false;
      if (filterBrand !== "all" && s.brand !== filterBrand) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const match =
          s.title.toLowerCase().includes(q) ||
          (s.storeName || "").toLowerCase().includes(q) ||
          (s.requestNumber || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [schedules, filterStatus, filterPrefecture, filterBrand, searchText]);

  // Group by case
  const groupedByCaseId = useMemo(() => {
    const map = new Map<number, ScheduleRow[]>();
    filteredSchedules.forEach((s) => {
      const arr = map.get(s.caseId) || [];
      arr.push(s);
      map.set(s.caseId, arr);
    });
    return map;
  }, [filteredSchedules]);

  // Calculate date range for display
  const { startDate, endDate, days, headerDates } = useMemo(() => {
    let start: Date;
    let end: Date;
    if (viewMode === "month") {
      start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      end = new Date(currentDate.getFullYear(), currentDate.getMonth(), getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()));
    } else {
      start = getMonday(currentDate);
      end = addDays(start, 13); // 2 weeks
    }
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const dates: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      dates.push(addDays(start, i));
    }
    return { startDate: start, endDate: end, days: totalDays, headerDates: dates };
  }, [currentDate, viewMode]);

  // Navigation
  const goNext = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      setCurrentDate(addDays(currentDate, 14));
    }
  };
  const goPrev = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(addDays(currentDate, -14));
    }
  };
  const goToday = () => setCurrentDate(new Date());

  // Calculate bar position
  const getBarStyle = (s: ScheduleRow) => {
    const sDate = parseDate(s.startDate);
    const eDate = parseDate(s.endDate);
    const rangeStart = startDate.getTime();
    const rangeEnd = endDate.getTime();
    const sTime = Math.max(sDate.getTime(), rangeStart);
    const eTime = Math.min(eDate.getTime(), rangeEnd);
    if (sTime > rangeEnd || eTime < rangeStart) return null;
    const dayWidth = 100 / days;
    const leftDays = (sTime - rangeStart) / (1000 * 60 * 60 * 24);
    const widthDays = (eTime - sTime) / (1000 * 60 * 60 * 24) + 1;
    return {
      left: `${leftDays * dayWidth}%`,
      width: `${widthDays * dayWidth}%`,
    };
  };

  const titleLabel = viewMode === "month"
    ? `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`
    : `${formatDate(getMonday(currentDate))} 〜 ${formatDate(addDays(getMonday(currentDate), 13))}`;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          横断工程表
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1" />
            フィルタ
            {(filterStatus !== "all" || filterPrefecture !== "all" || filterBrand !== "all" || searchText) && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">!</Badge>
            )}
          </Button>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">月表示</SelectItem>
              <SelectItem value="week">2週表示</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">キーワード</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="店舗名・工程名..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-7 h-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ステータス</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="予定">予定</SelectItem>
                    <SelectItem value="進行中">進行中</SelectItem>
                    <SelectItem value="完了">完了</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">県</label>
                <Select value={filterPrefecture} onValueChange={setFilterPrefecture}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {prefectures.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ブランド</label>
                <Select value={filterBrand} onValueChange={setFilterBrand}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(filterStatus !== "all" || filterPrefecture !== "all" || filterBrand !== "all" || searchText) && (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterStatus("all");
                    setFilterPrefecture("all");
                    setFilterBrand("all");
                    setSearchText("");
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  リセット
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-sm min-w-[140px] text-center">{titleLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday} className="text-xs">
            今日
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {filteredSchedules.length}件 / {groupedByCaseId.size}案件
        </div>
      </div>

      {/* Gantt Chart */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto" ref={scrollRef}>
          <div className="min-w-[800px]">
            {/* Header row - dates */}
            <div className="flex border-b bg-muted/50 sticky top-0 z-10">
              <div className="w-[200px] min-w-[200px] shrink-0 p-2 text-xs font-medium border-r bg-muted/80">
                案件 / 工程
              </div>
              <div className="flex-1 flex relative">
                {headerDates.map((d, i) => {
                  const isToday = formatDate(d) === formatDate(new Date());
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
                  return (
                    <div
                      key={i}
                      className={`flex-1 text-center text-[10px] py-1 border-r last:border-r-0 ${
                        isToday ? "bg-blue-100 font-bold" : isWeekend ? "bg-red-50" : ""
                      }`}
                    >
                      <div className={isWeekend ? "text-red-500" : ""}>{d.getDate()}</div>
                      <div className={`text-[9px] ${isWeekend ? "text-red-400" : "text-muted-foreground"}`}>
                        {dayOfWeek}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body rows */}
            {groupedByCaseId.size === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {schedules && schedules.length === 0
                  ? "工程スケジュールが登録されていません。案件詳細の「工程」タブから追加できます。"
                  : "フィルタ条件に一致する工程がありません。"}
              </div>
            ) : (
              Array.from(groupedByCaseId.entries()).map(([caseId, items]) => {
                const first = items[0];
                return (
                  <div key={caseId} className="border-b last:border-b-0">
                    {/* Case header row */}
                    <div className="flex bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="w-[200px] min-w-[200px] shrink-0 p-2 border-r">
                        <button
                          className="text-left w-full group"
                          onClick={() => navigate(`/cases/${caseId}`)}
                        >
                          <div className="text-xs font-medium text-primary group-hover:underline truncate">
                            {first.storeName || "（店舗名なし）"}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {first.requestNumber && `#${first.requestNumber}`}
                            {first.brand && ` ${first.brand}`}
                            {first.prefecture && ` ${first.prefecture}`}
                          </div>
                        </button>
                      </div>
                      <div className="flex-1 relative" style={{ height: "32px" }}>
                        {/* Today line */}
                        {(() => {
                          const today = new Date();
                          const todayStr = formatDate(today);
                          const rangeStartTime = startDate.getTime();
                          const rangeEndTime = endDate.getTime();
                          const todayTime = parseDate(todayStr).getTime();
                          if (todayTime >= rangeStartTime && todayTime <= rangeEndTime) {
                            const dayWidth = 100 / days;
                            const leftDays = (todayTime - rangeStartTime) / (1000 * 60 * 60 * 24);
                            return (
                              <div
                                className="absolute top-0 bottom-0 w-px bg-red-400 z-5"
                                style={{ left: `${(leftDays + 0.5) * dayWidth}%` }}
                              />
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* Schedule bars */}
                    {items
                      .sort((a, b) => a.orderNo - b.orderNo)
                      .map((item) => {
                        const barStyle = getBarStyle(item);
                        return (
                          <div key={item.scheduleId} className="flex hover:bg-accent/30 transition-colors">
                            <div className="w-[200px] min-w-[200px] shrink-0 pl-6 pr-2 py-1 border-r flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: item.color || "#3b82f6" }}
                              />
                              <span className="text-[11px] truncate">{item.title}</span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ml-auto shrink-0 ${STATUS_COLORS[item.status] || ""}`}
                              >
                                {item.status}
                              </Badge>
                            </div>
                            <div className="flex-1 relative" style={{ height: "28px" }}>
                              {/* Grid lines */}
                              {headerDates.map((d, i) => {
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                  <div
                                    key={i}
                                    className={`absolute top-0 bottom-0 border-r border-border/30 ${isWeekend ? "bg-red-50/30" : ""}`}
                                    style={{ left: `${(i / days) * 100}%`, width: `${100 / days}%` }}
                                  />
                                );
                              })}
                              {/* Today line */}
                              {(() => {
                                const today = new Date();
                                const todayStr = formatDate(today);
                                const rangeStartTime = startDate.getTime();
                                const rangeEndTime = endDate.getTime();
                                const todayTime = parseDate(todayStr).getTime();
                                if (todayTime >= rangeStartTime && todayTime <= rangeEndTime) {
                                  const dayWidth = 100 / days;
                                  const leftDays = (todayTime - rangeStartTime) / (1000 * 60 * 60 * 24);
                                  return (
                                    <div
                                      className="absolute top-0 bottom-0 w-px bg-red-400 z-5"
                                      style={{ left: `${(leftDays + 0.5) * dayWidth}%` }}
                                    />
                                  );
                                }
                                return null;
                              })()}
                              {/* Bar */}
                              {barStyle && (
                                <div
                                  className="absolute top-1 bottom-1 rounded-sm flex items-center overflow-hidden cursor-pointer group"
                                  style={{
                                    left: barStyle.left,
                                    width: barStyle.width,
                                    backgroundColor: item.color || "#3b82f6",
                                    opacity: item.status === "完了" ? 0.6 : 0.85,
                                  }}
                                  title={`${item.title}\n${item.startDate} 〜 ${item.endDate}\n進捗: ${item.progress}%\n${item.memo || ""}`}
                                  onClick={() => navigate(`/cases/${item.caseId}`)}
                                >
                                  {/* Progress fill */}
                                  {item.progress > 0 && item.progress < 100 && (
                                    <div
                                      className="absolute inset-0 bg-white/20"
                                      style={{ width: `${item.progress}%` }}
                                    />
                                  )}
                                  <span className="text-[9px] text-white font-medium px-1 truncate relative z-1 drop-shadow-sm">
                                    {item.title}
                                    {item.progress > 0 && ` (${item.progress}%)`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium">凡例:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-gray-300 inline-block" /> 予定
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> 進行中
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-green-500 opacity-60 inline-block" /> 完了
        </span>
        <span className="flex items-center gap-1">
          <span className="w-px h-4 bg-red-400 inline-block" /> 今日
        </span>
      </div>
    </div>
  );
}
