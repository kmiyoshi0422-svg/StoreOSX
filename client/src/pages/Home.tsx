import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

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
  surveyDate?: Date | string | null;
  revisitCount?: number | null;
  assigneeId?: number | null;
  assigneeName?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  categoryLarge?: string | null;
  categoryMedium?: string | null;
  requestContent?: string | null;
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

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const isPartner = user?.role === "partner";
  const { data: dashboard, isLoading, error } = trpc.dashboard.overview.useQuery();
  const { data: alerts = [], isLoading: alertsLoading } = trpc.reports.kpiAlerts.useQuery();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [drilldown, setDrilldown] = useState<DrilldownState>(null);

  const cases = (dashboard?.cases ?? []) as DashboardCase[];
  const recent = (dashboard?.recentCases ?? []) as DashboardCase[];
  const kpis = dashboard?.kpis;
  const financials = dashboard?.financials;

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
    link.download = `StoreOSX_ダッシュボード_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;
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

      pdf.save(`StoreOSX_ダッシュボード_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`);
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
