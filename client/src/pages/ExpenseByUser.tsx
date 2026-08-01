import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Wallet, Users, Loader2, FolderKanban, Building2, Download } from "lucide-react";
import type { UserExpenseAggregate } from "../../../shared/expense-aggregate";

type Period = "thisMonth" | "lastMonth" | "all";

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

function periodRange(p: Period): { fromMs?: number; toMs?: number } {
  if (p === "all") return {};
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
};

export default function ExpenseByUser() {
  const [period, setPeriod] = useState<Period>("thisMonth");
  const range = useMemo(() => periodRange(period), [period]);
  const { data, isLoading } = trpc.expenses.byUser.useQuery(range);

  const byUser = data?.byUser ?? [];
  const categories = data?.categories ?? [];
  const grandTotal = data?.grandTotal ?? 0;
  const totalCount = data?.count ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Expense by Payer"
        title="立替者別経費"
        icon={<Wallet className="h-7 w-7 text-primary" />}
        description="経費を立替えた担当者ごとに、使用額・件数・案件/全体の内訳・区分別の内訳を集計します。"
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
              {(["thisMonth", "lastMonth", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    period === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <ExportCsvButton range={range} />
          </div>
        }
      />

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
                  合計経費・{PERIOD_LABELS[period]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{yen(grandTotal)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  件数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{totalCount}件</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  立替人数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{byUser.length}名</div>
              </CardContent>
            </Card>
          </div>

          {/* 立替者別カード */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {byUser.map((u: UserExpenseAggregate) => {
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
                        .filter((c: string) => (u.byCategory[c] ?? 0) > 0)
                        .map((c: string) => (
                          <Badge key={c} variant="secondary" className="font-normal">
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
                    {categories.map((c: string) => (
                      <TableHead key={c} className="text-right whitespace-nowrap">
                        {c}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-semibold whitespace-nowrap">合計</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byUser.map((u: UserExpenseAggregate) => (
                    <TableRow key={u.userId ?? "unknown"}>
                      <TableCell className="font-medium sticky left-0 bg-card whitespace-nowrap">
                        {u.userName}
                      </TableCell>
                      {categories.map((c: string) => (
                        <TableCell key={c} className="text-right font-mono text-muted-foreground">
                          {(u.byCategory[c] ?? 0) > 0 ? yen(u.byCategory[c] ?? 0) : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono font-semibold">
                        {yen(u.total)}
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
