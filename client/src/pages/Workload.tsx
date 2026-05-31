import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  Users,
  AlertTriangle,
  Navigation,
  Hammer,
  MapPin,
  CalendarDays,
} from "lucide-react";

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

function fmtYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

type Preset = "this-week" | "next-week" | "next-2w" | "this-month";

function presetRange(p: Preset): { start: string; end: string; label: string } {
  const now = new Date();
  const dow = now.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(now, monOffset);
  if (p === "this-week") {
    return {
      start: fmtYmd(monday),
      end: fmtYmd(addDays(monday, 6)),
      label: "今週",
    };
  }
  if (p === "next-week") {
    const nextMon = addDays(monday, 7);
    return {
      start: fmtYmd(nextMon),
      end: fmtYmd(addDays(nextMon, 6)),
      label: "来週",
    };
  }
  if (p === "next-2w") {
    return {
      start: fmtYmd(now),
      end: fmtYmd(addDays(now, 14)),
      label: "14日先まで",
    };
  }
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: fmtYmd(first), end: fmtYmd(last), label: "今月" };
}

export default function Workload() {
  const [preset, setPreset] = useState<Preset>("next-2w");
  const range = useMemo(() => presetRange(preset), [preset]);
  const wlQ = trpc.workload.list.useQuery({
    start: range.start,
    end: range.end,
  });

  const rows = wlQ.data?.rows ?? [];
  const maxTasks = Math.max(1, ...rows.map((r) => r.totalTasks));
  const maxKm = Math.max(1, ...rows.map((r) => r.totalKm));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif-jp text-2xl font-semibold">担当者ワークロード</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {range.start} 〜 {range.end}（{range.label}）の対応件数・移動距離を可視化し、配分の偏りを把握。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(["this-week", "next-week", "next-2w", "this-month"] as Preset[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={preset === p ? "default" : "outline"}
                onClick={() => setPreset(p)}
              >
                {p === "this-week"
                  ? "今週"
                  : p === "next-week"
                  ? "来週"
                  : p === "next-2w"
                  ? "14日先"
                  : "今月"}
              </Button>
            ))}
          </div>
        </div>

        {/* KPIカード */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                <Users className="h-3.5 w-3.5" />
                稼働メンバー
              </div>
              <div className="text-2xl font-semibold">
                {rows.filter((r) => r.userId != null).length}
                <span className="text-sm text-muted-foreground ml-1">名</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                <Hammer className="h-3.5 w-3.5" />
                総タスク
              </div>
              <div className="text-2xl font-semibold">
                {wlQ.data?.totalAssigned ?? 0}
                <span className="text-sm text-muted-foreground ml-1">件</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                <Navigation className="h-3.5 w-3.5" />
                総移動距離
              </div>
              <div className="text-2xl font-semibold">
                {rows.reduce((s, r) => s + r.totalKm, 0).toFixed(1)}
                <span className="text-sm text-muted-foreground ml-1">km</span>
              </div>
            </CardContent>
          </Card>
          <Card
            className={
              wlQ.data?.imbalanced ? "border-amber-300 bg-amber-50/40" : ""
            }
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                配分バランス
              </div>
              <div className="text-2xl font-semibold flex items-center gap-2">
                {wlQ.data?.imbalanced ? (
                  <Badge className="bg-amber-500 text-white">偏りあり</Badge>
                ) : (
                  <Badge className="bg-emerald-500 text-white">均衡</Badge>
                )}
                {(wlQ.data?.unassignedCount ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    未割当 {wlQ.data?.unassignedCount}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* タスク数バーチャート */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Hammer className="h-4 w-4" />
              担当者別 タスク件数
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wlQ.isLoading ? (
              <div className="text-sm text-muted-foreground py-6 text-center">読み込み中...</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                期間内のタスクはまだありません
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => {
                  const pct = (r.totalTasks / maxTasks) * 100;
                  const surveyPct = r.totalTasks
                    ? (r.surveyTasks / r.totalTasks) * pct
                    : 0;
                  const constructionPct = r.totalTasks
                    ? (r.constructionTasks / r.totalTasks) * pct
                    : 0;
                  return (
                    <div key={r.userId ?? "none"} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-40 shrink-0">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback
                            className="text-[10px] text-white"
                            style={{
                              backgroundColor: r.userId
                                ? colorFromName(r.userName)
                                : "#9ca3af",
                            }}
                          >
                            {initials(r.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">{r.userName}</span>
                      </div>
                      <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-blue-400/80 transition-all"
                          style={{ width: `${surveyPct}%` }}
                          title={`現調 ${r.surveyTasks}件`}
                        />
                        <div
                          className="absolute inset-y-0 bg-orange-400/80 transition-all"
                          style={{
                            left: `${surveyPct}%`,
                            width: `${constructionPct}%`,
                          }}
                          title={`工事 ${r.constructionTasks}件`}
                        />
                      </div>
                      <div className="w-24 text-right text-sm tabular-nums shrink-0">
                        <span className="font-semibold">{r.totalTasks}</span>
                        <span className="text-xs text-muted-foreground ml-1">件</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t mt-2">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded bg-blue-400/80" />
                    現調
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded bg-orange-400/80" />
                    工事
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 移動距離バーチャート */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              担当者別 総移動距離
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                データがありません
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => {
                  const pct = (r.totalKm / maxKm) * 100;
                  return (
                    <div key={r.userId ?? "none"} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-40 shrink-0">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback
                            className="text-[10px] text-white"
                            style={{
                              backgroundColor: r.userId
                                ? colorFromName(r.userName)
                                : "#9ca3af",
                            }}
                          >
                            {initials(r.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">{r.userName}</span>
                      </div>
                      <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-emerald-500/80 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-24 text-right text-sm tabular-nums shrink-0">
                        <span className="font-semibold">{r.totalKm.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground ml-1">km</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 詳細テーブル */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">詳細</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>担当者</TableHead>
                  <TableHead className="text-right">合計</TableHead>
                  <TableHead className="text-right">現調</TableHead>
                  <TableHead className="text-right">工事</TableHead>
                  <TableHead className="text-right">チームA</TableHead>
                  <TableHead className="text-right">チームB</TableHead>
                  <TableHead className="text-right">稼働日</TableHead>
                  <TableHead className="text-right">距離</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.userId ?? "none"}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback
                            className="text-[9px] text-white"
                            style={{
                              backgroundColor: r.userId
                                ? colorFromName(r.userName)
                                : "#9ca3af",
                            }}
                          >
                            {initials(r.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{r.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{r.totalTasks}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3 text-blue-500" />
                        {r.surveyTasks}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Hammer className="h-3 w-3 text-orange-500" />
                        {r.constructionTasks}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-blue-700">{r.teamA}</TableCell>
                    <TableCell className="text-right tabular-nums text-purple-700">{r.teamB}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <CalendarDays className="h-3 w-3" />
                        {r.activeDays}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.totalKm.toFixed(1)} km</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                      期間内のタスクはまだありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
