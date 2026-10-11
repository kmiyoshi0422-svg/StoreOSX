import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { PersonalProgressCharts } from "@/components/PersonalProgressCharts";
import { PartnerDeadlineSummary, PartnerDeadlineBadge, deadlineCardClass } from "@/components/PartnerDeadlineSummary";
import { deadlineInfo } from "@shared/caseDeadline";
import {
  CASE_DATE_FIELDS,
  matchesCaseDateFilter,
  validCaseDateRange,
  type CaseDateField,
  type CaseDateFilter,
} from "@shared/caseDateFilter";
import { officerName, summarizePersonalCases } from "@shared/caseResponsibility";
import { CASE_STATUSES, PROGRESS_STAGES } from "@shared/stageStatus";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Search,
  UserRound,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  "受付": "bg-slate-100 text-slate-700 border-slate-200",
  "現調中": "bg-amber-50 text-amber-700 border-amber-200",
  "見積中": "bg-blue-50 text-blue-700 border-blue-200",
  "施工待ち": "bg-purple-50 text-purple-700 border-purple-200",
  "施工中": "bg-orange-50 text-orange-700 border-orange-200",
  "完了": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "クローズ": "bg-zinc-100 text-zinc-600 border-zinc-200",
  "失注": "bg-rose-50 text-rose-700 border-rose-200",
};

const STAGE_COLORS: Record<string, string> = {
  "未対応": "bg-slate-100 text-slate-700 border-slate-200",
  "現調済": "bg-amber-50 text-amber-700 border-amber-200",
  "見積提出済": "bg-blue-50 text-blue-700 border-blue-200",
  "承認済": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const URGENCY_COLORS: Record<string, string> = {
  S: "bg-red-600 text-white border-red-600",
  A: "bg-orange-500 text-white border-orange-500",
  B: "bg-yellow-100 text-yellow-800 border-yellow-200",
  C: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const URGENCY_LABELS: Record<string, string> = {
  S: "緊急",
  A: "高",
  B: "中",
  C: "低",
};

const PAGE_SIZE = 30;

type CaseTab = "all" | "active" | "completed" | "lost";
type ResponsibilityFilter = "all" | "responsible" | "assigned";

function formatDate(value: Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function countByTab(summary: ReturnType<typeof summarizePersonalCases>, tab: CaseTab) {
  if (tab === "active") return summary.active;
  if (tab === "completed") return summary.completed;
  if (tab === "lost") return summary.lost;
  return summary.total;
}

function isCompletedStatus(status: string) {
  return status === "完了" || status === "クローズ";
}

function CountPill({ count }: { count: number }) {
  return (
    <span className="ml-1 rounded-full bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] leading-none">
      {count}
    </span>
  );
}

export default function MyCases() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const personalQuery = trpc.responsibility.personal.useQuery(undefined, { refetchInterval: 60_000 });

  const rows = personalQuery.data?.rows ?? [];
  const serverSummary = personalQuery.data?.summary;
  const officerKey = personalQuery.data?.officerKey ?? null;
  const assignmentKind = personalQuery.data?.assignmentKind;

  const [caseTab, setCaseTab] = useState<CaseTab>("all");
  const [responsibilityFilter, setResponsibilityFilter] = useState<ResponsibilityFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [dateField, setDateField] = useState<CaseDateField>("firstResponseDate");
  const [dateMode, setDateMode] = useState<CaseDateFilter["mode"]>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [deadlineFilter, setDeadlineFilter] = useState<'all' | 'attention'>('all');
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 60_000); return () => clearInterval(timer); }, []);

  const dateRangeValid = validCaseDateRange({ from: dateFrom, to: dateTo });

  const baseSummary = useMemo(
    () => serverSummary ?? summarizePersonalCases(rows),
    [rows, serverSummary],
  );

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase("ja-JP");

    return rows.filter((row) => {
      const isResponsible = Boolean(officerKey && row.responsibleOfficer === officerKey);
      const isAssigned = row.isOwnAssignment;

      if (caseTab === "active" && ["完了", "クローズ", "失注"].includes(row.status)) return false;
      if (caseTab === "completed" && !isCompletedStatus(row.status)) return false;
      if (caseTab === "lost" && row.status !== "失注") return false;
      if (responsibilityFilter === "responsible" && !isResponsible) return false;
      if (responsibilityFilter === "assigned" && !isAssigned) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (stageFilter !== "all" && (row.progressStage || "未対応") !== stageFilter) return false;
      if (urgencyFilter !== "all" && row.urgency !== urgencyFilter) return false;
      if (assignmentKind === 'partner' && deadlineFilter === 'attention' && !['soon', 'today', 'overdue'].includes(deadlineInfo({ status: row.status, deadline: row.completionDeadline }, clock).state)) return false;
      if (!matchesCaseDateFilter(row, { field: dateField, mode: dateMode, from: dateFrom, to: dateTo })) return false;

      if (!keyword) return true;
      return [
        row.requestNumber,
        row.storeName,
        row.brand,
        row.prefecture,
        row.requestContent,
        row.responsibleOfficer ? officerName(row.responsibleOfficer) : null,
      ].some((value) => value?.toLocaleLowerCase("ja-JP").includes(keyword));
    });
  }, [
    rows,
    officerKey,
    assignmentKind,
    deadlineFilter,
    clock,
    user?.id,
    caseTab,
    responsibilityFilter,
    statusFilter,
    stageFilter,
    urgencyFilter,
    searchText,
    dateField,
    dateMode,
    dateFrom,
    dateTo,
  ]);

  const filteredSummary = useMemo(() => summarizePersonalCases(filteredRows), [filteredRows]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount);
  const pagedRows = useMemo(
    () => filteredRows.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE),
    [filteredRows, visiblePage],
  );

  useEffect(() => {
    setPage(1);
  }, [
    deadlineFilter,
    caseTab,
    responsibilityFilter,
    statusFilter,
    stageFilter,
    urgencyFilter,
    searchText,
    dateField,
    dateMode,
    dateFrom,
    dateTo,
  ]);

  const clearFilters = () => {
    setDeadlineFilter('all');
    setCaseTab("all");
    setResponsibilityFilter("all");
    setStatusFilter("all");
    setStageFilter("all");
    setUrgencyFilter("all");
    setSearchText("");
    setDateField("firstResponseDate");
    setDateMode("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters =
    deadlineFilter !== 'all' ||
    caseTab !== "all" ||
    responsibilityFilter !== "all" ||
    statusFilter !== "all" ||
    stageFilter !== "all" ||
    urgencyFilter !== "all" ||
    Boolean(searchText) ||
    dateField !== "firstResponseDate" ||
    dateMode !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const summaryEntries = [
    { label: "進行中", value: filteredSummary.active, className: "text-blue-700" },
    { label: "完了", value: filteredSummary.completed, className: "text-emerald-700" },
    { label: "失注", value: filteredSummary.lost, className: "text-rose-700" },
    { label: "緊急（S）", value: filteredSummary.urgent, className: "text-red-700" },
  ];

  const statusBreakdown = [
    ...CASE_STATUSES.filter((status) => filteredSummary.byStatus[status] != null),
    ...Object.keys(filteredSummary.byStatus).filter((status) => !CASE_STATUSES.includes(status as (typeof CASE_STATUSES)[number])),
  ];
  const stageBreakdown = [
    ...PROGRESS_STAGES.filter((stage) => filteredSummary.byStage[stage] != null),
    ...Object.keys(filteredSummary.byStage).filter((stage) => !PROGRESS_STAGES.includes(stage as (typeof PROGRESS_STAGES)[number])),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-8">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Personal cases</p>
          <h1 className="font-serif-jp text-2xl font-semibold tracking-tight sm:text-3xl">自分の担当案件</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            ログイン中の本人が責任者または作業担当として割り当てられた案件のみを表示しています。
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserRound className="h-4 w-4 shrink-0" />
          <span className="truncate">{user?.name || user?.email || "ログインユーザー"}</span>
        </div>
      </header>

      <Tabs value={caseTab} onValueChange={(value) => setCaseTab(value as CaseTab)}>
        <TabsList className="grid h-auto w-full grid-cols-4 bg-stone-100/80 p-1">
          <TabsTrigger value="all" className="px-2 py-2 text-xs data-[state=active]:bg-white sm:text-sm">
            すべて <CountPill count={countByTab(baseSummary, "all")} />
          </TabsTrigger>
          <TabsTrigger value="active" className="px-2 py-2 text-xs data-[state=active]:bg-white sm:text-sm">
            進行中 <CountPill count={countByTab(baseSummary, "active")} />
          </TabsTrigger>
          <TabsTrigger value="completed" className="px-2 py-2 text-xs data-[state=active]:bg-white sm:text-sm">
            完了 <CountPill count={countByTab(baseSummary, "completed")} />
          </TabsTrigger>
          <TabsTrigger value="lost" className="px-2 py-2 text-xs data-[state=active]:bg-white sm:text-sm">
            失注 <CountPill count={countByTab(baseSummary, "lost")} />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {assignmentKind === 'partner' && <PartnerDeadlineSummary rows={rows.map(row => ({ status: row.status, deadline: row.completionDeadline }))} filter={deadlineFilter} onFilter={setDeadlineFilter} sourceLabel="完了期限" />}

      {assignmentKind !== "partner" && (
        <section aria-label="担当区分" className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center">
          <span className="text-xs font-medium text-muted-foreground">表示する担当区分</span>
          <Tabs value={responsibilityFilter} onValueChange={(value) => setResponsibilityFilter(value as ResponsibilityFilter)}>
            <TabsList className="h-8 bg-background">
              <TabsTrigger value="all" className="px-3 text-xs">すべて</TabsTrigger>
              <TabsTrigger value="responsible" className="px-3 text-xs">責任案件</TabsTrigger>
              <TabsTrigger value="assigned" className="px-3 text-xs">作業担当</TabsTrigger>
            </TabsList>
          </Tabs>
          {officerKey && (
            <span className="text-xs text-muted-foreground sm:ml-auto">責任者: {officerName(officerKey)}</span>
          )}
        </section>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-1 px-4 pb-3 pt-4 sm:px-5">
          <CardTitle className="text-base">検索・絞り込み</CardTitle>
          <CardDescription>日付は選択した項目だけを比較し、未入力の実績を補完しません。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="pl-9"
                placeholder="店舗名・依頼番号・依頼内容で検索"
                aria-label="案件を検索"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="ステータスで絞り込む"><SelectValue placeholder="ステータス" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全ステータス</SelectItem>
                {CASE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger aria-label="緊急度で絞り込む"><SelectValue placeholder="緊急度" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全緊急度</SelectItem>
                {Object.entries(URGENCY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{value} {label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5"><Label>進捗</Label><Select value={stageFilter} onValueChange={setStageFilter}><SelectTrigger aria-label="進捗で絞り込む"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全進捗</SelectItem>{PROGRESS_STAGES.map(stage => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5 xl:col-span-2">
              <Label htmlFor="my-cases-date-field">日付の種類</Label>
              <Select value={dateField} onValueChange={(value) => setDateField(value as CaseDateField)}>
                <SelectTrigger id="my-cases-date-field"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CASE_DATE_FIELDS.map((field) => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="my-cases-date-mode">入力状態</Label>
              <Select
                value={dateMode}
                onValueChange={(value) => {
                  const nextMode = value as CaseDateFilter["mode"];
                  setDateMode(nextMode);
                  if (nextMode === "unset") {
                    setDateFrom("");
                    setDateTo("");
                  }
                }}
              >
                <SelectTrigger id="my-cases-date-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="set">日付入力済み</SelectItem>
                  <SelectItem value="unset">日付未設定</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="my-cases-date-from">開始日</Label>
              <Input
                id="my-cases-date-from"
                type="date"
                value={dateFrom}
                disabled={dateMode === "unset"}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="my-cases-date-to">終了日</Label>
              <Input
                id="my-cases-date-to"
                type="date"
                value={dateTo}
                disabled={dateMode === "unset"}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-xs ${dateRangeValid ? "text-muted-foreground" : "text-destructive"}`} role={dateRangeValid ? undefined : "alert"}>
              {dateRangeValid
                ? "期間指定では、選択した日付が未設定の案件は含まれません。"
                : "有効な日付を入力し、終了日は開始日以降にしてください。"}
            </p>
            {hasFilters && <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>条件をクリア</Button>}
          </div>
        </CardContent>
      </Card>

      <section aria-label="絞り込み後の集計" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif-jp text-lg font-semibold">絞り込み結果</h2>
          <p aria-live="polite" className="text-sm text-muted-foreground">{filteredSummary.total} / {baseSummary.total} 件</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Card className="border-primary/20 bg-primary/5 shadow-none">
            <CardContent className="p-3"><p className="text-xs text-muted-foreground">該当件数</p><p className="mt-1 font-mono text-2xl font-semibold">{filteredSummary.total}</p></CardContent>
          </Card>
          {summaryEntries.map((entry) => (
            <Card key={entry.label} className="shadow-none">
              <CardContent className="p-3"><p className="text-xs text-muted-foreground">{entry.label}</p><p className={`mt-1 font-mono text-2xl font-semibold ${entry.className}`}>{entry.value}</p></CardContent>
            </Card>
          ))}
        </div>
        <PersonalProgressCharts byStatus={filteredSummary.byStatus} byStage={filteredSummary.byStage}
          onStatus={setStatusFilter} onStage={setStageFilter} />
      </section>

      <section aria-label="担当案件一覧" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif-jp text-lg font-semibold">案件一覧</h2>
          {!personalQuery.isLoading && filteredRows.length > 0 && (
            <p className="text-xs text-muted-foreground">{(visiblePage - 1) * PAGE_SIZE + 1}〜{Math.min(visiblePage * PAGE_SIZE, filteredRows.length)}件を表示</p>
          )}
        </div>

        {personalQuery.isLoading ? (
          <Card><CardContent className="space-y-3 p-4 sm:p-5">
            {[1, 2, 3].map((index) => <Skeleton key={index} className="h-28 w-full" />)}
          </CardContent></Card>
        ) : personalQuery.isError ? (
          <Card className="border-destructive/40"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-9 w-9 text-destructive" />
            <div><p className="font-medium">担当案件を読み込めませんでした</p><p className="mt-1 text-sm text-muted-foreground">{personalQuery.error.message}</p></div>
          </CardContent></Card>
        ) : filteredRows.length === 0 ? (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/70" />
            <div><p className="font-medium">{rows.length === 0 ? "本人担当の案件はありません" : "条件に一致する案件がありません"}</p><p className="mt-1 text-sm text-muted-foreground">{rows.length === 0 ? "案件が割り当てられると、ここに表示されます。" : "検索条件や日付条件を変更してお試しください。"}</p></div>
            {hasFilters && <Button variant="outline" size="sm" onClick={clearFilters}>条件をクリア</Button>}
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {pagedRows.map((row) => {
              const isResponsible = Boolean(officerKey && row.responsibleOfficer === officerKey);
              const isAssigned = row.isOwnAssignment;
              const dateItems = [
                { label: "依頼", value: formatDate(row.requestDate) },
                { label: "初回対応", value: formatDate(row.firstResponseDate) },
                { label: "対応予定", value: formatDate(row.responsePlannedDate) },
                { label: "現調", value: formatDate(row.surveyDate) },
                { label: "施工予定", value: formatDate(row.constructionDate) },
              ].filter((item): item is { label: string; value: string } => Boolean(item.value));

              return (
                <Card key={row.id} data-deadline-state={assignmentKind === 'partner' ? deadlineInfo({ status: row.status, deadline: row.completionDeadline }, clock).state : undefined} className={`overflow-hidden transition-shadow hover:shadow-md ${assignmentKind === 'partner' ? deadlineCardClass(row.status, row.completionDeadline) : 'border-border/80'}`}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={URGENCY_COLORS[row.urgency] ?? "bg-muted text-muted-foreground"}>{row.urgency} {URGENCY_LABELS[row.urgency] ?? ""}</Badge>
                          <Badge variant="outline" className={STATUS_COLORS[row.status] ?? "bg-muted text-muted-foreground"}>{row.status}</Badge>
                          <Badge variant="outline" className={STAGE_COLORS[row.progressStage] ?? "bg-muted text-muted-foreground"}>{row.progressStage || "未対応"}</Badge>
                          {isResponsible && <Badge variant="secondary">責任案件</Badge>}
                          {assignmentKind !== "partner" && isAssigned && <Badge variant="secondary">作業担当</Badge>}
                          {assignmentKind === "partner" && <Badge variant="secondary">本人担当</Badge>}
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h3 className="min-w-0 text-base font-semibold sm:text-lg">{row.storeName}</h3>
                          {row.brand && <span className="text-sm text-muted-foreground">{row.brand}</span>}
                          {row.prefecture && <span className="text-xs text-muted-foreground">{row.prefecture}</span>}
                        </div>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{row.requestNumber}</p>
                        {row.requestContent ? (
                          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground/85">{row.requestContent}</p>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">依頼内容は表示対象外または未登録です。</p>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0 self-start" onClick={() => setLocation(`/cases/${row.id}`)}>
                        案件詳細へ <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3"><PartnerDeadlineBadge status={row.status} deadline={row.completionDeadline} sourceLabel="完了期限" /></div>
                    <div className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="inline-flex items-center gap-1 font-medium text-foreground/80"><CalendarDays className="h-3.5 w-3.5" />日付</span>
                        {dateItems.length ? dateItems.map((item) => <span key={item.label}>{item.label}: {item.value}</span>) : <span>登録済みの日付はありません</span>}
                      </div>
                      {row.responsibleOfficer && <span className="inline-flex shrink-0 items-center gap-1"><UserRound className="h-3.5 w-3.5" />責任者: {officerName(row.responsibleOfficer)}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filteredRows.length > PAGE_SIZE && (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">全 {filteredRows.length} 件中、{visiblePage} / {pageCount} ページ</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={visiblePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" />前の30件</Button>
                  <Button variant="outline" size="sm" disabled={visiblePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>次の30件<ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
