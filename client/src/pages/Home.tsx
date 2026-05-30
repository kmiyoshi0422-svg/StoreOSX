import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
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
  const { data: cases = [], isLoading } = trpc.cases.list.useQuery();

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
          Dashboard
        </p>
        <h1 className="font-serif-jp text-3xl md:text-4xl font-semibold tracking-tight">
          現場チェックブック
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          プレナス修理依頼案件をチーム全員で管理・共有
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="案件総数"
          value={total}
          accent="text-primary"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="進行中"
          value={inProgress}
          accent="text-amber-600"
        />
        <KpiCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="緊急/高"
          value={urgent}
          accent="text-red-600"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="完了"
          value={completed}
          accent="text-emerald-600"
        />
      </div>

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
            <CardContent className="py-12 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">まだ案件がありません</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
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
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-1 font-mono">
                      {c.requestNumber}
                    </p>
                    <h3 className="font-semibold text-sm truncate">{c.storeName}</h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {c.categoryLarge || "—"} / {c.categoryMedium || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-2 min-h-[2rem]">
                      {c.requestContent || "依頼内容未記入"}
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

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 md:p-5">
        <div className={`flex items-center gap-1.5 ${accent} mb-2`}>
          {icon}
          <span className="text-xs font-medium tracking-wide">{label}</span>
        </div>
        <p className="font-serif-jp text-3xl md:text-4xl font-semibold tracking-tight">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
