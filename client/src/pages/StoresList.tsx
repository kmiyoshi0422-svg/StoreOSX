import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Loader2,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const { data: stores = [], isLoading } = trpc.stores.list.useQuery();
  const { data: storeMasters = [] } = trpc.storeMaster.list.useQuery();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "multi" | "openOnly">("all");
  const [sort, setSort] = useState<SortKey>("latest");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [selectedNewStoreKeys, setSelectedNewStoreKeys] = useState<string[]>([]);
  const utils = trpc.useUtils();
  const bulkPreview = trpc.storeMaster.bulkLinkPreview.useQuery(undefined, {
    enabled: bulkOpen && isAdmin,
  });
  const bulkExecute = trpc.storeMaster.bulkLinkExecute.useMutation({
    onSuccess: async (result) => {
      toast.success(`${result.linked}件の案件を紐付け、${result.createdStores}件の店舗マスタを新規登録しました`);
      setBulkOpen(false);
      setSelectedCaseIds([]);
      setSelectedNewStoreKeys([]);
      await Promise.all([
        utils.storeMaster.bulkLinkPreview.invalidate(),
        utils.storeMaster.list.invalidate(),
        utils.stores.list.invalidate(),
        utils.cases.list.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (bulkPreview.data) {
      setSelectedCaseIds(bulkPreview.data.candidates.map((item) => item.caseId));
      setSelectedNewStoreKeys([]);
    }
  }, [bulkPreview.data]);

  const selectedNewCaseCount = bulkPreview.data?.newStores
    .filter((item) => selectedNewStoreKeys.includes(item.key))
    .reduce((sum, item) => sum + item.caseIds.length, 0) ?? 0;
  const selectedLinkCount = selectedCaseIds.length + selectedNewCaseCount;

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

  const masterByStoreKey = useMemo(() => {
    const byCode = new Map<string, (typeof storeMasters)[number]>();
    const byName = new Map<string, (typeof storeMasters)[number]>();
    for (const master of storeMasters) {
      if (master.storeCode?.trim()) byCode.set(master.storeCode.trim(), master);
      byName.set(master.storeName.trim(), master);
    }
    return { byCode, byName };
  }, [storeMasters]);

  const createMasterMutation = trpc.storeMaster.create.useMutation({
    onSuccess: ({ id }) => {
      setLocation(`/stores/${id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const openStoreDetail = (store: (typeof stores)[number]) => {
    const master =
      (store.storeCode?.trim()
        ? masterByStoreKey.byCode.get(store.storeCode.trim())
        : undefined) ?? masterByStoreKey.byName.get(store.storeName.trim());

    if (master) {
      setLocation(`/stores/${master.id}`);
      return;
    }

    const brand =
      store.brand === "ほっともっと" || store.brand === "やよい軒"
        ? store.brand
        : "その他";
    createMasterMutation.mutate({
      storeCode: store.storeCode || null,
      storeName: store.storeName,
      brand,
      address: store.address || null,
    });
  };

  const totalStats = useMemo(() => {
    const totalStores = stores.length;
    const multiStores = stores.filter((s) => s.caseCount >= 2).length;
    const urgentStores = stores.filter((s) => s.urgentCount > 0 && s.openCount > 0).length;
    const totalActual = stores.reduce((sum, s) => sum + s.totalActual, 0);
    return { totalStores, multiStores, urgentStores, totalActual };
  }, [stores]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-border/60 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Stores</p>
          <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">店舗一覧</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {filtered.length} / {stores.length} 店舗
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setBulkOpen(true)}>
            <Link2 className="h-4 w-4 mr-1.5" />既存案件を一括紐付け
          </Button>
        )}
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
              登録店舗数
            </p>
            <p className="font-serif-jp text-2xl font-semibold">{totalStats.totalStores}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
              複数案件の店舗
            </p>
            <p className="font-serif-jp text-2xl font-semibold text-amber-700">
              {totalStats.multiStores}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
              緊急案件あり店舗
            </p>
            <p className="font-serif-jp text-2xl font-semibold text-red-700">
              {totalStats.urgentStores}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
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
          <CardContent className="py-16 text-center flex flex-col items-center gap-3">
            <Building2 className="h-10 w-10 text-muted-foreground/70" />
            <p className="font-medium">該当する店舗がありません</p>
            <p className="text-sm text-muted-foreground max-w-sm">検索キーワードやタブを切り替えてもう一度お試しください。</p>
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
                        <p className="text-[11px] text-muted-foreground mb-1 font-medium">案件数</p>
                        <p className="font-serif-jp text-xl font-semibold">{s.caseCount}</p>
                        <p className="text-[11px] text-muted-foreground">
                          進行 {s.openCount} / 完了 {s.completedCount}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-muted-foreground mb-1 flex items-center justify-center gap-1 font-medium">
                          <Receipt className="h-3 w-3" />
                          見積累計
                        </p>
                        <p className="font-mono text-sm font-semibold tabular-nums">
                          ¥{(s.totalEstimated / 1000).toLocaleString()}k
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          ¥{s.totalEstimated.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-muted-foreground mb-1 flex items-center justify-center gap-1 font-medium">
                          <TrendingUp className="h-3 w-3" />
                          実績累計
                        </p>
                        <p className="font-mono text-sm font-semibold tabular-nums text-emerald-700">
                          ¥{(s.totalActual / 1000).toLocaleString()}k
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          ¥{s.totalActual.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-muted-foreground mb-1 flex items-center justify-center gap-1 font-medium">
                          <Calendar className="h-3 w-3" />
                          最終依頼
                        </p>
                        <p className="text-xs font-semibold">{fmtDate(s.latestRequestAt)}</p>
                        {s.latestStage && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] mt-1 ${STAGE_BADGE[s.latestStage] ?? ""}`}
                          >
                            {s.latestStage}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row md:flex-col">
                      <Button
                        size="sm"
                        onClick={() => openStoreDetail(s)}
                        disabled={createMasterMutation.isPending}
                      >
                        {createMasterMutation.isPending ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Building2 className="mr-1 h-3.5 w-3.5" />
                        )}
                        店舗情報
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setLocation(`/cases?store=${encodeURIComponent(s.storeName)}`)
                        }
                      >
                        案件を見る
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>既存案件を店舗マスタへ一括紐付け</DialogTitle>
            <DialogDescription>店舗コードを優先し、一致しない場合だけ店舗名で照合します。曖昧な候補と紐付け済み案件は自動更新しません。</DialogDescription>
          </DialogHeader>

          {bulkPreview.isLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />候補を照合中...</div>
          ) : bulkPreview.error ? (
            <div className="py-12 text-center text-red-600">{bulkPreview.error.message}</div>
          ) : bulkPreview.data ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/60 p-3"><p className="text-xs text-muted-foreground">紐付け済み</p><p className="text-xl font-semibold">{bulkPreview.data.alreadyLinked}</p></div>
                <div className="bg-muted/60 p-3"><p className="text-xs text-muted-foreground">未紐付け</p><p className="text-xl font-semibold">{bulkPreview.data.totalUnlinked}</p></div>
                <div className="bg-emerald-50 p-3"><p className="text-xs text-emerald-700">既存マスタ候補</p><p className="text-xl font-semibold text-emerald-800">{bulkPreview.data.candidates.length}</p></div>
                <div className="bg-blue-50 p-3"><p className="text-xs text-blue-700">新規店舗候補</p><p className="text-xl font-semibold text-blue-800">{bulkPreview.data.newStores.length}</p></div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">実行対象 {selectedLinkCount}案件</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedCaseIds(bulkPreview.data!.candidates.map((item) => item.caseId))}>すべて選択</Button>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedCaseIds([]); setSelectedNewStoreKeys([]); }}>選択解除</Button>
                </div>
              </div>

              <div className="border overflow-y-auto max-h-[390px] divide-y">
                {bulkPreview.data.candidates.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">安全に自動紐付けできる候補はありません</div>
                ) : bulkPreview.data.candidates.map((item) => {
                  const checked = selectedCaseIds.includes(item.caseId);
                  return (
                    <label key={item.caseId} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/40">
                      <Checkbox checked={checked} onCheckedChange={() => setSelectedCaseIds((current) => checked ? current.filter((id) => id !== item.caseId) : [...current, item.caseId])} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.requestNumber} · {item.caseStoreName}</p>
                        <p className="text-xs text-muted-foreground truncate">→ {item.masterStoreName} {item.masterStoreCode ? `(${item.masterStoreCode})` : ""}</p>
                      </div>
                      <Badge variant={item.matchType === "storeCode" ? "default" : "outline"}>{item.matchType === "storeCode" ? "店舗コード一致" : "店舗名一致"}</Badge>
                    </label>
                  );
                })}
              </div>

              {bulkPreview.data.newStores.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">新規店舗マスタを作成して紐付け</p>
                    <Button variant="outline" size="sm" onClick={() => setSelectedNewStoreKeys(bulkPreview.data!.newStores.map((item) => item.key))}>新規候補をすべて選択</Button>
                  </div>
                  <div className="border overflow-y-auto max-h-[220px] divide-y">
                    {bulkPreview.data.newStores.map((item) => {
                      const checked = selectedNewStoreKeys.includes(item.key);
                      return (
                        <label key={item.key} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/40">
                          <Checkbox checked={checked} onCheckedChange={() => setSelectedNewStoreKeys((current) => checked ? current.filter((key) => key !== item.key) : [...current, item.key])} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{item.storeName} {item.storeCode ? `(${item.storeCode})` : ""}</p>
                            <p className="text-xs text-muted-foreground">対象案件 {item.caseIds.length}件 · {item.requestNumbers.slice(0, 3).join("、")}{item.requestNumbers.length > 3 ? "…" : ""}</p>
                          </div>
                          <Badge variant="outline">新規登録</Badge>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {bulkPreview.data.ambiguous.length > 0 && (
                <p className="text-xs text-amber-700">候補が重複する {bulkPreview.data.ambiguous.length}件は自動変更せず、個別確認用に残します。</p>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>キャンセル</Button>
            <Button
              disabled={selectedLinkCount === 0 || bulkExecute.isPending}
              onClick={() => bulkExecute.mutate({ caseIds: selectedCaseIds, newStoreKeys: selectedNewStoreKeys })}
            >
              {bulkExecute.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              選択した{selectedLinkCount}案件を紐付け
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
