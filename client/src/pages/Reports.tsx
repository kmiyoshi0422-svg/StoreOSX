import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  TrendingUp,
  Calendar,
  Users,
  Loader2,
  BarChart3,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

const yen = (n: number | null | undefined) =>
  n != null ? `¥${Math.round(n).toLocaleString()}` : "—";

export default function Reports() {
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const monthly = trpc.reports.monthly.useQuery({ months });
  const byAssignee = trpc.reports.byAssignee.useQuery();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <TrendingUp className="h-6 w-6" /> 実績レポート
        </h1>
        <p className="text-sm text-muted-foreground">
          月別の売上・原価・粗利と、担当者別の成績を可視化します。売上は見積金額×75%、原価は登録された経費合計です。
        </p>
      </div>

      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly">
            <Calendar className="h-3.5 w-3.5" />
            月別実績
          </TabsTrigger>
          <TabsTrigger value="assignee">
            <Users className="h-3.5 w-3.5" />
            担当者別成績
          </TabsTrigger>
        </TabsList>

        {/* ============ 月別 ============ */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">期間:</span>
            {([3, 6, 12] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={months === m ? "default" : "outline"}
                onClick={() => setMonths(m)}
              >
                {m}ヶ月
              </Button>
            ))}
          </div>

          {monthly.isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 mx-auto animate-spin" />
              </CardContent>
            </Card>
          ) : !monthly.data ? null : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  label="売上合計"
                  value={yen(monthly.data.totals.revenue)}
                  hue="blue"
                />
                <KpiCard
                  label="原価合計"
                  value={yen(monthly.data.totals.cost)}
                  hue="amber"
                />
                <KpiCard
                  label="粗利合計"
                  value={yen(monthly.data.totals.profit)}
                  hue={monthly.data.totals.profit >= 0 ? "violet" : "red"}
                />
                <KpiCard
                  label="件数（完了）"
                  value={`${monthly.data.totals.caseCount}件 (${monthly.data.totals.completedCount})`}
                  hue="emerald"
                />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> 月別 売上・原価
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={monthly.data.rows.map((r) => ({
                          key: r.key,
                          売上: r.revenue,
                          原価: r.cost,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="key" tick={{ fontSize: 12 }} />
                        <YAxis
                          tickFormatter={(v) =>
                            v >= 10000 ? `${Math.round(v / 10000)}万` : v
                          }
                          tick={{ fontSize: 12 }}
                        />
                        <RTooltip
                          formatter={(v: any) => `¥${Number(v).toLocaleString()}`}
                        />
                        <Legend />
                        <Bar dataKey="売上" fill="#3b82f6" />
                        <Bar dataKey="原価" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> 月別 粗利推移
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={monthly.data.rows.map((r) => ({
                          key: r.key,
                          粗利: r.profit,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="key" tick={{ fontSize: 12 }} />
                        <YAxis
                          tickFormatter={(v) =>
                            v >= 10000 ? `${Math.round(v / 10000)}万` : v
                          }
                          tick={{ fontSize: 12 }}
                        />
                        <RTooltip
                          formatter={(v: any) => `¥${Number(v).toLocaleString()}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="粗利"
                          stroke="#7c3aed"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">月別明細</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">月</th>
                          <th className="text-right px-3 py-2 font-medium">件数</th>
                          <th className="text-right px-3 py-2 font-medium">完了</th>
                          <th className="text-right px-3 py-2 font-medium">売上</th>
                          <th className="text-right px-3 py-2 font-medium">原価</th>
                          <th className="text-right px-3 py-2 font-medium">粗利</th>
                          <th className="text-right px-3 py-2 font-medium">粗利率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthly.data.rows.map((r) => (
                          <tr key={r.key} className="border-t">
                            <td className="px-3 py-2 font-medium">{r.key}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {r.caseCount}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {r.completedCount}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {yen(r.revenue)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {yen(r.cost)}
                            </td>
                            <td
                              className={`px-3 py-2 text-right tabular-nums font-medium ${
                                r.profit >= 0 ? "text-violet-700" : "text-red-700"
                              }`}
                            >
                              {yen(r.profit)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {r.margin.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ============ 担当者別 ============ */}
        <TabsContent value="assignee" className="space-y-4">
          {byAssignee.isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 mx-auto animate-spin" />
              </CardContent>
            </Card>
          ) : !byAssignee.data?.rows.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                担当者が割り当てられた案件がまだありません。
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> 担当者別 売上・粗利
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={byAssignee.data.rows.map((r) => ({
                          name: r.name,
                          売上: r.revenue,
                          粗利: r.profit,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis
                          tickFormatter={(v) =>
                            v >= 10000 ? `${Math.round(v / 10000)}万` : v
                          }
                          tick={{ fontSize: 12 }}
                        />
                        <RTooltip
                          formatter={(v: any) => `¥${Number(v).toLocaleString()}`}
                        />
                        <Legend />
                        <Bar dataKey="売上" fill="#3b82f6" />
                        <Bar dataKey="粗利" fill="#7c3aed" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">担当者別明細</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">担当者</th>
                          <th className="text-right px-3 py-2 font-medium">件数</th>
                          <th className="text-right px-3 py-2 font-medium">完了</th>
                          <th className="text-right px-3 py-2 font-medium">売上</th>
                          <th className="text-right px-3 py-2 font-medium">原価</th>
                          <th className="text-right px-3 py-2 font-medium">粗利</th>
                          <th className="text-right px-3 py-2 font-medium">粗利率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byAssignee.data.rows.map((r) => (
                          <tr key={r.userId} className="border-t">
                            <td className="px-3 py-2">
                              <div className="font-medium">{r.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {r.email}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {r.caseCount}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {r.completedCount}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {yen(r.revenue)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {yen(r.cost)}
                            </td>
                            <td
                              className={`px-3 py-2 text-right tabular-nums font-medium ${
                                r.profit >= 0 ? "text-violet-700" : "text-red-700"
                              }`}
                            >
                              {yen(r.profit)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <Badge variant="outline">{r.margin.toFixed(1)}%</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hue,
}: {
  label: string;
  value: string;
  hue: "blue" | "amber" | "violet" | "red" | "emerald";
}) {
  const palette: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    red: "bg-red-50 border-red-200 text-red-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };
  return (
    <div className={`rounded-md border p-3 ${palette[hue]}`}>
      <div className="text-xs mb-1">{label}</div>
      <div className="text-xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
    </div>
  );
}
