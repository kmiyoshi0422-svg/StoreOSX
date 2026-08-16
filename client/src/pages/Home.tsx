import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import ScheduleBoard from "@/components/ScheduleBoard";
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
  Camera,
  FileCheck,
  ChevronRight,
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

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const isPartner = user?.role === "partner";
  const { data: cases = [], isLoading } = trpc.cases.listSummary.useQuery();
  const { data: summary } = trpc.cases.summary.useQuery(undefined, { enabled: isAdmin });

  // partner向けダッシュボードを表示
  if (isPartner) {
    return <PartnerDashboard cases={cases} isLoading={isLoading} setLocation={setLocation} userName={user?.name ?? "協力業者"} />;
  }

  const total = cases.length;
  const inProgress = cases.filter((c) =>
    ["現調中", "見積中", "施工待ち", "施工中"].includes(c.status)
  ).length;
  const urgent = cases.filter((c) => c.urgency === "S" || c.urgency === "A").length;
  const completed = cases.filter((c) => c.status === "完了").length;

  const recent = cases.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="border-b border-border/60 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Store OSX · Dashboard
        </p>
        <h1 className="font-serif-jp text-3xl md:text-4xl font-semibold tracking-tight">
          Store OSX
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          プレナス修理依頼案件の施工管理をチーム全員で管理・共有
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <KpiCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="案件総数"
          value={total}
          accent="text-primary"
          onClick={() => setLocation("/cases")}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="進行中"
          value={inProgress}
          accent="text-amber-600"
          onClick={() => setLocation("/cases?status=進行中")}
        />
        <KpiCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="緊急/高"
          value={urgent}
          accent="text-red-600"
          onClick={() => setLocation("/cases?urgency=high")}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="完了"
          value={completed}
          accent="text-emerald-600"
          onClick={() => setLocation("/cases?status=完了")}
        />
        <RevisitZeroCard cases={cases} />
      </div>

      {/* 予実サマリー（管理者のみ） */}
      {isAdmin && (
        <div>
          <div className="flex items-end justify-between mb-4">
            <div className="flex items-center gap-2">
              <div>
                <h2 className="font-serif-jp text-xl font-semibold">予実サマリー</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  予算 = 見積×75%。予算と実績の差分を一目で確認できます。
                </p>
              </div>
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">管理者限定</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/budget")}>
              詳細を見る
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <BudgetCard
              icon={<Wallet className="h-4 w-4" />}
              label="見積合計"
              value={`¥${(summary?.totalEstimated ?? 0).toLocaleString()}`}
              accent="navy"
            />
            <BudgetCard
              icon={<Wallet className="h-4 w-4" />}
              label="予算 見積×75%"
              value={`¥${(summary?.totalBudget ?? 0).toLocaleString()}`}
              accent="navy"
            />
            <BudgetCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="実績合計"
              value={`¥${(summary?.totalActual ?? 0).toLocaleString()}`}
              accent="emerald"
            />
            <BudgetCard
              icon={
                (summary?.diff ?? 0) > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (summary?.diff ?? 0) < 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )
              }
              label="差分「実績−予算」"
              value={`${(summary?.diff ?? 0) >= 0 ? "+" : ""}¥${Math.abs(summary?.diff ?? 0).toLocaleString()}`}
              accent={(summary?.diff ?? 0) > 0 ? "red" : (summary?.diff ?? 0) < 0 ? "emerald" : "gray"}
            />
          </div>
        </div>
      )}

      {/* KPIアラート */}
      <KpiAlertSection />

      {/* v12: ルート推進＆スケジュール盤 */}
      <ScheduleBoard />

      {/* Recent */}
      <div>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-serif-jp text-xl font-semibold">最近の案件</h2>
            <p className="text-xs text-muted-foreground mt-1">
              最新の依頼案件を表示しています
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/cases")}>
            すべて見る
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">読み込み中...</div>
        ) : recent.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-14 text-center flex flex-col items-center gap-3">
              <ClipboardList className="h-10 w-10 text-muted-foreground/70" />
              <p className="font-medium">まだ案件がありません</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                最初の依頼を登録すると、ここに最近の案件が並びます。PDF取込やCSV一括取込もご利用いただけます。
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => setLocation("/cases/new")}
              >
                最初の案件を登録
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recent.map((c) => (
              <button
                key={c.id}
                onClick={() => setLocation(`/cases/${c.id}`)}
                className="text-left group"
              >
                <Card className="hover:shadow-md hover:border-primary/30 transition-all duration-200">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded text-[10px] font-bold ${URGENCY_COLORS[c.urgency]}`}
                        >
                          {URGENCY_LABEL[c.urgency]}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_COLORS[c.status]}`}
                        >
                          {c.status}
                        </Badge>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-1 font-mono">
                      {c.requestNumber}
                    </p>
                    <h3 className="font-semibold text-sm truncate">{c.storeName}</h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {c.categoryLarge || "—"} / {c.categoryMedium || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2 min-h-[2rem] leading-relaxed">
                      {c.requestContent || <span className="italic text-muted-foreground/70">依頼内容未記入</span>}
                    </p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BudgetCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "navy" | "emerald" | "red" | "gray";
}) {
  const accents: Record<string, string> = {
    navy: "border-l-4 border-l-[#1a2238]",
    emerald: "border-l-4 border-l-emerald-600",
    red: "border-l-4 border-l-red-600",
    gray: "border-l-4 border-l-slate-300",
  };
  return (
    <Card className={accents[accent]}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
          {icon}
          {label}
        </div>
        <p className="font-serif-jp text-xl md:text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={
        "border-border/60 transition-all duration-200 " +
        (onClick
          ? "cursor-pointer hover:shadow-md hover:border-primary/40 active:scale-[0.98]"
          : "")
      }
    >
      <CardContent className="p-4 md:p-5">
        <div className={`flex items-center justify-between ${accent} mb-2`}>
          <span className="flex items-center gap-1.5">
            {icon}
            <span className="text-xs font-medium tracking-wide">{label}</span>
          </span>
          {onClick && <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />}
        </div>
        <p className="font-serif-jp text-3xl md:text-4xl font-semibold tracking-tight">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── KPI Alert Section ─────────────────────────────────────────
const KPI_ICONS: Record<string, React.ReactNode> = {
  "至急一次対応": <Zap className="h-3.5 w-3.5" />,
  "見積書提出": <FileText className="h-3.5 w-3.5" />,
  "施工完了": <Wrench className="h-3.5 w-3.5" />,
  "完了報告書": <BookCheck className="h-3.5 w-3.5" />,
};

function KpiAlertSection() {
  const [, setLocation] = useLocation();
  const { data: alerts = [], isLoading } = trpc.reports.kpiAlerts.useQuery();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return null;
  if (alerts.length === 0) return null;

  const overdueCount = alerts.filter((a) => a.severity === "overdue").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const displayed = showAll ? alerts : alerts.slice(0, 8);

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <h2 className="font-serif-jp text-xl font-semibold">KPIアラート</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              期限超過 <span className="font-bold text-red-600">{overdueCount}件</span>
              {warningCount > 0 && (
                <> / 期限間近 <span className="font-bold text-amber-600">{warningCount}件</span></>
              )}
            </p>
          </div>
        </div>
        {alerts.length > 8 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? "折りたたむ" : `すべて表示 (${alerts.length}件)`}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {displayed.map((alert, i) => (
          <button
            key={`${alert.caseId}-${alert.kpiType}-${i}`}
            onClick={() => setLocation(`/cases/${alert.caseId}`)}
            className="w-full text-left group"
          >
            <Card className={`transition-all duration-200 hover:shadow-md ${
              alert.severity === "overdue"
                ? "border-red-200 bg-red-50/50 hover:border-red-300"
                : "border-amber-200 bg-amber-50/50 hover:border-amber-300"
            }`}>
              <CardContent className="p-3 flex items-center gap-3">
                {/* Severity indicator */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  alert.severity === "overdue" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                }`}>
                  {KPI_ICONS[alert.kpiType] || <AlertCircle className="h-3.5 w-3.5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                      alert.severity === "overdue"
                        ? "border-red-300 text-red-700 bg-red-100"
                        : "border-amber-300 text-amber-700 bg-amber-100"
                    }`}>
                      {alert.severity === "overdue" ? "超過" : "間近"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {alert.kpiType}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground font-mono">{alert.requestNumber}</span>
                  </div>
                  <p className="text-sm font-medium truncate">{alert.storeName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                </div>

                {/* Days badge */}
                <div className={`flex-shrink-0 text-center px-2 py-1 rounded ${
                  alert.severity === "overdue" ? "bg-red-100" : "bg-amber-100"
                }`}>
                  <p className={`text-lg font-bold ${
                    alert.severity === "overdue" ? "text-red-700" : "text-amber-700"
                  }`}>{alert.daysElapsed}</p>
                  <p className="text-[10px] text-muted-foreground">日経過</p>
                </div>

                <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary flex-shrink-0" />
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}


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

// ─── Partner Dashboard ─────────────────────────────────────────
function PartnerDashboard({
  cases,
  isLoading,
  setLocation,
  userName,
}: {
  cases: any[];
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
        <p className="text-sm text-muted-foreground mt-1">
          担当案件の進捗状況を確認できます
        </p>
      </div>

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
