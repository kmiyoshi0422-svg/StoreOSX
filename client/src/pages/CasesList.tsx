import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { calcCaseProfit } from "@shared/profit";
import { CASE_STATUSES, PROGRESS_STAGES } from "@shared/stageStatus";
import { toast } from "sonner";
import {
  resolveCasePrefecture,
  prefectureSortIndex,
  regionOfPrefecture,
  regionSortIndex,
  UNKNOWN_PREFECTURE,
} from "@shared/prefecture";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useMemo, useState, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Plus,
  Search,
  MapPin,
  Phone,
  Calendar,
  FileText,
  ChevronRight,
  ChevronDown,
  UserCircle2,
  CircleDashed,
  ClipboardCheck,
  Receipt,
  CheckCircle2,
  Folder,
  Building2,
  Layers,
  AlertTriangle,
  Map as MapIcon,
  LayoutGrid,
  List,
  Table2,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

type ProgressStage = "未対応" | "現調済" | "見積提出済" | "承認済";

const STAGES: { key: ProgressStage; label: string; icon: any; color: string; ring: string }[] = [
  { key: "未対応", label: "未対応", icon: CircleDashed, color: "text-slate-600", ring: "ring-slate-300" },
  { key: "現調済", label: "現調済", icon: ClipboardCheck, color: "text-amber-700", ring: "ring-amber-300" },
  { key: "見積提出済", label: "見積提出済", icon: Receipt, color: "text-blue-700", ring: "ring-blue-300" },
  { key: "承認済", label: "承認済", icon: CheckCircle2, color: "text-emerald-700", ring: "ring-emerald-300" },
];

const STAGE_BADGE: Record<ProgressStage, string> = {
  未対応: "bg-slate-100 text-slate-700 border-slate-200",
  現調済: "bg-amber-50 text-amber-700 border-amber-200",
  見積提出済: "bg-blue-50 text-blue-700 border-blue-200",
  承認済: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function userInitials(name: string | null | undefined, email: string | null | undefined) {
  const base = (name ?? email ?? "").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

// 同一店舗キー：storeCodeを優先、無ければstoreNameを使う
function storeKey(c: { storeCode: string | null; storeName: string }) {
  return (c.storeCode && c.storeCode.trim()) || c.storeName.trim();
}

export default function CasesList() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isPartner = user?.role === 'partner';
  const { data: cases = [], isLoading } = trpc.cases.listSummary.useQuery();
  const { data: users = [] } = trpc.users.list.useQuery();
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const utils = trpc.useUtils();

  const updateStatusMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      utils.cases.listSummary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleStatusChange = useCallback(
    (caseId: number, newStatus: string) => {
      updateStatusMutation.mutate({ id: caseId, data: { status: newStatus as any } });
    },
    [updateStatusMutation]
  );

  const handleStageChange = useCallback(
    (caseId: number, newStage: string) => {
      updateStatusMutation.mutate({ id: caseId, data: { progressStage: newStage as any }, forceStage: true });
    },
    [updateStatusMutation]
  );

  // URLクエリを初期フィルタとして読み込む（ダッシュボードKPIからの遷移用）
  // 例: /cases?status=進行中  /cases?status=完了  /cases?urgency=high
  const initialParams = useMemo(() => {
    if (typeof window === "undefined") return { status: "all", urgency: "all" };
    const sp = new URLSearchParams(window.location.search);
    const statusParam = sp.get("status") ?? "all";
    const urgencyRaw = sp.get("urgency") ?? "all";
    const urgencyParam = urgencyRaw === "high" ? "high" : urgencyRaw;
    return { status: statusParam, urgency: urgencyParam };
  }, []);

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [stageTab, setStageTab] = useState<"all" | ProgressStage>("all");
  const [urgency, setUrgency] = useState(initialParams.urgency);
  const [statusFilter, setStatusFilter] = useState(initialParams.status);
  const [assignee, setAssignee] = useState("all");
  const [storeDialogKey, setStoreDialogKey] = useState<string | null>(null);
  const [groupByPref, setGroupByPref] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "compact" | "table">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("cases-view-mode") as any) || "card";
    }
    return "card";
  });
  const [prefFilter, setPrefFilter] = useState("all");
  // 折り畳んだ地方ラベルの集合（デフォルトは全展開）
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set());
  const toggleRegion = (label: string) =>
    setCollapsedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  // 同一店舗グルーピング（storeCode または storeName ごと）
  const storeGroups = useMemo(() => {
    const map = new Map<string, typeof cases>();
    for (const c of cases) {
      const k = storeKey(c);
      const arr = map.get(k) ?? [];
      arr.push(c);
      map.set(k, arr);
    }
    return map;
  }, [cases]);

  // 複数案件を抱える店舗だけ抽出し、件数降順ソート
  const multiCaseStores = useMemo(() => {
    return Array.from(storeGroups.entries())
      .filter(([, list]) => list.length >= 2)
      .map(([key, list]) => ({
        key,
        storeName: list[0].storeName,
        count: list.length,
        openCount: list.filter((c) => c.status !== "完了" && c.status !== "クローズ").length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [storeGroups]);

  const dialogStoreCases = storeDialogKey ? storeGroups.get(storeDialogKey) ?? [] : [];

  // タブごとの件数
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: cases.length };
    for (const s of STAGES) counts[s.key] = 0;
    for (const c of cases) {
      const stage = (c.progressStage as ProgressStage) ?? "未対応";
      counts[stage] = (counts[stage] ?? 0) + 1;
    }
    return counts;
  }, [cases]);

  const filtered = useMemo(() => {
    // 「進行中」は複数ステータスのまとめ、「high」は緊急度S/Aのまとめ
    const IN_PROGRESS = ["受付", "現調中", "見積中", "施工待ち", "施工中"];
    return cases.filter((c) => {
      const stage = (c.progressStage as ProgressStage) ?? "未対応";
      if (stageTab !== "all" && stage !== stageTab) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "進行中") {
          if (!IN_PROGRESS.includes(c.status)) return false;
        } else if (c.status !== statusFilter) return false;
      }
      if (urgency === "high") {
        if (c.urgency !== "S" && c.urgency !== "A") return false;
      } else if (urgency !== "all" && c.urgency !== urgency) return false;
      if (prefFilter !== "all" && resolveCasePrefecture(c) !== prefFilter) return false;
      if (assignee === "mine" && c.assigneeId !== user?.id) return false;
      if (assignee === "unassigned" && c.assigneeId != null) return false;
      if (assignee !== "all" && assignee !== "mine" && assignee !== "unassigned") {
        if (c.assigneeId !== Number(assignee)) return false;
      }
      if (debouncedQ) {
        const keyword = debouncedQ.toLowerCase();
        return (
          c.storeName.toLowerCase().includes(keyword) ||
          c.requestNumber.toLowerCase().includes(keyword) ||
          (c.address ?? "").toLowerCase().includes(keyword) ||
          (c.categoryLarge ?? "").toLowerCase().includes(keyword) ||
          (c.categoryMedium ?? "").toLowerCase().includes(keyword)
        );
      }
      return true;
    });
  }, [cases, debouncedQ, stageTab, urgency, statusFilter, prefFilter, assignee, user?.id]);

  // アクティブなクイックフィルタ（チップ表示用）
  const activeQuickFilter = useMemo(() => {
    if (statusFilter === "進行中") return { label: "進行中の案件", kind: "status" as const };
    if (statusFilter === "完了") return { label: "完了した案件", kind: "status" as const };
    if (statusFilter !== "all") return { label: `ステータス: ${statusFilter}`, kind: "status" as const };
    if (urgency === "high") return { label: "緊急/高 S・A", kind: "urgency" as const };
    return null;
  }, [statusFilter, urgency]);

  function clearQuickFilter() {
    setStatusFilter("all");
    if (urgency === "high") setUrgency("all");
    // URLをクリーンに（クエリを除去）
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/cases");
    }
  }

  // 県フィルタの選択肢（実際に案件が存在する県のみ・件数付き・標準順）
  const prefOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cases) {
      const label = resolveCasePrefecture(c);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => prefectureSortIndex(a.label) - prefectureSortIndex(b.label));
  }, [cases]);

  // 県別グルーピング（県見出し→案件配列、標準の都道府県順、未分類は最後）
  const prefGroups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const c of filtered) {
      const label = resolveCasePrefecture(c);
      const arr = map.get(label) ?? [];
      arr.push(c);
      map.set(label, arr);
    }
    return Array.from(map.entries())
      .map(([label, list]) => ({ label, list }))
      .sort((a, b) => prefectureSortIndex(a.label) - prefectureSortIndex(b.label));
  }, [filtered]);

  // 地方（エリア）→ 県 の二段グルーピング
  const regionGroups = useMemo(() => {
    const map = new Map<string, typeof prefGroups>();
    for (const pg of prefGroups) {
      const region = regionOfPrefecture(pg.label);
      const arr = map.get(region) ?? [];
      arr.push(pg);
      map.set(region, arr);
    }
    return Array.from(map.entries())
      .map(([label, prefs]) => ({
        label,
        prefs: prefs
          .slice()
          .sort((a, b) => prefectureSortIndex(a.label) - prefectureSortIndex(b.label)),
        count: prefs.reduce((sum, p) => sum + p.list.length, 0),
      }))
      .sort((a, b) => regionSortIndex(a.label) - regionSortIndex(b.label));
  }, [prefGroups]);

  // 仮想スクロール（compact / table モード用）
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const compactVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 44, // compact行の推定高さ(px)
    overscan: 10,
  });
  const tableVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 40, // table行の推定高さ(px)
    overscan: 10,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-border/60 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Cases</p>
          <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">案件一覧</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {filtered.length} / {cases.length} 件
          </p>
          {activeQuickFilter && (
            <button
              type="button"
              onClick={clearQuickFilter}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
              title="このフィルタを解除"
            >
              {activeQuickFilter.label}
              <span className="text-primary/70">×</span>
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/cases/import-pdf")}>
            PDFから登録
          </Button>
          <Button variant="outline" onClick={() => setLocation("/cases/import")}>
            CSV
          </Button>
          <Button onClick={() => setLocation("/cases/new")} className="shadow-sm">
            <Plus className="h-4 w-4" />
            新規案件
          </Button>
        </div>
      </div>

      {/* Progress Stage Tabs（フォルダ分け） */}
      <Tabs value={stageTab} onValueChange={(v) => setStageTab(v as any)}>
        <TabsList className="w-full grid grid-cols-5 h-auto p-1 bg-stone-100/70">
          <TabsTrigger value="all" className="flex flex-col gap-0.5 py-2 data-[state=active]:bg-white">
            <span className="flex items-center gap-1.5 text-xs">
              <Folder className="h-3.5 w-3.5" />
              全て
            </span>
            <span className="font-mono text-base font-semibold">{stageCounts.all}</span>
          </TabsTrigger>
          {STAGES.map((s) => {
            const Icon = s.icon;
            return (
              <TabsTrigger
                key={s.key}
                value={s.key}
                className="flex flex-col gap-0.5 py-2 data-[state=active]:bg-white"
              >
                <span className={`flex items-center gap-1.5 text-xs ${s.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </span>
                <span className="font-mono text-base font-semibold">{stageCounts[s.key] ?? 0}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="店舗名・依頼番号・住所で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-36">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            <SelectItem value="進行中">進行中・受付～施工中</SelectItem>
            <SelectItem value="受付">受付</SelectItem>
            <SelectItem value="現調中">現調中</SelectItem>
            <SelectItem value="見積中">見積中</SelectItem>
            <SelectItem value="施工待ち">施工待ち</SelectItem>
            <SelectItem value="施工中">施工中</SelectItem>
            <SelectItem value="完了">完了</SelectItem>
            <SelectItem value="クローズ">クローズ</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={urgency === "high" ? "all" : urgency}
          onValueChange={setUrgency}
        >
          <SelectTrigger className="md:w-32">
            <SelectValue placeholder="緊急度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全緊急度</SelectItem>
            <SelectItem value="S">S 緊急</SelectItem>
            <SelectItem value="A">A 高</SelectItem>
            <SelectItem value="B">B 中</SelectItem>
            <SelectItem value="C">C 低</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="md:w-40">
            <SelectValue placeholder="担当者" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全担当者</SelectItem>
            <SelectItem value="mine">自分の案件</SelectItem>
            <SelectItem value="unassigned">未割当</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.name || u.email || `User #${u.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prefFilter} onValueChange={setPrefFilter}>
          <SelectTrigger className="md:w-40">
            <SelectValue placeholder="都道府県" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全県</SelectItem>
            {prefOptions.map((p) => (
              <SelectItem key={p.label} value={p.label}>
                {p.label}・{p.count}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 px-3 rounded-md border border-border bg-background shrink-0">
          <MapIcon className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="groupByPref" className="text-xs whitespace-nowrap cursor-pointer">
            県別表示
          </Label>
          <Switch id="groupByPref" checked={groupByPref} onCheckedChange={setGroupByPref} />
        </div>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => {
            if (v) {
              setViewMode(v as any);
              localStorage.setItem("cases-view-mode", v);
            }
          }}
          className="border rounded-md p-0.5 bg-muted/30"
        >
          <ToggleGroupItem value="card" aria-label="カード表示" className="h-8 w-8 p-0">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="compact" aria-label="コンパクト表示" className="h-8 w-8 p-0">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="テーブル表示" className="h-8 w-8 p-0">
            <Table2 className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* 複数案件を抱える店舗サマリー */}
      {multiCaseStores.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <h3 className="text-sm font-semibold text-amber-900">
                複数案件を抱える店舗
              </h3>
              <Badge variant="outline" className="text-[10px] bg-white border-amber-200">
                {multiCaseStores.length}店
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {multiCaseStores.slice(0, 8).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStoreDialogKey(s.key)}
                  className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-amber-200 hover:border-amber-400 hover:shadow-sm transition-all text-xs"
                >
                  <Building2 className="h-3.5 w-3.5 text-amber-700" />
                  <span className="font-medium truncate max-w-[160px]">{s.storeName}</span>
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-600 text-white font-bold text-[10px]">
                    {s.count}
                  </span>
                  {s.openCount > 0 && s.openCount < s.count && (
                    <span className="text-[10px] text-amber-700">進行中 {s.openCount}</span>
                  )}
                </button>
              ))}
              {multiCaseStores.length > 8 && (
                <span className="text-xs text-muted-foreground self-center px-2">
                  他 {multiCaseStores.length - 8} 店
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center flex flex-col items-center gap-3">
            <Folder className="h-10 w-10 text-muted-foreground/70" />
            <p className="font-medium">該当する案件がありません</p>
            <p className="text-sm text-muted-foreground max-w-sm">タブや検索キーワード、担当者・緊急度フィルタを切り替えてもう一度お試しください。</p>
          </CardContent>
        </Card>
      ) : groupByPref ? (
        <div className="space-y-5">
          {regionGroups.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-background"
                onClick={() => setCollapsedRegions(new Set())}
              >
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
                すべて展開
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-background"
                onClick={() => setCollapsedRegions(new Set(regionGroups.map((r) => r.label)))}
              >
                <ChevronRight className="h-3.5 w-3.5 mr-1" />
                すべて折り畳む
              </Button>
            </div>
          )}
          {regionGroups.map((region) => {
            const collapsed = collapsedRegions.has(region.label);
            return (
              <section key={region.label} className="rounded-lg border border-border/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleRegion(region.label)}
                  aria-expanded={!collapsed}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                >
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
                  />
                  <MapIcon className="h-4 w-4 text-primary" />
                  <h2 className="font-serif-jp text-lg font-semibold">{region.label}</h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {region.count}件
                  </Badge>
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {region.prefs.length}県
                  </span>
                </button>
                {!collapsed && (
                  <div className="p-4 space-y-5">
                    {region.prefs.map((group) => (
                      <div key={group.label}>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="h-3.5 w-3.5 text-primary/70" />
                          <h3 className="font-serif-jp text-base font-semibold">{group.label}</h3>
                          <Badge variant="outline" className="text-[10px]">
                            {group.list.length}件
                          </Badge>
                          <div className="flex-1 h-px bg-border/60 ml-2" />
                        </div>
                        <div className="grid gap-3">{group.list.map((c) => renderCard(c))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : viewMode === "card" ? (
        <div className="grid gap-3">{filtered.map((c) => renderCard(c))}</div>
      ) : viewMode === "compact" ? (
        <div
          ref={scrollParentRef}
          className="border rounded-lg overflow-y-auto bg-card"
          style={{ height: "calc(100vh - 320px)" }}
        >
          <div
            style={{ height: `${compactVirtualizer.getTotalSize()}px`, position: "relative" }}
          >
            {compactVirtualizer.getVirtualItems().map((virtualRow) => {
              const c = filtered[virtualRow.index];
              const assigneeUser = c.assigneeId ? userMap.get(c.assigneeId) : null;
              return (
                <div
                  key={c.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors border-b"
                  onClick={() => setLocation(`/cases/${c.id}`)}
                >
                  <span className={`inline-flex h-5 min-w-5 px-1 items-center justify-center rounded text-[9px] font-bold ${URGENCY_COLORS[c.urgency]}`}>
                    {c.urgency}
                  </span>
                  <Select
                    value={(c.progressStage as string) ?? "未対応"}
                    onValueChange={(v) => handleStageChange(c.id, v)}
                  >
                    <SelectTrigger
                      className={`h-6 w-auto min-w-[60px] px-2 text-[9px] font-medium border ${STAGE_BADGE[(c.progressStage as ProgressStage) ?? "未対応"]} shrink-0`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROGRESS_STAGES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={c.status}
                    onValueChange={(v) => handleStatusChange(c.id, v)}
                  >
                    <SelectTrigger
                      className={`h-6 w-auto min-w-[70px] px-2 text-[9px] font-medium border ${STATUS_COLORS[c.status]} shrink-0`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CASE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-medium truncate min-w-0 flex-1">{c.storeName}</span>
                  <span className="text-[11px] text-muted-foreground font-mono shrink-0 hidden sm:inline">{c.requestNumber}</span>
                  {!isPartner && c.plenusQuoteAmount != null && (
                    <span className="text-xs font-mono text-emerald-700 shrink-0">¥{c.plenusQuoteAmount.toLocaleString()}</span>
                  )}
                  {assigneeUser && (
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className={`text-[9px] font-semibold ${avatarColor(assigneeUser.id)}`}>
                        {userInitials(assigneeUser.name, assigneeUser.email)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          ref={scrollParentRef}
          className="border rounded-lg overflow-y-auto bg-card"
          style={{ height: "calc(100vh - 320px)" }}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">緑急</th>
                <th className="px-3 py-2 text-left font-medium">ステータス</th>
                <th className="px-3 py-2 text-left font-medium">店舗名</th>
                <th className="px-3 py-2 text-left font-medium hidden md:table-cell">依頼番号</th>
                <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">工事区分</th>
                <th className="px-3 py-2 text-right font-medium">出し見積</th>
                <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">担当</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ height: `${tableVirtualizer.getTotalSize()}px` }}>
                <td colSpan={8} style={{ padding: 0, position: "relative" }}>
                  {tableVirtualizer.getVirtualItems().map((virtualRow) => {
                    const c = filtered[virtualRow.index];
                    const assigneeUser = c.assigneeId ? userMap.get(c.assigneeId) : null;
                    return (
                      <div
                        key={c.id}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="flex items-center hover:bg-muted/30 cursor-pointer transition-colors border-b text-sm"
                        onClick={() => setLocation(`/cases/${c.id}`)}
                      >
                        <span className="px-3 py-2 w-[60px] shrink-0">
                          <span className={`inline-flex h-5 min-w-5 px-1 items-center justify-center rounded text-[9px] font-bold ${URGENCY_COLORS[c.urgency]}`}>{c.urgency}</span>
                        </span>
                        <span className="px-3 py-2 w-[100px] shrink-0">
                          <span className={`inline-block h-6 px-2 text-[9px] font-medium border rounded leading-6 ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                        </span>
                        <span className="px-3 py-2 font-medium truncate flex-1 min-w-0">{c.storeName}</span>
                        <span className="px-3 py-2 font-mono text-xs text-muted-foreground w-[120px] shrink-0 hidden md:inline">{c.requestNumber}</span>
                        <span className="px-3 py-2 text-xs text-muted-foreground w-[100px] shrink-0 hidden lg:inline">{c.categoryLarge || "—"}</span>
                        {!isPartner && <span className="px-3 py-2 text-right font-mono text-xs w-[100px] shrink-0">{c.plenusQuoteAmount != null ? `¥${c.plenusQuoteAmount.toLocaleString()}` : "—"}</span>}
                        <span className="px-3 py-2 w-[80px] shrink-0 hidden sm:inline">
                          {assigneeUser ? (
                            <span className="text-xs">{assigneeUser.name || assigneeUser.email}</span>
                          ) : (
                            <span className="text-xs text-amber-600">未割当</span>
                          )}
                        </span>
                        <span className="px-3 py-2 w-[40px] shrink-0"><ChevronRight className="h-4 w-4 text-muted-foreground" /></span>
                      </div>
                    );
                  })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 同一店舗案件ダイアログ */}
      <Dialog open={!!storeDialogKey} onOpenChange={(open) => !open && setStoreDialogKey(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-700" />
              {dialogStoreCases[0]?.storeName ?? "店舗名"}
              <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-800">
                {dialogStoreCases.length}件
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              この店舗で進行中・完了済みの案件一覧です。クリックで詳細へ遷移します。
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border/60 max-h-[60vh] overflow-y-auto">
            {dialogStoreCases
              .slice()
              .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
              .map((c) => {
                const stage = (c.progressStage as ProgressStage) ?? "未対応";
                const assigneeUser = c.assigneeId ? userMap.get(c.assigneeId) : null;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setStoreDialogKey(null);
                      setLocation(`/cases/${c.id}`);
                    }}
                    className="w-full text-left py-3 px-2 hover:bg-muted/40 rounded transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`inline-flex h-5 min-w-5 px-1.5 items-center justify-center rounded text-[9px] font-bold ${URGENCY_COLORS[c.urgency]}`}
                      >
                        {URGENCY_LABEL[c.urgency]}
                      </span>
                      <Select
                        value={stage}
                        onValueChange={(v) => { handleStageChange(c.id, v); }}
                      >
                        <SelectTrigger
                          className={`h-5 w-auto min-w-[60px] px-1.5 text-[10px] font-medium border ${STAGE_BADGE[stage]}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROGRESS_STAGES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={c.status}
                        onValueChange={(v) => { handleStatusChange(c.id, v); }}
                      >
                        <SelectTrigger
                          className={`h-5 w-auto min-w-[60px] px-1.5 text-[10px] font-medium border ${STATUS_COLORS[c.status]}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CASE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {c.requestNumber}
                      </span>
                      {c.requestDate && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(c.requestDate).toLocaleDateString("ja-JP")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {c.categoryLarge || "—"} / {c.categoryMedium || "—"}
                      </span>
                      {assigneeUser && (
                        <Badge variant="secondary" className="text-[10px]">
                          {assigneeUser.name || assigneeUser.email}
                        </Badge>
                      )}
                      {!assigneeUser && (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                          未割当
                        </Badge>
                      )}
                      {c.estimatedCost != null && (
                        <span className="font-mono text-[10px] ml-auto">
                          ¥{c.estimatedCost.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {c.requestContent && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                        {c.requestContent}
                      </p>
                    )}
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderCard(c: (typeof cases)[number]) {
    const stage = (c.progressStage as ProgressStage) ?? "未対応";
    const assigneeUser = c.assigneeId ? userMap.get(c.assigneeId) : null;
    const sameStoreList = storeGroups.get(storeKey(c)) ?? [];
    const sameStoreCount = sameStoreList.length;
    return (
              <Card
                key={c.id}
                className="hover:shadow-md hover:border-primary/40 transition-all duration-200"
              >
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setLocation(`/cases/${c.id}`)}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded text-[10px] font-bold ${URGENCY_COLORS[c.urgency]}`}
                        >
                          {URGENCY_LABEL[c.urgency]}
                        </span>
                        <Select
                          value={stage}
                          onValueChange={(v) => handleStageChange(c.id, v)}
                        >
                          <SelectTrigger
                            className={`h-6 w-auto min-w-[70px] px-2 text-[10px] font-medium border ${STAGE_BADGE[stage]}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROGRESS_STAGES.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={c.status}
                          onValueChange={(v) => handleStatusChange(c.id, v)}
                        >
                          <SelectTrigger
                            className={`h-6 w-auto min-w-[70px] px-2 text-[10px] font-medium border ${STATUS_COLORS[c.status]}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CASE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Badge variant="secondary" className="text-[10px]">
                          {c.brand}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {c.requestNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-semibold text-base truncate">{c.storeName}</h3>
                        {sameStoreCount > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStoreDialogKey(storeKey(c));
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-[10px] font-medium text-amber-800 shrink-0"
                            title={`同じ店舗に他 ${sameStoreCount - 1} 件の案件があります`}
                          >
                            <Layers className="h-3 w-3" />
                            同店舗 {sameStoreCount}件
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {c.address && (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="truncate">{c.address}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span>
                            <span className="text-muted-foreground font-medium">工事</span>{" "}
                            {c.categoryLarge || "—"} / {c.categoryMedium || "—"}
                          </span>
                          {c.requesterName && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {c.requesterName}
                            </span>
                          )}
                          {c.requestDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(c.requestDate).toLocaleDateString("ja-JP")}
                            </span>
                          )}
                          {c.requestDate && c.actualCost != null && (
                            <span className="font-mono text-emerald-700">
                              実績: ¥{c.actualCost.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 出し見積 / 実行見積 / 粗利（一覧で即時確認用） */}
                      {(() => {
                        const hasAmount =
                          c.plenusQuoteAmount != null || c.estimatedCost != null;
                        if (!hasAmount) return null;
                        const profit = calcCaseProfit({
                          plenusQuoteAmount: c.plenusQuoteAmount,
                          estimatedCost: c.estimatedCost,
                          expensesTotal: 0,
                        });
                        const gp = profit.grossProfit;
                        const gpColor =
                          gp > 0
                            ? "text-emerald-700"
                            : gp < 0
                              ? "text-red-600"
                              : "text-muted-foreground";
                        return (
                          <div className="mt-3 flex flex-wrap items-stretch gap-2">
                            {!isPartner && (
                            <div className="rounded-md border bg-stone-50/80 px-3 py-1.5">
                              <p className="text-[10px] text-muted-foreground leading-none mb-1">
                                出し見積{profit.salesIsEstimated ? " 想定" : ""}
                              </p>
                              <p className="font-mono text-sm font-semibold">
                                {c.plenusQuoteAmount != null
                                  ? `¥${c.plenusQuoteAmount.toLocaleString()}`
                                  : profit.sales > 0
                                    ? `¥${profit.sales.toLocaleString()}`
                                    : "—"}
                              </p>
                            </div>
                            )}
                            <div className="rounded-md border bg-stone-50/80 px-3 py-1.5">
                              <p className="text-[10px] text-muted-foreground leading-none mb-1">
                                実行見積
                              </p>
                              <p className="font-mono text-sm font-semibold">
                                {c.estimatedCost != null
                                  ? `¥${c.estimatedCost.toLocaleString()}`
                                  : "—"}
                              </p>
                            </div>
                            {!isPartner && (
                            <div className={`rounded-md border px-3 py-1.5 ${gp > 0 ? "bg-emerald-50/70 border-emerald-200" : gp < 0 ? "bg-red-50/70 border-red-200" : "bg-stone-50/80"}`}>
                              <p className="text-[10px] text-muted-foreground leading-none mb-1">
                                粗利
                              </p>
                              <p className={`font-mono text-sm font-semibold ${gpColor}`}>
                                {gp >= 0 ? "¥" : "-¥"}
                                {Math.abs(gp).toLocaleString()}
                                {profit.sales > 0 && (
                                  <span className="ml-1 text-[10px] font-normal">
                                    ({Math.round(profit.grossMargin * 100)}%)
                                  </span>
                                )}
                              </p>
                            </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Assignee badge & actions */}
                    <div className="flex md:flex-col items-center md:items-end gap-3 shrink-0">
                      {assigneeUser ? (
                        <div className="flex items-center gap-2">
                          <Avatar className={`h-9 w-9 ring-2 ring-white shadow-sm`}>
                            <AvatarFallback
                              className={`text-[11px] font-semibold ${avatarColor(assigneeUser.id)}`}
                            >
                              {userInitials(assigneeUser.name, assigneeUser.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="hidden md:block text-right">
                            <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
                              担当
                            </p>
                            <p className="text-xs font-medium truncate max-w-[120px]">
                              {assigneeUser.name || assigneeUser.email}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-700">
                          <div className="h-9 w-9 rounded-full bg-amber-50 border-2 border-amber-200 border-dashed flex items-center justify-center">
                            <UserCircle2 className="h-5 w-5" />
                          </div>
                          <div className="hidden md:block text-right">
                            <p className="text-[10px] leading-none mb-0.5 text-amber-700">未割当</p>
                            <p className="text-xs text-amber-700">要アサイン</p>
                          </div>
                        </div>
                      )}
                      <div className="flex md:flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/cases/${c.id}/ledger`);
                          }}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          台帳
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setLocation(`/cases/${c.id}`)}
                        >
                          詳細
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
    );
  }
}
