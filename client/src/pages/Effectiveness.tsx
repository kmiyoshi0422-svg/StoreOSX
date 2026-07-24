import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  BarChart3,
  Target,
  Zap,
  Award,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Activity,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts";

// ─── KPI Card ────────────────────────────────────────────
function KpiCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendLabel,
  color = "blue",
}: {
  title: string;
  value: string | number;
  unit?: string;
  icon: any;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color?: "blue" | "green" | "amber" | "red" | "purple" | "emerald";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    red: "bg-red-50 text-red-600 border-red-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
  };
  const iconBg = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
    red: "bg-red-100 text-red-600",
    purple: "bg-purple-100 text-purple-600",
    emerald: "bg-emerald-100 text-emerald-600",
  };

  return (
    <Card className={`border ${colorMap[color]} transition-all hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{value}</span>
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
            {trendLabel && (
              <div className="flex items-center gap-1 mt-1">
                {trend === "up" && <ArrowUpRight className="h-3 w-3 text-green-600" />}
                {trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-600" />}
                <span className={`text-[10px] ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"}`}>
                  {trendLabel}
                </span>
              </div>
            )}
          </div>
          <div className={`p-2 rounded-lg ${iconBg[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section Header ──────────────────────────────────────
function SectionHeader({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function Effectiveness() {
  const [months, setMonths] = useState(12);
  const { data, isLoading } = trpc.reports.effectiveness.useQuery({ months });


  // Radar chart data for overall score
  const radarData = useMemo(() => {
    if (!data) return [];
    return [
      { subject: "処理速度", value: Math.min(100, data.summary.avgProcessingDays > 0 ? Math.round(100 - data.summary.avgProcessingDays * 2) : 80), fullMark: 100 },
      { subject: "コスト精度", value: Math.min(100, Math.max(0, data.costOptimization.filter(c => c.count > 0).reduce((s, c) => s + c.accuracyRate, 0) / Math.max(1, data.costOptimization.filter(c => c.count > 0).length))), fullMark: 100 },
      { subject: "稼働バランス", value: data.summary.balanceScore, fullMark: 100 },
      { subject: "デジタル化", value: data.summary.digitalRate, fullMark: 100 },
      { subject: "協力会社活用", value: Math.min(100, data.summary.activePartners * 10), fullMark: 100 },
      { subject: "完了率", value: data.summary.totalCases > 0 ? Math.round(data.summary.completedCases / data.summary.totalCases * 100) : 0, fullMark: 100 },
    ];
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-muted rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, processingSpeed, costOptimization, workload, digitalization, partnerPerformance } = data;

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            効果測定ダッシュボード
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Store OSX 導入効果の可視化 — プレナス施設管理業務のDX推進状況
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">期間:</span>
          <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">直近3ヶ月</SelectItem>
              <SelectItem value="6">直近6ヶ月</SelectItem>
              <SelectItem value="12">直近12ヶ月</SelectItem>
              <SelectItem value="24">直近24ヶ月</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Executive Summary - ROI */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
導入効果サマリー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard
              title="累計案件数"
              value={summary.totalCases}
              unit="件"
              icon={BarChart3}
              color="blue"
              trend="up"
              trendLabel={`完了 ${summary.completedCases}件`}
            />
            <KpiCard
              title="平均処理日数"
              value={summary.avgProcessingDays}
              unit="日"
              icon={Clock}
              color="green"
              trend="down"
              trendLabel="短縮傾向"
            />
            <KpiCard
              title="デジタル化率"
              value={summary.digitalRate}
              unit="%"
              icon={TrendingUp}
              color="amber"
            />
            <KpiCard
              title="完了率"
              value={summary.totalCases > 0 ? Math.round(summary.completedCases / summary.totalCases * 100) : 0}
              unit="%"
              icon={CheckCircle2}
              color="emerald"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="デジタル化率"
              value={summary.digitalRate}
              unit="%"
              icon={TrendingUp}
              color="amber"
            />
            <KpiCard
              title="稼働バランス"
              value={summary.balanceScore}
              unit="点"
              icon={Users}
              color="blue"
              trendLabel="100点が理想"
            />
            <KpiCard
              title="協力会社数"
              value={summary.activePartners}
              unit="社"
              icon={Building2}
              color="green"
              trendLabel={`登録 ${summary.partnerCount}社`}
            />
            <KpiCard
              title="完了率"
              value={summary.totalCases > 0 ? Math.round(summary.completedCases / summary.totalCases * 100) : 0}
              unit="%"
              icon={CheckCircle2}
              color="emerald"
            />
          </div>
        </CardContent>
      </Card>

      {/* Overall Score Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">総合スコア</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name="スコア" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-center text-muted-foreground mt-2">
              各指標を100点満点で評価。バランスの取れた運営を目指す。
            </p>
          </CardContent>
        </Card>

        {/* Processing Speed Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <SectionHeader
              icon={Clock}
              title="案件処理速度"
              description="受付から完了までの平均日数推移 — 短いほど効率的"
            />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={processingSpeed.filter(s => s.count > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="key" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="日" />
                <Tooltip
                  formatter={(value: number) => [`${value}日`, "平均処理日数"]}
                  labelFormatter={(label) => `${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="avgDays"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.2}
                  name="平均日数"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-green-600" />
                日数が減少 = 業務効率化が進行中
              </span>
              <span>
                完了案件: {processingSpeed.reduce((s, p) => s + p.count, 0)}件
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Optimization */}
      <Card>
        <CardHeader className="pb-2">
          <SectionHeader
            icon={Target}
            title="コスト最適化 — 見積精度の向上"
            description="見積と実績の乖離率。100%に近いほど精度が高い"
          />
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={costOptimization.filter(c => c.count > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "accuracyRate") return [`${value}%`, "見積精度"];
                  return [value, name];
                }}
              />
              <Bar dataKey="accuracyRate" name="見積精度" radius={[4, 4, 0, 0]}>
                {costOptimization.filter(c => c.count > 0).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.accuracyRate >= 80 ? "#10b981" : entry.accuracyRate >= 60 ? "#f59e0b" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">80%以上: 優秀</Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">60-80%: 改善中</Badge>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">60%未満: 要改善</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Workload Balance */}
      <Card>
        <CardHeader className="pb-2">
          <SectionHeader
            icon={Users}
            title="担当者稼働バランス"
            description="担当者間の案件数の偏りを可視化。均等配分で生産性向上"
          />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={Math.max(200, workload.length * 40)}>
                <BarChart data={workload} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(value: number, name: string) => [value, name === "caseCount" ? "担当件数" : "完了件数"]} />
                  <Legend formatter={(value) => value === "caseCount" ? "担当件数" : "完了件数"} />
                  <Bar dataKey="caseCount" fill="#3b82f6" name="caseCount" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="completedCount" fill="#10b981" name="completedCount" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">バランススコア</span>
                </div>
                <div className="text-3xl font-bold text-blue-700">{summary.balanceScore}<span className="text-sm font-normal text-blue-500">/100</span></div>
                <p className="text-xs text-blue-600 mt-1">
                  {summary.balanceScore >= 80 ? "優秀: 担当者間の偏りが少なく効率的に運営されています" :
                   summary.balanceScore >= 60 ? "良好: 一部偏りがありますが概ね均等です" :
                   "要改善: 担当者間の案件数に大きな偏りがあります"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground mb-2">偏り解消の効果</p>
                <ul className="text-xs space-y-1.5">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-600" />残業時間の削減</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-600" />対応遅延リスクの低減</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-600" />担当者のモチベーション維持</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-600" />顧客満足度の向上</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Digitalization Progress */}
      <Card>
        <CardHeader className="pb-2">
          <SectionHeader
            icon={Zap}
            title="デジタル化進捗"
            description="紙ベースからデジタル管理への移行状況。月別の案件登録・完了件数"
          />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-center">
              <p className="text-xs text-purple-600 font-medium">デジタル化率</p>
              <p className="text-2xl font-bold text-purple-700">{summary.digitalRate}%</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
              <p className="text-xs text-blue-600 font-medium">登録案件数</p>
              <p className="text-2xl font-bold text-blue-700">{summary.totalCases}<span className="text-sm font-normal">件</span></p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
              <p className="text-xs text-emerald-600 font-medium">完了案件数</p>
              <p className="text-2xl font-bold text-emerald-700">{summary.completedCases}<span className="text-sm font-normal">件</span></p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={digitalization}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="key" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number, name: string) => [value, name === "newCases" ? "新規登録" : "完了"]} />
              <Legend formatter={(value) => value === "newCases" ? "新規登録" : "完了"} />
              <Line type="monotone" dataKey="newCases" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="newCases" />
              <Line type="monotone" dataKey="completedCases" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="completedCases" />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-purple-600" />
              デジタル化による削減効果（推定）
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><span className="text-muted-foreground">紙の使用量削減:</span><br/><span className="font-semibold">約{Math.round(summary.totalCases * 5)}枚/年</span></div>
              <div><span className="text-muted-foreground">移動時間削減:</span><br/><span className="font-semibold">約{Math.round(summary.totalCases * 0.5)}時間/年</span></div>
              <div><span className="text-muted-foreground">情報共有速度:</span><br/><span className="font-semibold">リアルタイム化</span></div>
              <div><span className="text-muted-foreground">書類紛失リスク:</span><br/><span className="font-semibold">ゼロ</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Partner Performance */}
      <Card>
        <CardHeader className="pb-2">
          <SectionHeader
            icon={Building2}
            title="協力会社パフォーマンス"
            description="発注先の多様化と各社の実績比較"
          />
        </CardHeader>
        <CardContent>
          {partnerPerformance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">協力会社のデータがありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2 font-medium">会社名</th>
                    <th className="text-left p-2 font-medium">業種</th>
                    <th className="text-right p-2 font-medium">案件数</th>
                    <th className="text-right p-2 font-medium">完了数</th>
                    <th className="text-right p-2 font-medium">完了率</th>

                  </tr>
                </thead>
                <tbody>
                  {partnerPerformance.slice(0, 15).map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-2 font-medium">{p.name}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                      </td>
                      <td className="p-2 text-right">{p.caseCount}</td>
                      <td className="p-2 text-right">{p.completedCount}</td>
                      <td className="p-2 text-right">
                        <span className={p.caseCount > 0 && p.completedCount / p.caseCount >= 0.8 ? "text-green-600 font-medium" : ""}>
                          {p.caseCount > 0 ? Math.round(p.completedCount / p.caseCount * 100) : 0}%
                        </span>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Value Proposition Footer */}
      <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
        <CardContent className="p-6">
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-emerald-800 flex items-center justify-center gap-2">
              <Award className="h-5 w-5" />
              Store OSX 導入価値の提言
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-white/80 border border-emerald-200">
              <h4 className="font-semibold text-sm text-emerald-700 mb-2">業務効率化</h4>
              <ul className="text-xs space-y-1 text-emerald-900">
                <li>・案件処理の平均{summary.avgProcessingDays}日で完了</li>
                <li>・紙の書類管理からの完全脱却</li>
                <li>・リアルタイムの進捗把握</li>
                <li>・移動ルート最適化で時間削減</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-white/80 border border-emerald-200">
              <h4 className="font-semibold text-sm text-emerald-700 mb-2">コスト管理</h4>
              <ul className="text-xs space-y-1 text-emerald-900">
                <li>・見積精度向上で予算超過を防止</li>
                <li>・協力会社の比較で最適発注</li>
                <li>・予実管理の自動化</li>
                <li>・発注プロセスの透明化</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-white/80 border border-emerald-200">
              <h4 className="font-semibold text-sm text-emerald-700 mb-2">品質向上</h4>
              <ul className="text-xs space-y-1 text-emerald-900">
                <li>・チェックリストで漏れゼロ</li>
                <li>・写真台帳の自動生成</li>
                <li>・担当者間の情報共有即時化</li>
                <li>・過去案件のナレッジ蓄積</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
