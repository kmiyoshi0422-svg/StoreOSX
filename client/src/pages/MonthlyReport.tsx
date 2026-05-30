import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BarChart3, Download, Loader2, TrendingUp, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";

const yen = (n: number) => `¥${n.toLocaleString()}`;

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v ?? "");
          return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
  // Excel互換のためBOM付きUTF-8
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MonthlyReport() {
  const { data, isLoading } = trpc.cases.monthlyReport.useQuery();

  const exportMonthlyCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["年月", "案件数", "完了数", "見積合計", "実績合計", "差分"],
      ...data.monthly.map((m) => [
        m.yearMonth,
        m.count,
        m.completed,
        m.estimated,
        m.actual,
        m.actual - m.estimated,
      ]),
    ];
    downloadCsv(`月次レポート_${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("月次レポートCSVをダウンロードしました");
  };

  const exportStoreCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["店舗名", "案件数", "完了数", "見積合計", "実績合計", "差分"],
      ...data.byStore.map((s) => [
        s.storeName,
        s.count,
        s.completed,
        s.estimated,
        s.actual,
        s.actual - s.estimated,
      ]),
    ];
    downloadCsv(`店舗別レポート_${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("店舗別レポートCSVをダウンロードしました");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const monthly = data?.monthly ?? [];
  const byStore = data?.byStore ?? [];

  // 累計
  const totalCount = monthly.reduce((s, m) => s + m.count, 0);
  const totalCompleted = monthly.reduce((s, m) => s + m.completed, 0);
  const totalEstimated = monthly.reduce((s, m) => s + m.estimated, 0);
  const totalActual = monthly.reduce((s, m) => s + m.actual, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            月次レポート
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            完了月・施工月・現調月を基準に月別／店舗別に集計します
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">累計案件数</p>
            <p className="text-2xl font-serif mt-1">{totalCount.toLocaleString()}<span className="text-sm ml-1">件</span></p>
            <p className="text-xs text-muted-foreground mt-1">完了 {totalCompleted} 件</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">見積合計</p>
            <p className="text-2xl font-serif mt-1">{yen(totalEstimated)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">実績合計</p>
            <p className="text-2xl font-serif mt-1">{yen(totalActual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">差分（実績 - 見積）</p>
            <p className={`text-2xl font-serif mt-1 ${totalActual - totalEstimated > 0 ? "text-destructive" : "text-emerald-700"}`}>
              {yen(totalActual - totalEstimated)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">
            <TrendingUp className="h-4 w-4 mr-1.5" />月別
          </TabsTrigger>
          <TabsTrigger value="store">
            <StoreIcon className="h-4 w-4 mr-1.5" />店舗別
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">月別集計</CardTitle>
              <Button size="sm" variant="outline" className="bg-background" onClick={exportMonthlyCsv} disabled={monthly.length === 0}>
                <Download className="h-4 w-4" />CSV
              </Button>
            </CardHeader>
            <CardContent>
              {monthly.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">データがありません</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">年月</th>
                        <th className="text-right py-2 px-2">案件数</th>
                        <th className="text-right py-2 px-2">完了数</th>
                        <th className="text-right py-2 px-2">見積合計</th>
                        <th className="text-right py-2 px-2">実績合計</th>
                        <th className="text-right py-2 px-2">差分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map((m) => {
                        const diff = m.actual - m.estimated;
                        return (
                          <tr key={m.yearMonth} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 px-2 font-medium">{m.yearMonth}</td>
                            <td className="py-2 px-2 text-right">{m.count}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{m.completed}</td>
                            <td className="py-2 px-2 text-right">{yen(m.estimated)}</td>
                            <td className="py-2 px-2 text-right">{yen(m.actual)}</td>
                            <td className={`py-2 px-2 text-right ${diff > 0 ? "text-destructive" : "text-emerald-700"}`}>
                              {yen(diff)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="store" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">店舗別集計（実績の多い順）</CardTitle>
              <Button size="sm" variant="outline" className="bg-background" onClick={exportStoreCsv} disabled={byStore.length === 0}>
                <Download className="h-4 w-4" />CSV
              </Button>
            </CardHeader>
            <CardContent>
              {byStore.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">データがありません</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">店舗名</th>
                        <th className="text-right py-2 px-2">案件数</th>
                        <th className="text-right py-2 px-2">完了数</th>
                        <th className="text-right py-2 px-2">見積合計</th>
                        <th className="text-right py-2 px-2">実績合計</th>
                        <th className="text-right py-2 px-2">差分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byStore.map((s) => {
                        const diff = s.actual - s.estimated;
                        return (
                          <tr key={s.storeName} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 px-2 font-medium">{s.storeName}</td>
                            <td className="py-2 px-2 text-right">{s.count}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{s.completed}</td>
                            <td className="py-2 px-2 text-right">{yen(s.estimated)}</td>
                            <td className="py-2 px-2 text-right">{yen(s.actual)}</td>
                            <td className={`py-2 px-2 text-right ${diff > 0 ? "text-destructive" : "text-emerald-700"}`}>
                              {yen(diff)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
