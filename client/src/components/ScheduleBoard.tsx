import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Route,
  Sparkles,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  ArrowUpRight,
  MapPin,
  Hammer,
  Search,
  Users,
  UserCog,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";

const NULL_USER_VALUE = "__none__";

function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 60%, 45%)`;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return trimmed.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Team = "A" | "B";
type TaskType = "survey" | "construction";

const URGENCY_COLORS: Record<string, string> = {
  S: "bg-red-600 text-white",
  A: "bg-orange-500 text-white",
  B: "bg-yellow-500 text-white",
  C: "bg-emerald-500 text-white",
};

function fmtYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function dayLabel(ymd: string): string {
  const d = new Date(ymd);
  const wk = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()} (${wk[d.getDay()]})`;
}

// Haversine公式で km 計算
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 順序付きタスクの総移動距離と未地図化件数を計算 */
function computeRouteDistance(
  items: Array<{ caseId: number }>,
  caseLatLng: Map<number, { lat: number | null; lng: number | null }>,
): { km: number; missing: number; usable: number } {
  const pts: Array<{ lat: number; lng: number }> = [];
  let missing = 0;
  for (const it of items) {
    const c = caseLatLng.get(it.caseId);
    if (c?.lat != null && c?.lng != null) {
      pts.push({ lat: c.lat, lng: c.lng });
    } else {
      missing++;
    }
  }
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    km += haversineKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  }
  return { km, missing, usable: pts.length };
}

/** 車で街中平均25km/h ・ 訪問1件あたり30分件換h で概算 */
function estimateDurationMin(km: number, visits: number): number {
  const driveMin = (km / 25) * 60;
  const visitMin = visits * 30;
  return Math.round(driveMin + visitMin);
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export default function ScheduleBoard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [, setLocation] = useLocation();

  const [start] = useState(() => fmtYmd(new Date()));
  const [end] = useState(() => fmtYmd(addDays(new Date(), 14)));

  const utils = trpc.useUtils();
  const suggest = trpc.routes.suggest.useQuery();
  const list = trpc.routes.list.useQuery({ start, end });
  const cases = trpc.cases.list.useQuery();
  const usersQ = trpc.users.list.useQuery();
  const teamSettingsQ = trpc.teamSettings.list.useQuery();
  const userById = useMemo(() => {
    const m = new Map<number, { id: number; name: string }>();
    for (const u of usersQ.data ?? []) {
      m.set(u.id, { id: u.id, name: u.name ?? `ユーザー#${u.id}` });
    }
    return m;
  }, [usersQ.data]);
  const apply = trpc.routes.applySuggestion.useMutation({
    onSuccess: () => {
      toast.success("提案スケジュールを反映しました");
      utils.routes.list.invalidate();
    },
    onError: (e) => toast.error(`反映に失敗: ${e.message}`),
  });
  const upsert = trpc.routes.upsert.useMutation({
    onSuccess: () => utils.routes.list.invalidate(),
  });
  const remove = trpc.routes.remove.useMutation({
    onSuccess: () => utils.routes.list.invalidate(),
  });
  const geocode = trpc.routes.geocodeMissing.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.updated}/${r.total} 件の住所を地図情報化しました`);
      utils.routes.suggest.invalidate();
    },
    onError: (e) => toast.error(`住所変換失敗: ${e.message}`),
  });

  // 反映済みスケジュールを team x date でグループ化
  const grouped = useMemo(() => {
    const items = list.data ?? [];
    const map = new Map<string, typeof items>();
    for (const r of items) {
      const key = `${r.team}|${r.scheduledDate}`;
      const arr = map.get(key) ?? [];
      arr.push(r);
      arr.sort((a, b) => a.sequence - b.sequence);
      map.set(key, arr);
    }
    return map;
  }, [list.data]);

  // 全日付の昇順リスト（A,B両方の日を網羅）
  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const r of list.data ?? []) set.add(r.scheduledDate);
    return Array.from(set).sort();
  }, [list.data]);

  const caseById = useMemo(() => {
    const m = new Map<number, typeof cases.data extends Array<infer T> ? T : never>();
    for (const c of cases.data ?? []) m.set(c.id, c as never);
    return m;
  }, [cases.data]);

  const caseLatLng = useMemo(() => {
    const m = new Map<number, { lat: number | null; lng: number | null }>();
    for (const c of cases.data ?? []) {
      const cc = c as unknown as { id: number; lat: number | null; lng: number | null };
      m.set(cc.id, { lat: cc.lat, lng: cc.lng });
    }
    return m;
  }, [cases.data]);

  // 日付×チームごとの距離・所要時間を可視化用に集計
  const totalDistanceKm = useMemo(() => {
    let total = 0;
    grouped.forEach((arr) => {
      const r = computeRouteDistance(arr, caseLatLng);
      total += r.km;
    });
    return total;
  }, [grouped, caseLatLng]);

  const handleApply = () => {
    if (!suggest.data) return;
    const all = [
      ...suggest.data.teamA.map((t) => ({ ...t, team: "A" as Team })),
      ...suggest.data.teamB.map((t) => ({ ...t, team: "B" as Team })),
    ];
    if (all.length === 0) {
      toast.info("提案できる案件がありません");
      return;
    }
    apply.mutate({
      start,
      end,
      assignments: all.map((a) => ({
        caseId: a.caseId,
        team: a.team,
        taskType: a.taskType,
        scheduledDate: a.scheduledDate,
        sequence: a.sequence,
        notes: a.reason,
      })),
    });
  };

  const totalSuggested =
    (suggest.data?.teamA.length ?? 0) + (suggest.data?.teamB.length ?? 0);
  const totalScheduled = list.data?.length ?? 0;

  // ── Drag & Drop ──
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // "A|2026-05-31"

  function handleDragStart(e: React.DragEvent, id: number) {
    if (!isAdmin) return;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", String(id));
    } catch {
      /* noop */
    }
  }
  function handleDragOver(e: React.DragEvent, key: string) {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTarget !== key) setDropTarget(key);
  }
  function handleDragLeave(key: string) {
    if (dropTarget === key) setDropTarget(null);
  }
  function handleDragEnd() {
    setDragId(null);
    setDropTarget(null);
  }
  function handleDrop(e: React.DragEvent, team: Team, date: string) {
    if (!isAdmin) return;
    e.preventDefault();
    const idStr = e.dataTransfer.getData("text/plain") || (dragId != null ? String(dragId) : "");
    const id = Number(idStr);
    setDragId(null);
    setDropTarget(null);
    if (!id) return;
    const item = (list.data ?? []).find((r) => r.id === id);
    if (!item) return;
    if (item.team === team && item.scheduledDate === date) return;
    // ドロップ先の末尾にsequenceを振る
    const targetItems = (list.data ?? []).filter((r) => r.team === team && r.scheduledDate === date);
    const nextSeq = targetItems.length > 0 ? Math.max(...targetItems.map((t) => t.sequence)) + 1 : 0;
    upsert.mutate(
      {
        id: item.id,
        caseId: item.caseId,
        team,
        taskType: item.taskType,
        scheduledDate: date,
        sequence: nextSeq,
        notes: item.notes,
        assigneeId: item.assigneeId,
      },
      {
        onSuccess: () =>
          toast.success(`チーム${team} / ${dayLabel(date)} に移動しました`),
        onError: (err) => toast.error(`移動失敗: ${err.message}`),
      },
    );
  }

  return (
    <Card className="border-l-4 border-l-primary/70 overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/5 to-amber-50 px-5 py-4 border-b">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
                <Route className="h-3.5 w-3.5" />
                Route Planner
              </div>
              <h2 className="font-serif-jp text-xl font-semibold">
                最適ルート提案 ＆ スケジュール盤
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                推進ロジック：緊急度 → 進捗ステージ → 滞留日数 → 近接性。担当2名（A/B）に均等配分。
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-white">
                提案 {totalSuggested} 件
              </Badge>
              <Badge variant="outline" className="bg-white">
                確定 {totalScheduled} 件
              </Badge>
              {totalDistanceKm > 0 && (
                <Badge variant="outline" className="bg-white border-emerald-300 text-emerald-700">
                  <Navigation className="h-3 w-3 mr-1" />
                  総距離 {totalDistanceKm.toFixed(1)} km
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => geocode.mutate()}
                disabled={geocode.isPending}
                title="未ジオコード住所を一括変換"
              >
                <MapPin className="h-3.5 w-3.5 mr-1" />
                住所→地図
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  utils.routes.suggest.invalidate();
                  utils.routes.list.invalidate();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                再計算
              </Button>
              {isAdmin && (
                <TeamSettingsDialog />
              )}
              {isAdmin && (
                <Button size="sm" onClick={handleApply} disabled={apply.isPending}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  提案を反映
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Suggested top picks */}
        {suggest.data && (suggest.data.teamA.length > 0 || suggest.data.teamB.length > 0) && (
          <div className="px-5 py-3 border-b bg-muted/30">
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              次にやるべきタスク（提案・上位）
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TeamSuggestList team="A" tasks={suggest.data.teamA.slice(0, 5)} />
              <TeamSuggestList team="B" tasks={suggest.data.teamB.slice(0, 5)} />
            </div>
          </div>
        )}

        {/* Scheduled board */}
        <div className="px-5 py-4">
          <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center justify-between">
            <span>確定スケジュール（{start} 〜 {end}）</span>
            {isAdmin && <AddAssignmentInline />}
          </div>

          {list.isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">読み込み中...</div>
          ) : allDates.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded">
              まだ確定スケジュールがありません。「提案を反映」または右上「+追加」でスタート。
            </div>
          ) : (
            <div className="space-y-3">
              {allDates.map((date) => (
                <div key={date} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(["A", "B"] as Team[]).map((team) => {
                    const items = grouped.get(`${team}|${date}`) ?? [];
                    const teamSetting = team === "A" ? teamSettingsQ.data?.A : teamSettingsQ.data?.B;
                    const leadUser = teamSetting?.primaryUserId
                      ? userById.get(teamSetting.primaryUserId)
                      : undefined;
                    const dropKey = `${team}|${date}`;
                    const isDropOver = dropTarget === dropKey;
                    return (
                      <div
                        key={`${date}-${team}`}
                        onDragOver={(e) => handleDragOver(e, dropKey)}
                        onDragLeave={() => handleDragLeave(dropKey)}
                        onDrop={(e) => handleDrop(e, team, date)}
                        className={`border rounded-lg overflow-hidden bg-card transition-all ${
                          isDropOver ? "ring-2 ring-primary ring-offset-1 bg-primary/5" : ""
                        }`}
                      >
                        <div
                          className={`px-3 py-2 text-xs font-semibold flex items-center justify-between gap-2 ${
                            team === "A"
                              ? "bg-blue-50 text-blue-900"
                              : "bg-purple-50 text-purple-900"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0">チーム{team}</span>
                            {leadUser ? (
                              <div className="flex items-center gap-1 min-w-0">
                                <Avatar className="h-4 w-4">
                                  <AvatarFallback
                                    className="text-[8px] text-white"
                                    style={{ backgroundColor: colorFromName(leadUser.name) }}
                                  >
                                    {initials(leadUser.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate text-[11px] font-normal opacity-90">
                                  {leadUser.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-normal opacity-60 italic">担当者未設定</span>
                            )}
                            <span className="text-[10px] font-normal opacity-70">· {dayLabel(date)}</span>
                          </div>
                          <span className="text-[10px] opacity-70 shrink-0">
                            {items.length}件
                          </span>
                        </div>
                        {(() => {
                          if (items.length === 0) return null;
                          const r = computeRouteDistance(items, caseLatLng);
                          const dur = estimateDurationMin(r.km, r.usable);
                          return (
                            <div
                              className={`px-3 py-1.5 text-[10px] flex items-center justify-between gap-2 border-b ${
                                team === "A" ? "bg-blue-50/50" : "bg-purple-50/50"
                              }`}
                            >
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Navigation className="h-3 w-3" />
                                  {r.usable >= 2 ? `${r.km.toFixed(1)} km` : "距離計算不可"}
                                </span>
                                {r.usable >= 1 && (
                                  <span className="text-muted-foreground/80">・ 所要約 {fmtDuration(dur)}</span>
                                )}
                              </div>
                              {r.missing > 0 && (
                                <span
                                  className="text-amber-700 font-medium"
                                  title="住所が未ジオコードのため距離に含められません"
                                >
                                  {r.missing}件未地図化
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="divide-y">
                          {items.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-muted-foreground italic">
                              タスクなし
                            </div>
                          ) : (
                            items.map((item, idx) => {
                              const c = caseById.get(item.caseId) as
                                | { requestNumber: string; storeName: string; address: string | null; urgency: string; progressStage: string }
                                | undefined;
                              const assignee = item.assigneeId
                                ? userById.get(item.assigneeId)
                                : undefined;
                              const isDragging = dragId === item.id;
                              return (
                                <div
                                  key={item.id}
                                  draggable={isAdmin}
                                  onDragStart={(e) => handleDragStart(e, item.id)}
                                  onDragEnd={handleDragEnd}
                                  className={`px-3 py-2 flex items-start gap-2 hover:bg-muted/30 ${
                                    isAdmin ? "cursor-grab active:cursor-grabbing" : ""
                                  } ${isDragging ? "opacity-40" : ""}`}
                                  title={isAdmin ? "ドラッグしてチーム/日付を変更" : undefined}
                                >
                                  <span className="text-xs font-bold text-muted-foreground w-5 text-center pt-0.5 select-none">
                                    {idx + 1}
                                  </span>
                                  <button
                                    onClick={() =>
                                      setLocation(`/cases/${item.caseId}`)
                                    }
                                    className="flex-1 text-left min-w-0"
                                  >
                                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                      {c && (
                                        <span
                                          className={`inline-flex h-4 min-w-4 px-1 items-center justify-center rounded text-[9px] font-bold ${URGENCY_COLORS[c.urgency]}`}
                                        >
                                          {c.urgency}
                                        </span>
                                      )}
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] px-1 py-0 h-4 ${
                                          item.taskType === "survey"
                                            ? "bg-amber-50 text-amber-700 border-amber-300"
                                            : "bg-emerald-50 text-emerald-700 border-emerald-300"
                                        }`}
                                      >
                                        {item.taskType === "survey" ? (
                                          <>
                                            <Search className="h-2.5 w-2.5 mr-0.5" />
                                            現調
                                          </>
                                        ) : (
                                          <>
                                            <Hammer className="h-2.5 w-2.5 mr-0.5" />
                                            工事
                                          </>
                                        )}
                                      </Badge>
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        {c?.requestNumber}
                                      </span>
                                    </div>
                                    <div className="text-sm font-semibold truncate">
                                      {c?.storeName ?? `案件 #${item.caseId}`}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {c?.address || "住所未登録"}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                      {assignee ? (
                                        <>
                                          <Avatar className="h-4 w-4">
                                            <AvatarFallback
                                              className="text-[8px] text-white"
                                              style={{ backgroundColor: colorFromName(assignee.name) }}
                                            >
                                              {initials(assignee.name)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="text-[10px] font-medium">{assignee.name}</span>
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground italic">担当未割り当て</span>
                                      )}
                                    </div>
                                  </button>
                                  {isAdmin && (
                                    <div className="flex items-center gap-1">
                                      <Select
                                        value={item.assigneeId ? String(item.assigneeId) : NULL_USER_VALUE}
                                        onValueChange={(v) =>
                                          upsert.mutate({
                                            id: item.id,
                                            caseId: item.caseId,
                                            team: item.team,
                                            taskType: item.taskType,
                                            scheduledDate: item.scheduledDate,
                                            sequence: item.sequence,
                                            notes: item.notes,
                                            assigneeId: v === NULL_USER_VALUE ? null : Number(v),
                                          })
                                        }
                                      >
                                        <SelectTrigger className="h-6 w-24 text-[10px] px-1">
                                          <SelectValue placeholder="担当" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value={NULL_USER_VALUE}>未割り当て</SelectItem>
                                          {(usersQ.data ?? []).map((u) => (
                                            <SelectItem key={u.id} value={String(u.id)}>
                                              {u.name ?? `ユーザー#${u.id}`}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Select
                                        value={item.team}
                                        onValueChange={(v) =>
                                          upsert.mutate({
                                            id: item.id,
                                            caseId: item.caseId,
                                            team: v as Team,
                                            taskType: item.taskType,
                                            scheduledDate: item.scheduledDate,
                                            sequence: item.sequence,
                                            notes: item.notes,
                                            assigneeId: item.assigneeId,
                                          })
                                        }
                                      >
                                        <SelectTrigger className="h-6 w-12 text-[10px] px-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="A">A</SelectItem>
                                          <SelectItem value="B">B</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="date"
                                        value={item.scheduledDate}
                                        onChange={(e) =>
                                          upsert.mutate({
                                            id: item.id,
                                            caseId: item.caseId,
                                            team: item.team,
                                            taskType: item.taskType,
                                            scheduledDate: e.target.value,
                                            sequence: item.sequence,
                                            notes: item.notes,
                                            assigneeId: item.assigneeId,
                                          })
                                        }
                                        className="h-6 text-[10px] w-32 px-1"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => remove.mutate({ id: item.id })}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamSuggestList({
  team,
  tasks,
}: {
  team: Team;
  tasks: Array<{
    caseId: number;
    requestNumber: string;
    storeName: string;
    taskType: TaskType;
    urgency: string;
    progressStage: string;
    staleDays: number;
    priorityScore: number;
    reason: string;
    scheduledDate: string;
    sequence: number;
  }>;
}) {
  const [, setLocation] = useLocation();
  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        team === "A" ? "border-blue-200" : "border-purple-200"
      }`}
    >
      <div
        className={`px-3 py-1.5 text-xs font-bold ${
          team === "A" ? "bg-blue-100 text-blue-900" : "bg-purple-100 text-purple-900"
        }`}
      >
        チーム{team}（{tasks.length}件）
      </div>
      <div className="divide-y">
        {tasks.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground italic">
            提案案件なし
          </div>
        ) : (
          tasks.map((t, i) => (
            <button
              key={`${t.caseId}-${i}`}
              onClick={() => setLocation(`/cases/${t.caseId}`)}
              className="w-full px-3 py-2 text-left hover:bg-muted/40 flex items-center gap-2"
            >
              <span className="text-xs font-mono text-muted-foreground w-5 text-center">
                {i + 1}
              </span>
              <span
                className={`inline-flex h-4 min-w-4 px-1 items-center justify-center rounded text-[9px] font-bold ${URGENCY_COLORS[t.urgency]}`}
              >
                {t.urgency}
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] px-1 py-0 h-4 ${
                  t.taskType === "survey"
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-emerald-50 text-emerald-700 border-emerald-300"
                }`}
              >
                {t.taskType === "survey" ? "現調" : "工事"}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.storeName}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t.reason} · 滞留{t.staleDays}日
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {t.scheduledDate.slice(5)}
              </span>
              <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function AddAssignmentInline() {
  const utils = trpc.useUtils();
  const cases = trpc.cases.list.useQuery();
  const [open, setOpen] = useState(false);
  const [caseId, setCaseId] = useState<string>("");
  const [team, setTeam] = useState<Team>("A");
  const [taskType, setTaskType] = useState<TaskType>("survey");
  const [date, setDate] = useState<string>(fmtYmd(addDays(new Date(), 1)));
  const upsert = trpc.routes.upsert.useMutation({
    onSuccess: () => {
      utils.routes.list.invalidate();
      toast.success("追加しました");
      setOpen(false);
      setCaseId("");
    },
    onError: (e) => toast.error(`追加失敗: ${e.message}`),
  });

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-7">
        <Plus className="h-3.5 w-3.5 mr-1" />
        追加
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Select value={caseId} onValueChange={setCaseId}>
        <SelectTrigger className="h-7 text-xs w-48">
          <SelectValue placeholder="案件を選択" />
        </SelectTrigger>
        <SelectContent>
          {(cases.data ?? []).map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.requestNumber} · {c.storeName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={team} onValueChange={(v) => setTeam(v as Team)}>
        <SelectTrigger className="h-7 text-xs w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="A">A</SelectItem>
          <SelectItem value="B">B</SelectItem>
        </SelectContent>
      </Select>
      <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
        <SelectTrigger className="h-7 text-xs w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="survey">現調</SelectItem>
          <SelectItem value="construction">工事</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-7 text-xs w-36"
      />
      <Button
        size="sm"
        className="h-7"
        disabled={!caseId || upsert.isPending}
        onClick={() =>
          upsert.mutate({
            caseId: Number(caseId),
            team,
            taskType,
            scheduledDate: date,
            sequence: 0,
          })
        }
      >
        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
        確定
      </Button>
      <Button size="sm" variant="ghost" className="h-7" onClick={() => setOpen(false)}>
        ×
      </Button>
    </div>
  );
}


function TeamSettingsDialog() {
  const utils = trpc.useUtils();
  const settingsQ = trpc.teamSettings.list.useQuery();
  const usersQ = trpc.users.list.useQuery();
  const upsert = trpc.teamSettings.upsert.useMutation({
    onSuccess: () => {
      utils.teamSettings.list.invalidate();
    },
    onError: (e) => toast.error(`保存失敗: ${e.message}`),
  });
  const [open, setOpen] = useState(false);
  const [aUser, setAUser] = useState<string>(NULL_USER_VALUE);
  const [bUser, setBUser] = useState<string>(NULL_USER_VALUE);
  const [aLabel, setALabel] = useState<string>("");
  const [bLabel, setBLabel] = useState<string>("");

  // ダイアログを開いた瞬間に現状値で初期化
  function handleOpen(v: boolean) {
    if (v) {
      const a = settingsQ.data?.A;
      const b = settingsQ.data?.B;
      setAUser(a?.primaryUserId ? String(a.primaryUserId) : NULL_USER_VALUE);
      setBUser(b?.primaryUserId ? String(b.primaryUserId) : NULL_USER_VALUE);
      setALabel(a?.label ?? "");
      setBLabel(b?.label ?? "");
    }
    setOpen(v);
  }

  async function handleSave() {
    await upsert.mutateAsync({
      team: "A",
      primaryUserId: aUser === NULL_USER_VALUE ? null : Number(aUser),
      label: aLabel || null,
    });
    await upsert.mutateAsync({
      team: "B",
      primaryUserId: bUser === NULL_USER_VALUE ? null : Number(bUser),
      label: bLabel || null,
    });
    toast.success("チーム担当者を保存しました");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserCog className="h-3.5 w-3.5 mr-1" />
          チーム担当者
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            チーム担当者を割り当て
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {(["A", "B"] as const).map((team) => {
            const value = team === "A" ? aUser : bUser;
            const setValue = team === "A" ? setAUser : setBUser;
            const label = team === "A" ? aLabel : bLabel;
            const setLabel = team === "A" ? setALabel : setBLabel;
            return (
              <div
                key={team}
                className={`p-3 rounded-lg border ${
                  team === "A" ? "bg-blue-50/40 border-blue-200" : "bg-purple-50/40 border-purple-200"
                }`}
              >
                <div className="text-sm font-semibold mb-2">チーム{team}</div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">代表担当者</Label>
                    <Select value={value} onValueChange={setValue}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="ユーザーを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NULL_USER_VALUE}>未設定</SelectItem>
                        {(usersQ.data ?? []).map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.name ?? `ユーザー#${u.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">チーム名（任意）</Label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="例：東京エリア担当"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
