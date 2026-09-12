import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import ScheduleBoard from "@/components/ScheduleBoard";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Minus,
  AlertTriangle,
  Zap,
  FileText,
  Wrench,
  BookCheck,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  BarChart3,
  PieChart as PieChartIcon,
  Camera,
  FileCheck,
  ChevronRight,
  CalendarDays,
  BellRing,
  Pencil,
  CalendarX,
  ListChecks,
} from "lucide-react";
import { usePdfHistoryRecorder } from "@/hooks/usePdfHistoryRecorder";
import { applyRootSeoMetadata, ROOT_SEO } from "@/lib/seo";

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

const URGENCY_LABEL: Record<string, string> = {
  S: "緊急",
  A: "高",
  B: "中",
  C: "低",
};

const STATUS_CHART_COLORS = ["#64748b", "#d97706", "#2563eb", "#7c3aed", "#ea580c", "#059669", "#71717a"];
const URGENCY_CHART_COLORS: Record<string, string> = {
  S: "#dc2626",
  A: "#f97316",
  B: "#eab308",
  C: "#10b981",
};

type DashboardCase = {
  id: number;
  requestNumber: string;
  brand?: string | null;
  storeName: string;
  storeCode?: string | null;
  prefecture?: string | null;
  status: string;
  progressStage?: string | null;
  urgency: string;
  requestDate?: Date | string | null;
  createdAt?: Date | string | null;
  constructionDate?: Date | string | null;
  surveyDate?: Date | string | null;
  revisitCount?: number | null;
  assigneeId?: number | null;
  assigneeName?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  categoryLarge?: string | null;
  categoryMedium?: string | null;
  categorySmall?: string | null;
  requestContent?: string | null;
  contractorName?: string | null;
  partnerId?: number | null;
};

type AttentionCase = DashboardCase & {
  daysElapsed: number;
  constructionDate: Date | string | null;
  constructionWeekStart: Date | string | null;
  constructionWeekEnd: Date | string | null;
};

type AttentionCaseGroups = {
  threeMonthsOrMore: AttentionCase[];
  oneToThreeMonths: AttentionCase[];
  leakageRelated: AttentionCase[];
};

type DashboardAlert = {
  caseId: number;
  requestNumber: string;
  storeName: string;
  kpiType: string;
  severity: "overdue" | "warning";
  daysElapsed: number;
  deadline: number;
  message: string;
};

type DrilldownState = {
  title: string;
  description: string;
  rows: DashboardCase[];
} | null;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatScheduleDate(value: Date | string | null | undefined) {
  if (!value) return "未設定";
  return new Date(value).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
}

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

type PeriodPreset = "all" | "thisMonth" | "lastMonth" | "threeMonths" | "sixMonths" | "custom";

function periodRange(preset: PeriodPreset, customStart: string, customEnd: string) {
  const now = new Date();
  let from: Date | null = null;
  let to: Date | null = null;
  let label = "全期間";
  if (preset === "thisMonth") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    label = "今月";
  } else if (preset === "lastMonth") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    label = "先月";
  } else if (preset === "threeMonths" || preset === "sixMonths") {
    const months = preset === "threeMonths" ? 3 : 6;
    from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    label = `過去${months}か月`;
  } else if (preset === "custom") {
    from = customStart ? new Date(`${customStart}T00:00:00`) : null;
    to = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;
    label = [customStart || "開始指定なし", customEnd || "終了指定なし"].join("〜");
  }
  return { from, to, label };
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const isPartner = user?.role === "partner";
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const selectedPeriod = useMemo(
    () => periodRange(periodPreset, customStart, customEnd),
    [periodPreset, customStart, customEnd],
  );
  const periodInput = useMemo(() => ({
    fromMs: selectedPeriod.from?.getTime(),
    toMs: selectedPeriod.to?.getTime(),
  }), [selectedPeriod.from, selectedPeriod.to]);
  const { data: dashboard, isLoading, error } = trpc.dashboard.overview.useQuery(periodInput);
  const { data: alerts = [], isLoading: alertsLoading } = trpc.reports.kpiAlerts.useQuery(periodInput, {
    enabled: !isPartner,
  });
  const pdfRef = useRef<HTMLDivElement>(null);
  const { recordPdf } = usePdfHistoryRecorder();
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [drilldown, setDrilldown] = useState<DrilldownState>(null);

  useEffect(() => {
    applyRootSeoMetadata();
  }, []);

  const cases = (dashboard?.cases ?? []) as DashboardCase[];
  const recent = (dashboard?.recentCases ?? []) as DashboardCase[];
  const attentionCases = (dashboard?.attentionCases ?? {
    threeMonthsOrMore: [],
    oneToThreeMonths: [],
    leakageRelated: [],
  }) as AttentionCaseGroups;
  const kpis = dashboard?.kpis;
  const financials = dashboard?.financials;

  const periodControls = (
    <Card>
      <CardContent className="py-4 flex items-end gap-3 flex-wrap">
        <div className="min-w-[180px]">
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><CalendarDays className="h-3.5 w-3.5" />集計期間</label>
          <Select value={periodPreset} onValueChange={(value) => setPeriodPreset(value as PeriodPreset)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全期間</SelectItem>
              <SelectItem value="thisMonth">今月</SelectItem>
              <SelectItem value="lastMonth">先月</SelectItem>
              <SelectItem value="threeMonths">過去3か月</SelectItem>
              <SelectItem value="sixMonths">過去6か月</SelectItem>
              <SelectItem value="custom">任意期間</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {periodPreset === "custom" && (
          <>
            <div><label className="text-xs text-muted-foreground mb-1 block">開始日</label><Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">終了日</label><Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></div>
          </>
        )}
        <Badge variant="secondary" className="mb-1">{selectedPeriod.label}</Badge>
      </CardContent>
    </Card>
  );

  // partner向けダッシュボードを表示
  if (isPartner) {
    return <div className="space-y-6">{periodControls}<PartnerDashboard cases={cases} attentionCases={attentionCases} isLoading={isLoading} setLocation={setLocation} userName={user?.name ?? "協力業者"} /></div>;
  }

  const openDrilldown = (key: string, label?: string) => {
    let rows: DashboardCase[] = [];
    let title = label ?? "案件内訳";
    let description = "該当する案件を実データから表示しています。";

    if (key === "all") rows = cases;
    else if (key === "inProgress") rows = cases.filter((item) => ["現調中", "見積中", "施工待ち", "施工中"].includes(item.status));
    else if (key === "urgent") rows = cases.filter((item) => item.urgency === "S" || item.urgency === "A");
    else if (key === "completed") rows = cases.filter((item) => item.status === "完了" || item.status === "クローズ");
    else if (key === "noRevisit") {
      rows = cases.filter((item) => item.surveyDate && (item.revisitCount ?? 0) === 0);
      description = "現調実施済みのうち再訪回数が0回の案件です。";
    } else if (key.startsWith("status:")) rows = cases.filter((item) => item.status === key.slice(7));
    else if (key.startsWith("urgency:")) rows = cases.filter((item) => item.urgency === key.slice(8));
    else if (key === "financial") {
      rows = cases;
      description = "管理者にのみ表示される案件別の見積・実績内訳です。";
    }

    setDrilldown({ title, description, rows });
  };

  const handleExportCsv = () => {
    if (!dashboard) return;
    const rows: unknown[][] = [
      ["Store OSX ダッシュボード", new Date(dashboard.generatedAt).toLocaleString("ja-JP")],
      ["集計期間", selectedPeriod.label],
      [],
      ["KPI", "値"],
      ["案件総数", dashboard.kpis.total],
      ["進行中", dashboard.kpis.inProgress],
      ["緊急・高", dashboard.kpis.urgent],
      ["完了・クローズ", dashboard.kpis.completed],
      ["再訪ゼロ率", `${dashboard.kpis.noRevisitRate}%`],
      [],
      ["ステータス", "件数"],
      ...dashboard.statusBreakdown.map((row) => [row.label, row.value]),
      [],
      ["緊急度", "件数"],
      ...dashboard.urgencyBreakdown.map((row) => [row.label, row.value]),
    ];

    if (isAdmin && dashboard.financials) {
      rows.push(
        [],
        ["予実", "金額"],
        ["見積合計", dashboard.financials.totalEstimated],
        ["予算 見積×75%", dashboard.financials.totalBudget],
        ["実績合計", dashboard.financials.totalActual],
        ["差分 実績−予算", dashboard.financials.diff],
      );
    }

    rows.push(
      [],
      ["案件番号", "店舗名", "ブランド", "都道府県", "ステータス", "進捗", "緊急度", "担当者", "依頼日", ...(isAdmin ? ["見積", "実績"] : [])],
      ...cases.map((item) => [
        item.requestNumber,
        item.storeName,
        item.brand ?? "",
        item.prefecture ?? "",
        item.status,
        item.progressStage ?? "",
        item.urgency,
        item.assigneeName ?? "未割当",
        formatDate(item.requestDate ?? item.createdAt),
        ...(isAdmin ? [item.estimatedCost ?? 0, item.actualCost ?? 0] : []),
      ]),
      [],
      ["KPIアラート", "案件番号", "店舗名", "状態", "経過日数", "内容"],
      ...(alerts as DashboardAlert[]).map((alert) => [
        alert.kpiType,
        alert.requestNumber,
        alert.storeName,
        alert.severity === "overdue" ? "期限超過" : "期限間近",
        alert.daysElapsed,
        alert.message,
      ]),
    );

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `StoreOSX_ダッシュボード_${selectedPeriod.label}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("ダッシュボードCSVをダウンロードしました");
  };

  const handleExportPdf = async () => {
    if (!pdfRef.current) return;
    setGeneratingPdf(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const pages = Array.from(pdfRef.current.querySelectorAll<HTMLElement>(".dashboard-pdf-page"));
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let index = 0; index < pages.length; index += 1) {
        setPdfProgress(`ページ ${index + 1} / ${pages.length} を生成中...`);
        await new Promise((resolve) => setTimeout(resolve, 0));
        const canvas = await html2canvas(pages[index], {
          scale: 1.45,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 794,
        });
        const image = canvas.toDataURL("image/jpeg", 0.84);
        if (index > 0) pdf.addPage();
        pdf.addImage(image, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
        canvas.width = 0;
        canvas.height = 0;
      }

      const fileName = `StoreOSX_ダッシュボード_${selectedPeriod.label}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`;
      pdf.save(fileName);
      try {
        setPdfProgress("生成履歴を保存中...");
        await recordPdf({
          pdf,
          fileName,
          reportType: "ダッシュボード",
          periodStart: selectedPeriod.from,
          periodEnd: selectedPeriod.to,
          metadata: { periodLabel: selectedPeriod.label, caseCount: cases.length, pageCount: pages.length },
        });
      } catch (historyError) {
        console.error("[PDF history] failed:", historyError);
        toast.warning("PDFはダウンロードしましたが、生成履歴の保存に失敗しました");
      }
      toast.success("ダッシュボードPDFをダウンロードしました");
    } catch (pdfError) {
      toast.error(pdfError instanceof Error ? pdfError.message : "PDF生成に失敗しました");
    } finally {
      setGeneratingPdf(false);
      setPdfProgress("");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 rounded-lg bg-muted" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-28 rounded-lg bg-muted" />)}
        </div>
        <div className="h-80 rounded-lg bg-muted" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-3" />
          <p className="font-semibold">ダッシュボードデータを取得できませんでした</p>
          <p className="text-sm text-muted-foreground mt-1">{error?.message ?? "時間をおいて再度お試しください"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-border/60 pb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Store OSX · Dashboard</p>
          <h1 className="font-serif-jp text-3xl md:text-4xl font-semibold tracking-tight">Store OSX</h1>
          <h2 className="text-base md:text-lg font-medium mt-2">{ROOT_SEO.h2}</h2>
          <p className="text-sm text-muted-foreground mt-2">プレナス修理依頼案件の施工管理をチーム全員で管理・共有</p>
          <p className="text-[11px] text-muted-foreground mt-2">最終集計: {new Date(dashboard.generatedAt).toLocaleString("ja-JP")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />CSV
          </Button>
          <Button size="sm" onClick={handleExportPdf} disabled={generatingPdf}>
            {generatingPdf ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            {generatingPdf ? pdfProgress || "生成中..." : "PDF"}
          </Button>
        </div>
      </div>

      {periodControls}

      <AttentionCases groups={attentionCases} setLocation={setLocation} canEditSchedule />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <KpiCard icon={<ClipboardList className="h-4 w-4" />} label="案件総数" value={kpis?.total ?? 0} accent="text-primary" secondary="全案件の内訳" onClick={() => openDrilldown("all", "案件総数の内訳")} />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="進行中" value={kpis?.inProgress ?? 0} accent="text-amber-600" secondary="現調〜施工中" onClick={() => openDrilldown("inProgress", "進行中案件の内訳")} />
        <KpiCard icon={<AlertCircle className="h-4 w-4" />} label="緊急・高" value={kpis?.urgent ?? 0} accent="text-red-600" secondary="緊急度 S・A" onClick={() => openDrilldown("urgent", "緊急・高案件の内訳")} />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="完了" value={kpis?.completed ?? 0} accent="text-emerald-600" secondary="完了・クローズ" onClick={() => openDrilldown("completed", "完了案件の内訳")} />
        <KpiCard icon={<ShieldCheck className="h-4 w-4" />} label="再訪ゼロ率" value={`${kpis?.noRevisitRate ?? 100}%`} accent="text-emerald-600" secondary={`${kpis?.noRevisitCount ?? 0}/${kpis?.surveyedCount ?? 0}件`} onClick={() => openDrilldown("noRevisit", "再訪ゼロ案件の内訳")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><h2 className="font-semibold">ステータス別案件数</h2></div>
                <p className="text-xs text-muted-foreground mt-1">棒グラフをクリックすると該当案件を確認できます</p>
              </div>
              <Badge variant="outline">実データ</Badge>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.statusBreakdown} layout="vertical" margin={{ top: 5, right: 20, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" width={68} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${value}件`, "案件数"]} />
                  <Bar
                    dataKey="value"
                    radius={[0, 5, 5, 0]}
                    cursor="pointer"
                    onClick={(entry: any) => {
                      const row = entry?.payload ?? entry;
                      if (row?.key) openDrilldown(`status:${row.key}`, `${row.label}の案件内訳`);
                    }}
                  >
                    {dashboard.statusBreakdown.map((row, index) => <Cell key={row.key} fill={STATUS_CHART_COLORS[index % STATUS_CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2"><PieChartIcon className="h-4 w-4 text-primary" /><h2 className="font-semibold">緊急度構成</h2></div>
                <p className="text-xs text-muted-foreground mt-1">円グラフをクリックして内訳を表示</p>
              </div>
              <Badge variant="outline">実データ</Badge>
            </div>
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboard.urgencyBreakdown}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={54}
                    outerRadius={88}
                    paddingAngle={2}
                    cursor="pointer"
                    onClick={(entry: any) => {
                      const row = entry?.payload ?? entry;
                      if (row?.key) openDrilldown(`urgency:${row.key}`, `${row.label}案件の内訳`);
                    }}
                  >
                    {dashboard.urgencyBreakdown.map((row) => <Cell key={row.key} fill={URGENCY_CHART_COLORS[row.key]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}件`, "案件数"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {dashboard.urgencyBreakdown.map((row) => (
                <button key={row.key} onClick={() => openDrilldown(`urgency:${row.key}`, `${row.label}案件の内訳`)} className="text-center rounded-md border border-border/70 py-2 hover:bg-muted/50 active:scale-[0.97] transition-all">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: URGENCY_CHART_COLORS[row.key] }} />
                  <p className="text-[10px] text-muted-foreground mt-1">{row.label}</p>
                  <p className="font-semibold text-sm">{row.value}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && financials && (
        <div>
          <div className="flex items-end justify-between mb-4">
            <div className="flex items-center gap-2">
              <div>
                <h2 className="font-serif-jp text-xl font-semibold">予実サマリー</h2>
                <p className="text-xs text-muted-foreground mt-1">カードをクリックすると案件別内訳を確認できます。</p>
              </div>
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">管理者限定</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/budget")}>詳細を見る<ArrowUpRight className="ml-1 h-3 w-3" /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <BudgetCard icon={<Wallet className="h-4 w-4" />} label="見積合計" value={`¥${financials.totalEstimated.toLocaleString()}`} accent="navy" onClick={() => openDrilldown("financial", "見積合計の案件別内訳")} />
            <BudgetCard icon={<Wallet className="h-4 w-4" />} label="予算 見積×75%" value={`¥${financials.totalBudget.toLocaleString()}`} accent="navy" onClick={() => openDrilldown("financial", "予算の案件別内訳")} />
            <BudgetCard icon={<CheckCircle2 className="h-4 w-4" />} label="実績合計" value={`¥${financials.totalActual.toLocaleString()}`} accent="emerald" onClick={() => openDrilldown("financial", "実績合計の案件別内訳")} />
            <BudgetCard icon={financials.diff > 0 ? <TrendingUp className="h-4 w-4" /> : financials.diff < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />} label="差分 実績−予算" value={`${financials.diff >= 0 ? "+" : "-"}¥${Math.abs(financials.diff).toLocaleString()}`} accent={financials.diff > 0 ? "red" : financials.diff < 0 ? "emerald" : "gray"} onClick={() => openDrilldown("financial", "予実差分の案件別内訳")} />
          </div>
        </div>
      )}

      <KpiAlertSection alerts={alerts as DashboardAlert[]} isLoading={alertsLoading} />
      <ScheduleBoard />

      <div>
        <div className="flex items-end justify-between mb-4">
          <div><h2 className="font-serif-jp text-xl font-semibold">最近の案件</h2><p className="text-xs text-muted-foreground mt-1">最新の依頼案件を表示しています</p></div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/cases")}>すべて見る<ArrowUpRight className="ml-1 h-3 w-3" /></Button>
        </div>
        {recent.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-14 text-center flex flex-col items-center gap-3"><ClipboardList className="h-10 w-10 text-muted-foreground/70" /><p className="font-medium">まだ案件がありません</p></CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recent.map((item) => (
              <button key={item.id} onClick={() => setLocation(`/cases/${item.id}`)} className="text-left group">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all duration-200"><CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3"><div className="flex items-center gap-2"><span className={`inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded text-[10px] font-bold ${URGENCY_COLORS[item.urgency]}`}>{URGENCY_LABEL[item.urgency]}</span><Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[item.status]}`}>{item.status}</Badge></div><ArrowUpRight className="h-4 w-4 text-muted-foreground/70 group-hover:text-primary" /></div>
                  <p className="text-xs text-muted-foreground mb-1 font-mono">{item.requestNumber}</p>
                  <h3 className="font-semibold text-sm truncate">{item.storeName}</h3>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{item.categoryLarge || "—"} / {item.categoryMedium || "—"}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-2 min-h-[2rem] leading-relaxed">{item.requestContent || "依頼内容未記入"}</p>
                </CardContent></Card>
              </button>
            ))}
          </div>
        )}
      </div>

      <DashboardPdfDocument ref={pdfRef} dashboard={dashboard} alerts={alerts as DashboardAlert[]} isAdmin={isAdmin} isPartner={isPartner} />

      <Dialog open={Boolean(drilldown)} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{drilldown?.title}</DialogTitle><DialogDescription>{drilldown?.description}</DialogDescription></DialogHeader>
          <div className="max-h-[65vh] overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/95 backdrop-blur"><tr><th className="text-left px-3 py-2">案件番号</th><th className="text-left px-3 py-2">店舗</th><th className="text-left px-3 py-2">状態</th><th className="text-left px-3 py-2">緊急度</th><th className="text-left px-3 py-2">担当</th>{isAdmin && <><th className="text-right px-3 py-2">見積</th><th className="text-right px-3 py-2">実績</th></>}</tr></thead>
              <tbody>
                {drilldown?.rows.map((item) => (
                  <tr key={item.id} onClick={() => setLocation(`/cases/${item.id}`)} className="border-t hover:bg-muted/40 cursor-pointer">
                    <td className="px-3 py-2 font-mono text-xs">{item.requestNumber}</td><td className="px-3 py-2 font-medium">{item.storeName}</td><td className="px-3 py-2"><Badge variant="outline" className={STATUS_COLORS[item.status]}>{item.status}</Badge></td><td className="px-3 py-2">{item.urgency}</td><td className="px-3 py-2">{item.assigneeName ?? "未割当"}</td>{isAdmin && <><td className="px-3 py-2 text-right">¥{(item.estimatedCost ?? 0).toLocaleString()}</td><td className="px-3 py-2 text-right">¥{(item.actualCost ?? 0).toLocaleString()}</td></>}
                  </tr>
                ))}
                {drilldown?.rows.length === 0 && <tr><td colSpan={isAdmin ? 7 : 5} className="px-3 py-12 text-center text-muted-foreground">該当する案件はありません</td></tr>}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon, label, value, accent, secondary, onClick }: { icon: React.ReactNode; label: string; value: number | string; accent: string; secondary: string; onClick: () => void }) {
  return <Card onClick={onClick} className="border-border/60 cursor-pointer hover:shadow-md hover:border-primary/40 active:scale-[0.98] transition-all duration-200"><CardContent className="p-4 md:p-5"><div className={`flex items-center justify-between ${accent} mb-2`}><span className="flex items-center gap-1.5">{icon}<span className="text-xs font-medium tracking-wide">{label}</span></span><ArrowUpRight className="h-3.5 w-3.5 opacity-50" /></div><p className="font-serif-jp text-3xl md:text-4xl font-semibold tracking-tight">{value}</p><p className="text-[10px] text-muted-foreground mt-1">{secondary}</p></CardContent></Card>;
}

function BudgetCard({ icon, label, value, accent, onClick }: { icon: React.ReactNode; label: string; value: string; accent: "navy" | "emerald" | "red" | "gray"; onClick: () => void }) {
  const accents: Record<string, string> = { navy: "border-l-4 border-l-[#1a2238]", emerald: "border-l-4 border-l-emerald-600", red: "border-l-4 border-l-red-600", gray: "border-l-4 border-l-slate-300" };
  return <Card onClick={onClick} className={`${accents[accent]} cursor-pointer hover:shadow-md active:scale-[0.98] transition-all`}><CardContent className="p-5"><div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground mb-2"><span className="flex items-center gap-2">{icon}{label}</span><ArrowUpRight className="h-3.5 w-3.5" /></div><p className="font-serif-jp text-xl md:text-2xl font-semibold">{value}</p></CardContent></Card>;
}

const KPI_ICONS: Record<string, React.ReactNode> = { "至急一次対応": <Zap className="h-3.5 w-3.5" />, "見積書提出": <FileText className="h-3.5 w-3.5" />, "施工完了": <Wrench className="h-3.5 w-3.5" />, "完了報告書": <BookCheck className="h-3.5 w-3.5" /> };

function KpiAlertSection({ alerts, isLoading }: { alerts: DashboardAlert[]; isLoading: boolean }) {
  const [, setLocation] = useLocation();
  const [showAll, setShowAll] = useState(false);
  if (isLoading || alerts.length === 0) return null;
  const overdueCount = alerts.filter((item) => item.severity === "overdue").length;
  const warningCount = alerts.filter((item) => item.severity === "warning").length;
  const displayed = showAll ? alerts : alerts.slice(0, 8);
  return <div><div className="flex items-end justify-between mb-3"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-600" /><div><h2 className="font-serif-jp text-xl font-semibold">KPIアラート</h2><p className="text-xs text-muted-foreground mt-0.5">期限超過 <span className="font-bold text-red-600">{overdueCount}件</span>{warningCount > 0 && <> / 期限間近 <span className="font-bold text-amber-600">{warningCount}件</span></>}</p></div></div>{alerts.length > 8 && <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>{showAll ? "折りたたむ" : `すべて表示 ${alerts.length}件`}</Button>}</div><div className="space-y-2">{displayed.map((alert, index) => <button key={`${alert.caseId}-${alert.kpiType}-${index}`} onClick={() => setLocation(`/cases/${alert.caseId}`)} className="w-full text-left group"><Card className={`transition-all hover:shadow-md ${alert.severity === "overdue" ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50"}`}><CardContent className="p-3 flex items-center gap-3"><div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${alert.severity === "overdue" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>{KPI_ICONS[alert.kpiType] || <AlertCircle className="h-3.5 w-3.5" />}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><Badge variant="outline" className={alert.severity === "overdue" ? "border-red-300 text-red-700 bg-red-100" : "border-amber-300 text-amber-700 bg-amber-100"}>{alert.severity === "overdue" ? "超過" : "間近"}</Badge><Badge variant="outline">{alert.kpiType}</Badge><span className="text-[11px] text-muted-foreground font-mono">{alert.requestNumber}</span></div><p className="text-sm font-medium truncate">{alert.storeName}</p><p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p></div><div className={alert.severity === "overdue" ? "bg-red-100 px-2 py-1 rounded text-center" : "bg-amber-100 px-2 py-1 rounded text-center"}><p className={alert.severity === "overdue" ? "text-lg font-bold text-red-700" : "text-lg font-bold text-amber-700"}>{alert.daysElapsed}</p><p className="text-[10px] text-muted-foreground">日経過</p></div><ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary" /></CardContent></Card></button>)}</div></div>;
}

type AttentionGroupKey = keyof AttentionCaseGroups;

const ATTENTION_GROUPS: Array<{
  key: AttentionGroupKey;
  label: string;
  description: string;
  activeClass: string;
}> = [
  {
    key: "threeMonthsOrMore",
    label: "3か月以上",
    description: "依頼日から3か月以上経過した未完了案件です。",
    activeClass: "border-red-600 bg-red-600 text-white hover:bg-red-700",
  },
  {
    key: "oneToThreeMonths",
    label: "1か月以上",
    description: "依頼日から1か月以上3か月未満の未完了案件です。",
    activeClass: "border-amber-600 bg-amber-600 text-white hover:bg-amber-700",
  },
  {
    key: "leakageRelated",
    label: "漏電関係",
    description: "漏電・ブレーカー・停電・絶縁・ヒューズ等を含む未完了案件です。経過期間にかかわらず表示します。",
    activeClass: "border-orange-600 bg-orange-600 text-white hover:bg-orange-700",
  },
];

function AttentionCases({
  groups,
  setLocation,
  canEditSchedule = false,
}: {
  groups: AttentionCaseGroups;
  setLocation: (path: string) => void;
  canEditSchedule?: boolean;
}) {
  const [activeGroup, setActiveGroup] = useState<AttentionGroupKey>("threeMonthsOrMore");
  const [editingRow, setEditingRow] = useState<AttentionCase | null>(null);
  const [constructionDate, setConstructionDate] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const activeMeta = ATTENTION_GROUPS.find((group) => group.key === activeGroup) ?? ATTENTION_GROUPS[0];
  const rows = groups[activeGroup] ?? [];
  const selectableCaseIds = useMemo(() => rows.filter((row) => !row.constructionDate).map((row) => row.id), [rows]);
  const utils = trpc.useUtils();
  const { data: partnerOptions = [], isLoading: partnerOptionsLoading } = trpc.dashboard.schedulingOptions.useQuery(undefined, {
    enabled: canEditSchedule,
  });
  const filteredPartnerOptions = useMemo(() => {
    const keyword = partnerSearch.trim().toLowerCase();
    if (!keyword) return partnerOptions;
    return partnerOptions.filter((partner) =>
      [partner.name, partner.category, partner.area].filter(Boolean).join(" ").toLowerCase().includes(keyword),
    );
  }, [partnerOptions, partnerSearch]);
  const scheduleCase = trpc.dashboard.scheduleCase.useMutation({
    onSuccess: async (result) => {
      toast.success(`${result.partner.name}で施工予定を設定しました`);
      setEditingRow(null);
      setConstructionDate("");
      setPartnerId("");
      setPartnerSearch("");
      setSelectedCaseIds([]);
      await Promise.all([
        utils.dashboard.overview.invalidate(),
        utils.crossSchedule.list.invalidate(),
        utils.cases.listSummary.invalidate(),
      ]);
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || "施工予定を保存できませんでした");
    },
  });
  const bulkScheduleCases = trpc.dashboard.bulkScheduleCases.useMutation({
    onSuccess: async (result) => {
      toast.success(`${result.successCount}件の施工予定を一括設定しました${result.failedCount ? `（${result.failedCount}件失敗）` : ""}`);
      setBulkDialogOpen(false);
      setSelectedCaseIds([]);
      setConstructionDate("");
      setPartnerId("");
      setPartnerSearch("");
      await Promise.all([
        utils.dashboard.overview.invalidate(),
        utils.crossSchedule.list.invalidate(),
        utils.cases.listSummary.invalidate(),
      ]);
    },
    onError: (mutationError) => toast.error(mutationError.message || "一括設定できませんでした"),
  });
  const clearScheduleCase = trpc.dashboard.clearScheduleCase.useMutation({
    onSuccess: async () => {
      toast.success("施工予定日と施工業者を解除しました");
      await Promise.all([
        utils.dashboard.overview.invalidate(),
        utils.crossSchedule.list.invalidate(),
        utils.cases.listSummary.invalidate(),
      ]);
    },
    onError: (mutationError) => toast.error(mutationError.message || "解除できませんでした"),
  });

  const openScheduleDialog = (row: AttentionCase) => {
    setEditingRow(row);
    setBulkDialogOpen(false);
    setSelectedCaseIds([]);
    setConstructionDate(toDateInputValue(row.constructionDate));
    setPartnerId(row.partnerId ? String(row.partnerId) : "");
    setPartnerSearch("");
  };

  const openBulkScheduleDialog = () => {
    if (selectedCaseIds.length === 0) return;
    setEditingRow(null);
    setBulkDialogOpen(true);
    setConstructionDate("");
    setPartnerId("");
    setPartnerSearch("");
  };

  const closeScheduleDialog = () => {
    setEditingRow(null);
    setBulkDialogOpen(false);
    setConstructionDate("");
    setPartnerId("");
    setPartnerSearch("");
  };

  const toggleCaseSelection = (caseId: number, checked: boolean) => {
    setSelectedCaseIds((current) => checked
      ? Array.from(new Set([...current, caseId]))
      : current.filter((id) => id !== caseId));
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectedCaseIds(checked ? selectableCaseIds : []);
  };

  const requestClearSchedule = (row: AttentionCase) => {
    if (!window.confirm(`${row.requestNumber} / ${row.storeName} の施工予定日と施工業者を解除しますか？`)) return;
    clearScheduleCase.mutate({ caseId: row.id });
  };

  const saveSchedule = () => {
    if (!constructionDate || !partnerId) return;
    if (bulkDialogOpen) {
      bulkScheduleCases.mutate({
        caseIds: selectedCaseIds,
        constructionDate,
        partnerId: Number(partnerId),
      });
      return;
    }
    if (!editingRow) return;
    scheduleCase.mutate({
      caseId: editingRow.id,
      constructionDate,
      partnerId: Number(partnerId),
    });
  };
  return (
    <>
    <Card className="border-slate-200 bg-slate-50/30">
      <CardContent className="p-0">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-900 text-white"><CalendarDays className="h-5 w-5" /></div>
              <div>
                <h2 className="font-serif-jp text-xl font-semibold">要対応案件</h2>
                <p className="text-xs text-muted-foreground mt-1">未完了案件を経過期間と漏電関連に分け、施工予定日と予定週を表示します。</p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">経過案件 {groups.threeMonthsOrMore.length + groups.oneToThreeMonths.length}件</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4" role="tablist" aria-label="要対応案件の区分">
            {ATTENTION_GROUPS.map((group) => {
              const selected = group.key === activeGroup;
              return (
                <Button
                  key={group.key}
                  type="button"
                  variant="outline"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setActiveGroup(group.key);
                    setSelectedCaseIds([]);
                  }}
                  className={`justify-between ${selected ? group.activeClass : "bg-white"}`}
                >
                  <span className="flex items-center gap-2">{group.key === "leakageRelated" && <Zap className="h-4 w-4" />}{group.label}</span>
                  <Badge variant={selected ? "secondary" : "outline"}>{groups[group.key].length}件</Badge>
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">{activeMeta.description}</p>
          {canEditSchedule && selectableCaseIds.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`select-all-${activeGroup}`}
                  checked={selectableCaseIds.every((id) => selectedCaseIds.includes(id))}
                  onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                />
                <label htmlFor={`select-all-${activeGroup}`} className="text-sm font-medium cursor-pointer">未設定をすべて選択（{selectableCaseIds.length}件）</label>
              </div>
              <Button type="button" size="sm" onClick={openBulkScheduleDialog} disabled={selectedCaseIds.length === 0}>
                <ListChecks className="h-4 w-4 mr-1.5" />選択した{selectedCaseIds.length}件を一括設定
              </Button>
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="py-8 px-5 text-center text-sm text-muted-foreground">対象案件はありません</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[480px] overflow-auto">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`w-full text-left px-5 py-4 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_120px_120px_minmax(220px,0.9fr)_20px] md:items-center hover:bg-slate-50 transition-colors ${selectedCaseIds.includes(row.id) ? "bg-blue-50/70" : ""}`}
              >
                <div className="min-w-0 flex items-start gap-3">
                  {canEditSchedule && !row.constructionDate && (
                    <Checkbox
                      aria-label={`${row.storeName}を一括設定対象に選択`}
                      checked={selectedCaseIds.includes(row.id)}
                      onCheckedChange={(checked) => toggleCaseSelection(row.id, checked === true)}
                      className="mt-1"
                    />
                  )}
                  <button type="button" onClick={() => setLocation(`/cases/${row.id}`)} className="min-w-0 text-left group flex-1">
                    <div className="flex items-center gap-2 mb-1"><span className="font-mono text-[11px] text-muted-foreground">{row.requestNumber}</span><Badge variant="outline" className={STATUS_COLORS[row.status]}>{row.status}</Badge></div>
                    <p className="font-semibold truncate group-hover:text-primary">{row.storeName}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{row.requestContent || "依頼内容未記入"}</p>
                  </button>
                </div>
                <div><p className="text-[10px] text-muted-foreground">依頼日</p><p className="text-sm font-medium mt-1">{formatDate(row.requestDate)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">経過日数</p><p className="text-lg font-bold text-slate-800 mt-0.5">{row.daysElapsed}日</p></div>
                <div>
                  <p className="text-[10px] text-muted-foreground">施工予定日（予定週）</p>
                  {row.constructionDate ? (
                    <>
                      <p className="text-sm font-semibold mt-1">{formatScheduleDate(row.constructionDate)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatScheduleDate(row.constructionWeekStart)}〜{formatScheduleDate(row.constructionWeekEnd)}</p>
                      {row.contractorName && <p className="text-xs font-medium text-slate-700 mt-1">施工業者：{row.contractorName}</p>}
                      {canEditSchedule && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openScheduleDialog(row)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />変更
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => requestClearSchedule(row)} disabled={clearScheduleCase.isPending}>
                            <CalendarX className="h-3.5 w-3.5 mr-1" />解除
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-1 flex flex-col items-start gap-2">
                      <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">施工予定日 未設定</Badge>
                      {canEditSchedule && (
                        <Button type="button" size="sm" onClick={() => openScheduleDialog(row)}>
                          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />予定日・業者を設定
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setLocation(`/cases/${row.id}`)} aria-label={`${row.storeName}の案件詳細を開く`} className="hidden md:block"><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    <Dialog open={Boolean(editingRow) || bulkDialogOpen} onOpenChange={(open) => !open && closeScheduleDialog()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bulkDialogOpen ? `${selectedCaseIds.length}件の施工予定を一括設定` : editingRow?.constructionDate ? "施工予定日・施工業者を変更" : "施工予定日・施工業者を設定"}</DialogTitle>
          <DialogDescription>
            {bulkDialogOpen
              ? `選択した${selectedCaseIds.length}件へ同じ施工予定日と施工業者を設定します。`
              : `${editingRow ? `${editingRow.requestNumber} / ${editingRow.storeName}` : "対象案件"}の施工予定を登録します。`}
            保存後、予定週と横断工程表にも反映されます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label htmlFor="dashboard-construction-date" className="text-sm font-medium">施工予定日</label>
            <Input id="dashboard-construction-date" type="date" value={constructionDate} onChange={(event) => setConstructionDate(event.target.value)} className="mt-1.5" />
          </div>
          <div>
            <label className="text-sm font-medium">施工業者</label>
            <Input value={partnerSearch} onChange={(event) => setPartnerSearch(event.target.value)} placeholder="業者名・カテゴリ・エリアで検索" className="mt-1.5" />
            <Select value={partnerId} onValueChange={setPartnerId} disabled={partnerOptionsLoading}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder={partnerOptionsLoading ? "業者を読み込み中" : "施工業者を選択"} /></SelectTrigger>
              <SelectContent>
                {filteredPartnerOptions.map((partner) => (
                  <SelectItem key={partner.id} value={String(partner.id)}>
                    {partner.name}（{partner.category}{partner.area ? `・${partner.area}` : ""}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!partnerOptionsLoading && partnerOptions.length === 0 && <p className="text-xs text-red-600 mt-1.5">有効な施工業者が登録されていません。</p>}
            {!partnerOptionsLoading && partnerOptions.length > 0 && filteredPartnerOptions.length === 0 && <p className="text-xs text-muted-foreground mt-1.5">検索条件に一致する業者がありません。</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeScheduleDialog} disabled={scheduleCase.isPending || bulkScheduleCases.isPending}>キャンセル</Button>
            <Button type="button" onClick={saveSchedule} disabled={!constructionDate || !partnerId || scheduleCase.isPending || bulkScheduleCases.isPending}>
              {(scheduleCase.isPending || bulkScheduleCases.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}{bulkDialogOpen ? "一括設定する" : editingRow?.constructionDate ? "変更を保存" : "保存する"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

const DashboardPdfDocument = ({ ref, dashboard, alerts, isAdmin, isPartner }: { ref: React.RefObject<HTMLDivElement | null>; dashboard: any; alerts: DashboardAlert[]; isAdmin: boolean; isPartner: boolean }) => {
  const total = Math.max(1, dashboard.kpis.total);
  return (
    <div ref={ref} className="fixed left-[-10000px] top-0 opacity-0 pointer-events-none" aria-hidden="true">
      <section className="dashboard-pdf-page bg-white text-slate-900" style={{ width: "210mm", minHeight: "297mm", padding: "14mm 12mm", boxSizing: "border-box" }}>
        <div className="border-b-2 border-slate-800 pb-4 mb-5"><div className="flex justify-between items-end"><div><p className="text-xs tracking-[0.18em] text-slate-500">STORE OSX</p><h1 className="text-2xl font-bold mt-1">ダッシュボードレポート</h1></div><div className="text-right text-xs text-slate-500"><p>{new Date(dashboard.generatedAt).toLocaleString("ja-JP")}</p><p>{isPartner ? "協力業者向け・担当案件のみ" : isAdmin ? "管理者向け" : "社員向け"}</p></div></div></div>
        <div className="grid grid-cols-5 gap-2 mb-6">{[["案件総数", dashboard.kpis.total], ["進行中", dashboard.kpis.inProgress], ["緊急・高", dashboard.kpis.urgent], ["完了", dashboard.kpis.completed], ["再訪ゼロ率", `${dashboard.kpis.noRevisitRate}%`]].map(([label, value]) => <div key={label} className="border border-slate-200 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="text-xl font-bold mt-1">{value}</p></div>)}</div>
        <div className="grid grid-cols-2 gap-6"><div><h2 className="text-sm font-bold border-b border-slate-300 pb-2 mb-3">ステータス別案件数</h2><div className="space-y-2">{dashboard.statusBreakdown.map((row: any, index: number) => <div key={row.key}><div className="flex justify-between text-xs mb-1"><span>{row.label}</span><span>{row.value}件</span></div><div className="h-3 bg-slate-100"><div className="h-3" style={{ width: `${Math.max(2, (row.value / total) * 100)}%`, backgroundColor: STATUS_CHART_COLORS[index % STATUS_CHART_COLORS.length] }} /></div></div>)}</div></div><div><h2 className="text-sm font-bold border-b border-slate-300 pb-2 mb-3">緊急度構成</h2><div className="space-y-3">{dashboard.urgencyBreakdown.map((row: any) => <div key={row.key} className="flex items-center justify-between border-b border-slate-100 pb-2"><span className="flex items-center gap-2 text-xs"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: URGENCY_CHART_COLORS[row.key] }} />{row.label}</span><strong>{row.value}件</strong></div>)}</div></div></div>
        {isAdmin && dashboard.financials && <div className="mt-7"><h2 className="text-sm font-bold border-b border-slate-300 pb-2 mb-3">予実サマリー</h2><div className="grid grid-cols-4 gap-2">{[["見積合計", dashboard.financials.totalEstimated], ["予算 見積×75%", dashboard.financials.totalBudget], ["実績合計", dashboard.financials.totalActual], ["差分", dashboard.financials.diff]].map(([label, value]) => <div key={label} className="border border-slate-200 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="text-base font-bold mt-1">¥{Number(value).toLocaleString()}</p></div>)}</div></div>}
        <p className="text-[9px] text-slate-400 mt-8">※ 本資料はStore OSXの表示時点の実データを集計しています。</p>
      </section>
      <section className="dashboard-pdf-page bg-white text-slate-900" style={{ width: "210mm", minHeight: "297mm", padding: "14mm 12mm", boxSizing: "border-box" }}>
        <div className="border-b-2 border-slate-800 pb-3 mb-5"><h2 className="text-xl font-bold">案件・アラート内訳</h2></div>
        <h3 className="text-sm font-bold mb-2">最近の案件</h3><table className="w-full text-[10px] border-collapse"><thead><tr className="bg-slate-100"><th className="text-left border p-2">案件番号</th><th className="text-left border p-2">店舗</th><th className="text-left border p-2">状態</th><th className="text-left border p-2">緊急度</th><th className="text-left border p-2">担当</th></tr></thead><tbody>{dashboard.recentCases.map((item: any) => <tr key={item.id}><td className="border p-2">{item.requestNumber}</td><td className="border p-2">{item.storeName}</td><td className="border p-2">{item.status}</td><td className="border p-2">{item.urgency}</td><td className="border p-2">{item.assigneeName ?? "未割当"}</td></tr>)}</tbody></table>
        <h3 className="text-sm font-bold mt-7 mb-2">KPIアラート</h3>{alerts.length === 0 ? <p className="text-xs text-slate-500 border p-4">現在、期限超過・期限間近のアラートはありません。</p> : <table className="w-full text-[10px] border-collapse"><thead><tr className="bg-slate-100"><th className="text-left border p-2">区分</th><th className="text-left border p-2">案件番号</th><th className="text-left border p-2">店舗</th><th className="text-left border p-2">状態</th><th className="text-left border p-2">内容</th></tr></thead><tbody>{alerts.slice(0, 16).map((alert, index) => <tr key={`${alert.caseId}-${index}`}><td className="border p-2">{alert.kpiType}</td><td className="border p-2">{alert.requestNumber}</td><td className="border p-2">{alert.storeName}</td><td className="border p-2">{alert.severity === "overdue" ? "期限超過" : "期限間近"}</td><td className="border p-2">{alert.message}</td></tr>)}</tbody></table>}
      </section>
    </div>
  );
};

// 再訪ゼロ率KPIカード
function RevisitZeroCard({ cases }: { cases: any[] }) {
  // 現調実施済み（surveyDateあり）の案件を対象
  const surveyed = cases.filter((c) => c.surveyDate);
  const noRevisit = surveyed.filter((c) => (c.revisitCount ?? 0) === 0);
  const rate = surveyed.length > 0 ? Math.round((noRevisit.length / surveyed.length) * 100) : 100;
  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-emerald-200 active:scale-[0.97]"
      onClick={() => {}}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-md bg-emerald-50">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <span className="text-xs text-muted-foreground">再訪ゼロ率</span>
        </div>
        <p className="text-2xl font-bold text-emerald-600">{rate}%</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {noRevisit.length}/{surveyed.length}件 一発完了
        </p>
      </CardContent>
    </Card>
  );
}

function PartnerAssignmentNotifications({ setLocation }: { setLocation: (path: string) => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.dashboard.partnerNotifications.useQuery(undefined, { refetchInterval: 60_000 });
  const markRead = trpc.dashboard.markPartnerNotificationRead.useMutation({
    onSuccess: () => utils.dashboard.partnerNotifications.invalidate(),
  });
  const markAllRead = trpc.dashboard.markAllPartnerNotificationsRead.useMutation({
    onSuccess: () => utils.dashboard.partnerNotifications.invalidate(),
    onError: (error) => toast.error(error.message || "既読にできませんでした"),
  });
  const items = data?.items ?? [];

  const openNotification = (item: (typeof items)[number]) => {
    if (!item.readAt) markRead.mutate({ id: item.id });
    if (item.notificationType !== "cancelled") setLocation(`/cases/${item.caseId}`);
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardContent className="p-0">
        <div className="p-4 border-b border-blue-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-blue-700" />
            <div><h2 className="font-semibold">新しい担当案件のお知らせ</h2><p className="text-xs text-muted-foreground">新規割当・予定変更・解除をお知らせします</p></div>
            {(data?.unreadCount ?? 0) > 0 && <Badge className="bg-blue-700">未読 {data?.unreadCount}件</Badge>}
          </div>
          {(data?.unreadCount ?? 0) > 0 && <Button type="button" size="sm" variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>すべて既読</Button>}
        </div>
        {isLoading ? (
          <div className="p-5 text-sm text-muted-foreground">通知を読み込み中です</div>
        ) : items.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">新しい担当案件の通知はありません</div>
        ) : (
          <div className="divide-y divide-blue-100 max-h-[300px] overflow-auto">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => openNotification(item)} className={`w-full p-4 text-left flex items-start gap-3 hover:bg-blue-50 ${item.readAt ? "opacity-70" : "bg-white"}`}>
                <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${item.readAt ? "bg-slate-300" : item.notificationType === "cancelled" ? "bg-red-500" : "bg-blue-600"}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2"><strong className="text-sm">{item.title}</strong><span className="font-mono text-[11px] text-muted-foreground">{item.requestNumber}</span></span>
                  <span className="block text-sm mt-1">{item.storeName}</span>
                  {item.message && <span className="block text-xs text-muted-foreground mt-1">{item.message}</span>}
                  <span className="block text-[10px] text-muted-foreground mt-1.5">{new Date(item.createdAt).toLocaleString("ja-JP")}</span>
                </span>
                {item.notificationType !== "cancelled" && <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Partner Dashboard ─────────────────────────────────────────
function PartnerDashboard({
  cases,
  attentionCases,
  isLoading,
  setLocation,
  userName,
}: {
  cases: any[];
  attentionCases: AttentionCaseGroups;
  isLoading: boolean;
  setLocation: (path: string) => void;
  userName: string;
}) {
  const total = cases.length;
  const inProgress = cases.filter((c: any) =>
    ["現調中", "見積中", "施工待ち", "施工中"].includes(c.status)
  ).length;
  const urgent = cases.filter((c: any) => c.urgency === "S" || c.urgency === "A").length;
  const completed = cases.filter((c: any) => c.status === "完了").length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="border-b border-border/60 pb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Partner Dashboard
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {userName}さんの担当案件
        </h1>
        <h2 className="text-base font-medium mt-2">{ROOT_SEO.h2}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          担当案件の進捗状況を確認できます
        </p>
      </div>

      <PartnerAssignmentNotifications setLocation={setLocation} />

      {/* KPIカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-primary mb-2">
              <ClipboardList className="h-4 w-4" />
              <span className="text-xs font-medium">担当案件</span>
            </div>
            <p className="text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-amber-600 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">進行中</span>
            </div>
            <p className="text-3xl font-bold text-amber-600">{inProgress}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-red-600 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-medium">緊急/高</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{urgent}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-emerald-600 mb-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">完了</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{completed}</p>
          </CardContent>
        </Card>
      </div>

      <AttentionCases groups={attentionCases} setLocation={setLocation} canEditSchedule={false} />

      {/* 対応が必要な案件 */}
      {cases.filter((c: any) => c.status === "受付" || c.urgency === "S" || c.urgency === "A").length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              対応が必要な案件
            </h3>
            <div className="space-y-2">
              {cases
                .filter((c: any) => c.status === "受付" || c.urgency === "S" || c.urgency === "A")
                .slice(0, 5)
                .map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-200 cursor-pointer hover:shadow-sm transition-shadow"
                    onClick={() => setLocation(`/cases/${c.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      {c.urgency && (
                        <Badge className={`text-xs ${URGENCY_COLORS[c.urgency] || ""}`}>
                          {URGENCY_LABEL[c.urgency] || c.urgency}
                        </Badge>
                      )}
                      <div>
                        <p className="font-medium text-sm">{c.storeName}</p>
                        <p className="text-xs text-muted-foreground">{c.requestNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[c.status] || ""}`}>
                        {c.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 担当案件一覧 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">全担当案件</h2>
          <Button variant="outline" size="sm" onClick={() => setLocation("/cases")}>
            案件一覧へ
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        {cases.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>担当案件はまだありません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {cases.map((c: any) => (
              <Card
                key={c.id}
                className="border-border/60 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 active:scale-[0.99]"
                onClick={() => setLocation(`/cases/${c.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {c.urgency && (
                        <Badge className={`text-xs shrink-0 ${URGENCY_COLORS[c.urgency] || ""}`}>
                          {URGENCY_LABEL[c.urgency] || c.urgency}
                        </Badge>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.storeName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{c.requestNumber}</span>
                          {c.brand && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{c.brand}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[c.status] || ""}`}>
                        {c.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {/* クイックアクション */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); setLocation(`/cases/${c.id}/survey-report`); }}
                    >
                      <FileCheck className="h-3 w-3 mr-1" />
                      報告書
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); setLocation(`/cases/${c.id}?tab=photos`); }}
                    >
                      <Camera className="h-3 w-3 mr-1" />
                      写真
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
