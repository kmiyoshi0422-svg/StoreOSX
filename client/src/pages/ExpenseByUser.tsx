import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Wallet, Users, Loader2, FolderKanban, Building2, Download, Filter, X } from "lucide-react";
import type { UserExpenseAggregate } from "../../../shared/expense-aggregate";

type Period = "thisMonth" | "lastMonth" | "all" | "custom";

function ExportCsvButton({ range }: { range: { fromMs?: number; toMs?: number } }) {
  const { data: expenses, isLoading } = trpc.expenses.exportAll.useQuery(range);
  const handleExport = () => {
    if (!expenses || expenses.length === 0) return;
    const BOM = "\uFEFF";
    const headers = ["ID", "日付", "業者名", "区分", "金額(税込)", "消費税", "摘要", "スコープ", "案件ID", "入力者", "入力日時", "更新者", "更新日時"];
    const rows = expenses.map((e: any) => [
      e.id,
      e.expenseDate ? new Date(e.expenseDate).toLocaleDateString("ja-JP") : "",
      e.vendorName ?? "",
      e.category ?? "",
      e.amount ?? 0,
      e.taxAmount ?? "",
      (e.note ?? "").replace(/[\r\n]+/g, " "),
      e.scope ?? "",
      e.caseId ?? "",
      e.createdByName ?? "",
      e.createdAt ? new Date(e.createdAt).toLocaleString("ja-JP") : "",
      e.updatedByName ?? "",
      e.updatedAt ? new Date(e.updatedAt).toLocaleString("ja-JP") : "",
    ]);
    const csv = BOM + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `経費データ_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button size="sm" variant="outline" onClick={handleExport} disabled={isLoading || !expenses?.length}>
      <Download className="h-3.5 w-3.5 mr-1" />
      CSVエクスポート
    </Button>
  );
}

function periodRange(p: Period, customFrom?: string, customTo?: string): { fromMs?: number; toMs?: number } {
  if (p === "all") return {};
  if (p === "custom") {
    const fromMs = customFrom ? new Date(customFrom + "T00:00:00").getTime() : undefined;
    const toMs = customTo ? new Date(customTo + "T23:59:59.999").getTime() : undefined;
    return { fromMs, toMs };
  }
  const now = new Date();
  if (p === "thisMonth") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { fromMs: from.getTime(), toMs: to.getTime() };
  }
  // lastMonth
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { fromMs: from.getTime(), toMs: to.getTime() };
}

function yen(n: number) {
  return "¥" + (n ?? 0).toLocaleString("ja-JP");
}

const PERIOD_LABELS: Record<Period, string> = {
  thisMonth: "今月",
  lastMonth: "先月",
  all: "全期間",
  custom: "カスタム",
};

const ALL_CATEGORIES = ["材料費", "外注費", "交通費", "消耗品", "車両費", "宿泊費", "接待交際費", "人件費", "現調費", "その他"];

export default function ExpenseByUser() {
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all"); // "all" or userId string
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const { data, isLoading } = trpc.expenses.byUser.useQuery(range);

  const byUser = data?.byUser ?? [];
  const categories = data?.categories ?? [];
  const grandTotal = data?.grandTotal ?? 0;
  const totalCount = data?.count ?? 0;

  // フィルター適用後のデータ
  const filteredByUser = useMemo(() => {
    let result = byUser;
    if (filterUser !== "all") {
      result = result.filter((u: UserExpenseAggregate) => String(u.userId) === filterUser);
    }
    return result;
  }, [byUser, filterUser]);

  const filteredGrandTotal = filteredByUser.reduce((s: number, u: UserExpenseAggregate) => {
    if (filterCategory === "all") return s + u.total;
    return s + (u.byCategory[filterCategory] ?? 0);
  }, 0);

  const filteredCount = filteredByUser.reduce((s: number, u: UserExpenseAggregate) => s + u.count, 0);

  const hasActiveFilters = filterUser !== "all" || filterCategory !== "all" || period === "custom";

  const clearFilters = () => {
    setFilterUser("all");
    setFilterCategory("all");
    setPeriod("thisMonth");
    setCustomFrom("");
    setCustomTo("");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Expense by Payer"
        title="立替者別経費"
        icon={<Wallet className="h-7 w-7 text-primary" />}
        description="経費を立替えた担当者ごとに、使用額・件数・案件/全体の内訳・区分別の内訳を集計します。"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              フィルター
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">ON</Badge>
              )}
            </Button>
            <ExportCsvButton range={range} />
          </div>
        }
      />

      {/* フィルターパネル */}
      {showFilters && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-primary" />
                絞り込み条件
              </h3>
              {hasActiveFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters} className="text-xs h-7">
                  <X className="h-3 w-3 mr-1" />
                  クリア
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 期間フィルター */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">期間</Label>
                <div className="inline-flex rounded-md border p-0.5 bg-muted/40 w-full">
                  {(["thisMonth", "lastMonth", "all", "custom"] as Period[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                        period === p
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>
                {period === "custom" && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="text-xs h-8"
                      placeholder="開始日"
                    />
                    <span className="text-muted-foreground self-center text-xs">〜</span>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="text-xs h-8"
                      placeholder="終了日"
                    />
                  </div>
                )}
              </div>

              {/* 入力者フィルター */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">入力者（立替者）</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background h-9"
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                >
                  <option value="all">全員</option>
                  {byUser.map((u: UserExpenseAggregate) => (
                    <option key={u.userId ?? "null"} value={String(u.userId)}>
                      {u.userName}（{u.count}件）
                    </option>
                  ))}
                </select>
              </div>

              {/* 区分フィルター */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">区分</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background h-9"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">全区分</option>
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> 読み込み中…
        </div>
      ) : byUser.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center flex flex-col items-center gap-3">
            <Users className="h-10 w-10 opacity-60 text-muted-foreground" />
            <div className="font-medium">この期間の経費がありません</div>
            <div className="text-sm text-muted-foreground">
              期間を変更するか、経費取込から登録してください。
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  {hasActiveFilters ? "フィルター適用後" : `合計経費・${PERIOD_LABELS[period]}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{yen(filteredGrandTotal)}</div>
                {hasActiveFilters && filteredGrandTotal !== grandTotal && (
                  <div className="text-xs text-muted-foreground mt-1">全体: {yen(grandTotal)}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  件数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{filteredCount}件</div>
                {hasActiveFilters && filteredCount !== totalCount && (
                  <div className="text-xs text-muted-foreground mt-1">全体: {totalCount}件</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  立替人数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{filteredByUser.length}名</div>
              </CardContent>
            </Card>
          </div>

          {/* 立替者別カード */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredByUser.map((u: UserExpenseAggregate) => {
              const pct = grandTotal > 0 ? Math.round((u.total / grandTotal) * 100) : 0;
              return (
                <Card key={u.userId ?? "unknown"} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                          {(u.userName || "?").slice(0, 1)}
                        </span>
                        {u.userName}
                      </CardTitle>
                      <Badge variant="outline">{pct}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-end justify-between">
                      <div className="text-2xl font-bold font-mono">{yen(u.total)}</div>
                      <div className="text-sm text-muted-foreground">{u.count}件</div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <div className="flex-1 rounded-md border bg-muted/30 p-2">
                        <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                          <FolderKanban className="h-3.5 w-3.5" /> 案件
                        </div>
                        <div className="font-mono font-semibold">{yen(u.caseTotal)}</div>
                      </div>
                      <div className="flex-1 rounded-md border bg-muted/30 p-2">
                        <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                          <Building2 className="h-3.5 w-3.5" /> 全体
                        </div>
                        <div className="font-mono font-semibold">{yen(u.generalTotal)}</div>
                      </div>
                    </div>
                    {/* 区分別内訳（0以外のみ） */}
                    <div className="flex flex-wrap gap-1.5">
                      {categories
                        .filter((c: string) => {
                          if (filterCategory !== "all") return c === filterCategory;
                          return (u.byCategory[c] ?? 0) > 0;
                        })
                        .map((c: string) => (
                          <Badge
                            key={c}
                            variant={filterCategory === c ? "default" : "secondary"}
                            className="font-normal"
                          >
                            {c} {yen(u.byCategory[c] ?? 0)}
                          </Badge>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 区分別マトリクス表 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">立替者 × 区分 明細</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">立替者</TableHead>
                    {(filterCategory === "all" ? categories : [filterCategory]).map((c: string) => (
                      <TableHead key={c} className="text-right whitespace-nowrap">
                        {c}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-semibold whitespace-nowrap">合計</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredByUser.map((u: UserExpenseAggregate) => (
                    <TableRow key={u.userId ?? "unknown"}>
                      <TableCell className="font-medium sticky left-0 bg-card whitespace-nowrap">
                        {u.userName}
                      </TableCell>
                      {(filterCategory === "all" ? categories : [filterCategory]).map((c: string) => (
                        <TableCell key={c} className="text-right font-mono text-muted-foreground">
                          {(u.byCategory[c] ?? 0) > 0 ? yen(u.byCategory[c] ?? 0) : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono font-semibold">
                        {filterCategory === "all" ? yen(u.total) : yen(u.byCategory[filterCategory] ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
