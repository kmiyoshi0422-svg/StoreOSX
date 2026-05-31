import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  Search,
  MapPin,
  Layers,
  Calendar,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Receipt,
} from "lucide-react";

type SortKey = "latest" | "caseCount" | "openCount" | "totalActual";

const STAGE_BADGE: Record<string, string> = {
  未対応: "bg-slate-100 text-slate-700 border-slate-200",
  現調済: "bg-amber-50 text-amber-700 border-amber-200",
  見積提出済: "bg-blue-50 text-blue-700 border-blue-200",
  承認済: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysSince(d: Date | string | null): number | null {
  if (!d) return null;
  const ms = Date.now() - new Date(d).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export default function StoresList() {
  const [, setLocation] = useLocation();
  const { data: stores = [], isLoading } = trpc.stores.list.useQuery();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "multi" | "openOnly">("all");
  const [sort, setSort] = useState<SortKey>("latest");

  const filtered = useMemo(() => {
    let list = stores.slice();
    if (tab === "multi") list = list.filter((s) => s.caseCount >= 2);
    if (tab === "openOnly") list = list.filter((s) => s.openCount > 0);
    if (q) {
      const keyword = q.toLowerCase();
      list = list.filter(
        (s) =>
          s.storeName.toLowerCase().includes(keyword) ||
          (s.storeCode ?? "").toLowerCase().includes(keyword) ||
          (s.address ?? "").toLowerCase().includes(keyword) ||
          (s.brand ?? "").toLowerCase().includes(keyword)
      );
    }
    list.sort((a, b) => {
      switch (sort) {
        case "caseCount":
          return b.caseCount - a.caseCount;
        case "openCount":
          return b.openCount - a.openCount;
        case "totalActual":
          return b.totalActual - a.totalActual;
        case "latest":
        default: {
          const at = a.latestRequestAt ? +new Date(a.latestRequestAt) : 0;
          const bt = b.latestRequestAt ? +new Date(b.latestRequestAt) : 0;
          return bt - at;
        }
      }
    });
    return list;
  }, [stores, q, tab, sort]);

  const totalStats = useMemo(() => {
    const totalStores = stores.length;
    const multiStores = stores.filter((s) => s.caseCount >= 2).length;
    const urgentStores = stores.filter((s) => s.urgentCount > 0 && s.openCount > 0).length;
    const totalActual = stores.reduce((sum, s) => sum + s.totalActual, 0);
    return { totalStores, multiStores, urgentStores, totalActual };
  }, [stores]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-border/60 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Stores</p>
          <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">店舗一覧</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {filtered.length} / {stores.length} 店舗
          </p>
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              登録店舗数
            </p>
            <p className="font-serif-jp text-2xl font-semibold">{totalStats.totalStores}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              複数案件の店舗
            </p>
            <p className="font-serif-jp text-2xl font-semibold text-amber-700">
              {totalStats.multiStores}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              緊急案件あり店舗
            </p>
            <p className="font-serif-jp text-2xl font-semibold text-red-700">
              {totalStats.urgentStores}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              累計実績コスト
            </p>
            <p className="font-serif-jp text-2xl font-semibold font-mono">
              ¥{totalStats.totalActual.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-3 w-full md:w-auto md:inline-grid">
          <TabsTrigger value="all">全店舗</TabsTrigger>
          <TabsTrigger value="multi">複数案件</TabsTrigger>
          <TabsTrigger value="openOnly">進行中あり</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="店舗名・店舗コード・住所・ブランドで検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">最終依頼日が新しい順</SelectItem>
            <SelectItem value="caseCount">案件数が多い順</SelectItem>
            <SelectItem value="openCount">進行中案件が多い順</SelectItem>
            <SelectItem value="totalActual">累計実績コストが高い順</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">該当する店舗がありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => {
            const days = daysSince(s.latestRequestAt);
            const stale = days != null && days > 30 && s.openCount > 0;
            return (
              <Card
                key={s.key}
                className="hover:shadow-md hover:border-primary/40 transition-all"
              >
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {s.storeCode && (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {s.storeCode}
                          </Badge>
                        )}
                        {s.brand && (
                          <Badge variant="secondary" className="text-[10px]">
                            {s.brand}
                          </Badge>
                        )}
                        {s.caseCount >= 2 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50 border-amber-200 text-amber-800"
                          >
                            <Layers className="h-3 w-3" />
                            複数案件
                          </Badge>
                        )}
                        {s.urgentCount > 0 && s.openCount > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-red-50 border-red-200 text-red-700"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            緊急 {s.urgentCount}
                          </Badge>
                        )}
                        {stale && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-orange-50 border-orange-200 text-orange-700"
                          >
                            {days}日 動きなし
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mb-1 truncate flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        {s.storeName}
                      </h3>
                      {s.address && (
                        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="truncate">{s.address}</span>
                        </p>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 md:grid-cols-4 gap-3 md:gap-5 md:min-w-[420px]">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">案件数</p>
                        <p className="font-serif-jp text-xl font-semibold">{s.caseCount}</p>
                        <p className="text-[10px] text-muted-foreground">
                          進行 {s.openCount} / 完了 {s.completedCount}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-0.5">
                          <Receipt className="h-2.5 w-2.5" />
                          見積累計
                        </p>
                        <p className="font-mono text-sm font-semibold tabular-nums">
                          ¥{(s.totalEstimated / 1000).toLocaleString()}k
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          ¥{s.totalEstimated.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-0.5">
                          <TrendingUp className="h-2.5 w-2.5" />
                          実績累計
                        </p>
                        <p className="font-mono text-sm font-semibold tabular-nums text-emerald-700">
                          ¥{(s.totalActual / 1000).toLocaleString()}k
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          ¥{s.totalActual.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          最終依頼
                        </p>
                        <p className="text-xs font-semibold">{fmtDate(s.latestRequestAt)}</p>
                        {s.latestStage && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] mt-0.5 ${STAGE_BADGE[s.latestStage] ?? ""}`}
                          >
                            {s.latestStage}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setLocation(`/cases?store=${encodeURIComponent(s.storeName)}`)
                      }
                      className="shrink-0"
                    >
                      案件を見る
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
