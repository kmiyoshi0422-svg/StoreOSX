import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Clock,
  Users,
  Target,
  Zap,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MapPin,
  TrendingUp,
} from "lucide-react";
import {
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
  BarChart,
  Bar,
  Cell,
} from "recharts";

// ─── KPI Gauge Card ────────────────────────────────────────────
function KpiGauge({
  title,
  rate,
  met,
  total,
  target,
  icon: Icon,
  color,
}: {
  title: string;
  rate: number;
  met: number;
  total: number;
  target: string;
  icon: React.ElementType;
  color: string;
}) {
  const isGood = rate >= 80;
  const isWarning = rate >= 50 && rate < 80;
  const statusColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";
  const bgColor = isGood ? "bg-emerald-50" : isWarning ? "bg-amber-50" : "bg-red-50";
  const ringColor = isGood ? "stroke-emerald-500" : isWarning ? "stroke-amber-500" : "stroke-red-500";

  // SVG circular progress
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = (rate / 100) * circumference;

  return (
    <Card className={`${bgColor} border-none`}>
      <CardContent className="pt-6 pb-4 flex flex-col items-center gap-3">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
            <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="6" strokeLinecap="round"
              className={ringColor} strokeDasharray={circumference} strokeDashoffset={circumference - progress}
              style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.23,1,0.32,1)" }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold ${statusColor}`}>{rate}%</span>
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1.5 justify-center mb-1">
            <Icon className={`h-4 w-4 ${statusColor}`} />
            <span className="text-sm font-semibold text-foreground">{title}</span>
          </div>
          <p className="text-xs text-muted-foreground">{met}/{total}件 達成</p>
          <Badge variant="outline" className="mt-1 text-[10px]">{target}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────
export default function Effectiveness() {
  const [months, setMonths] = useState(12);
  const { data, isLoading } = trpc.reports.effectiveness.useQuery({ months });

  // Radar chart data
  const radarData = useMemo(() => {
    if (!data) return [];
    const { kpis } = data;
    return [
      { subject: "至急対応", value: kpis.urgentResponse.rate, fullMark: 100 },
      { subject: "見積提出", value: kpis.estimateSubmission.rate, fullMark: 100 },
      { subject: "施工完了", value: kpis.constructionCompletion.rate, fullMark: 100 },
      { subject: "報告書提出", value: kpis.reportSubmission.rate, fullMark: 100 },
      { subject: "再訪ゼロ", value: kpis.noRevisit.rate, fullMark: 100 },
    ];
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, trends, summary, workload } = data;

  // Overall score (average of 5 KPIs)
  const overallScore = Math.round(
    (kpis.urgentResponse.rate + kpis.estimateSubmission.rate + kpis.constructionCompletion.rate + kpis.reportSubmission.rate + kpis.noRevisit.rate) / 5 * 10
  ) / 10;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">効果測定ダッシュボード</h1>
          <p className="text-sm text-muted-foreground mt-1">プレナス様 KPI達成状況</p>
        </div>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">直近3ヶ月</SelectItem>
            <SelectItem value="6">直近6ヶ月</SelectItem>
            <SelectItem value="12">直近12ヶ月</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overall Score Banner */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-background">
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">総合KPI達成スコア</p>
              <p className="text-3xl font-bold text-foreground">{overallScore}<span className="text-lg text-muted-foreground ml-1">点</span></p>
            </div>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">{summary.totalCases}</p>
              <p>総案件数</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">{summary.completedCases}</p>
              <p>完了件数</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">{summary.avgProcessingDays}</p>
              <p>平均処理日数</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5 KPI Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiGauge
          title="至急一次対応"
          rate={kpis.urgentResponse.rate}
          met={kpis.urgentResponse.met}
          total={kpis.urgentResponse.total}
          target="当日/翌日"
          icon={Zap}
          color="amber"
        />
        <KpiGauge
          title="見積書提出"
          rate={kpis.estimateSubmission.rate}
          met={kpis.estimateSubmission.met}
          total={kpis.estimateSubmission.total}
          target="7日以内"
          icon={FileText}
          color="blue"
        />
        <KpiGauge
          title="施工完了"
          rate={kpis.constructionCompletion.rate}
          met={kpis.constructionCompletion.met}
          total={kpis.constructionCompletion.total}
          target="承認後10日"
          icon={CheckCircle2}
          color="green"
        />
        <KpiGauge
          title="完了報告書"
          rate={kpis.reportSubmission.rate}
          met={kpis.reportSubmission.met}
          total={kpis.reportSubmission.total}
          target="完了後5日"
          icon={Clock}
          color="purple"
        />
        <KpiGauge
          title="再訪ゼロ"
          rate={kpis.noRevisit.rate}
          met={kpis.noRevisit.met}
          total={kpis.noRevisit.total}
          target="一発完了"
          icon={MapPin}
          color="emerald"
        />
      </div>

      {/* Radar + Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">KPIバランス</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="達成率" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trend Line Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">KPI達成率推移（月別）</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="key" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="urgentRate" name="至急対応" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="estimateRate" name="見積提出" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="constructionRate" name="施工完了" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="reportRate" name="報告書" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="noRevisitRate" name="再訪ゼロ" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Workload Balance */}
      {workload.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              担当者別ワークロード
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workload} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="caseCount" name="担当件数" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="completedCount" name="完了件数" fill="hsl(var(--primary)/0.4)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* KPI Target Explanation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            プレナス様 KPI基準
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="h-3.5 w-3.5 text-amber-600" />
                <span className="font-semibold text-amber-800">至急一次対応</span>
              </div>
              <p className="text-amber-700">至急案件は依頼日当日または翌日に一次対応</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-semibold text-blue-800">見積書提出</span>
              </div>
              <p className="text-blue-700">依頼日より7日以内に見積書を提出</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                <span className="font-semibold text-green-800">施工完了</span>
              </div>
              <p className="text-green-700">承認後10日以内に施工完了</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-purple-600" />
                <span className="font-semibold text-purple-800">完了報告書</span>
              </div>
              <p className="text-purple-700">施工完了から5日以内に報告書提出</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-200">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="h-3.5 w-3.5 text-cyan-600" />
                <span className="font-semibold text-cyan-800">再訪ゼロ</span>
              </div>
              <p className="text-cyan-700">現場再訪がないよう一発完了を目標</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
