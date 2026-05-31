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
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  MapPin,
  Phone,
  Calendar,
  FileText,
  ChevronRight,
  UserCircle2,
  CircleDashed,
  ClipboardCheck,
  Receipt,
  CheckCircle2,
  Folder,
  Building2,
  Layers,
  AlertTriangle,
} from "lucide-react";
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
  const { data: cases = [], isLoading } = trpc.cases.list.useQuery();
  const { data: users = [] } = trpc.users.list.useQuery();
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const [q, setQ] = useState("");
  const [stageTab, setStageTab] = useState<"all" | ProgressStage>("all");
  const [urgency, setUrgency] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [storeDialogKey, setStoreDialogKey] = useState<string | null>(null);

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
    return cases.filter((c) => {
      const stage = (c.progressStage as ProgressStage) ?? "未対応";
      if (stageTab !== "all" && stage !== stageTab) return false;
      if (urgency !== "all" && c.urgency !== urgency) return false;
      if (assignee === "mine" && c.assigneeId !== user?.id) return false;
      if (assignee === "unassigned" && c.assigneeId != null) return false;
      if (assignee !== "all" && assignee !== "mine" && assignee !== "unassigned") {
        if (c.assigneeId !== Number(assignee)) return false;
      }
      if (q) {
        const keyword = q.toLowerCase();
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
  }, [cases, q, stageTab, urgency, assignee, user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-border/60 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Cases</p>
          <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">案件一覧</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {filtered.length} / {cases.length} 件
          </p>
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
        <Select value={urgency} onValueChange={setUrgency}>
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
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">該当する案件がありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => {
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
                        <Badge variant="outline" className={`text-[10px] ${STAGE_BADGE[stage]}`}>
                          {stage}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[c.status]}`}>
                          {c.status}
                        </Badge>
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
                            <span className="text-muted-foreground/60">工事:</span>{" "}
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
                          {c.estimatedCost != null && (
                            <span className="font-mono">
                              見積: ¥{c.estimatedCost.toLocaleString()}
                            </span>
                          )}
                          {c.actualCost != null && (
                            <span className="font-mono text-emerald-700">
                              実績: ¥{c.actualCost.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
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
          })}
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
                      <Badge variant="outline" className={`text-[10px] ${STAGE_BADGE[stage]}`}>
                        {stage}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[c.status]}`}>
                        {c.status}
                      </Badge>
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
}
