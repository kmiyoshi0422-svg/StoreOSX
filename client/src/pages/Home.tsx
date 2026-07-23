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
  const isAdmin = user?.role === "admin";
  const { data: cases = [], isLoading } = trpc.cases.listSummary.useQuery();
  const { data: summary } = trpc.cases.summary.useQuery(undefined, { enabled: isAdmin });

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
