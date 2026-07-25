import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Clock,
  Users,
  Target,
  Zap,
  CheckCircle2,
  FileText,
  MapPin,
  Download,
  Eye,
  Loader2,
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
} from "recharts";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { inlineImages } from "@/lib/imageDataUrl";

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
  const colorMap: Record<string, { ring: string; bg: string; text: string }> = {
    amber: { ring: "stroke-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
    blue: { ring: "stroke-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
    green: { ring: "stroke-green-500", bg: "bg-green-50", text: "text-green-700" },
    purple: { ring: "stroke-purple-500", bg: "bg-purple-50", text: "text-purple-700" },
    emerald: { ring: "stroke-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  };
  const c = colorMap[color] || colorMap.blue;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (rate / 100) * circumference;

  return (
    <Card className="text-center">
      <CardContent className="pt-4 pb-3 flex flex-col items-center gap-2">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" strokeLinecap="round" className={c.ring} strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold">{rate}%</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${c.text}`} />
          <span className="text-xs font-semibold">{title}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">{met}/{total}件 達成</p>
        <Badge variant="outline" className="text-[10px]">{target}</Badge>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────
export default function Effectiveness() {
  const [months, setMonths] = useState(12);
  const { data, isLoading } = trpc.reports.effectiveness.useQuery({ months });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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

  // PDF download handler
  const handleDownloadPDF = async () => {
    if (!containerRef.current) return;
    setGenerating(true);
    setPdfProgress("画像を準備中...");
    const restore = await inlineImages(containerRef.current).catch(() => () => {});
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 200));

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const pages = containerRef.current.querySelectorAll<HTMLElement>(".report-page");
      const totalPages = pages.length;
      for (let i = 0; i < totalPages; i++) {
        setPdfProgress(`ページ ${i + 1} / ${totalPages} を処理中...`);
        await new Promise((r) => setTimeout(r, 0));
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 900,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.9);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }
      setPdfProgress("PDFを保存中...");
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      pdf.save(`効果測定レポート_${today}.pdf`);
      toast.success("PDFをダウンロードしました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF生成に失敗しました");
    } finally {
      restore();
      setGenerating(false);
      setPdfProgress("");
    }
  };

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

  const today = new Date();
  const reportDate = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const periodEnd = `${today.getFullYear()}年${today.getMonth() + 1}月`;
  const periodStart = (() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - months + 1);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  })();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header with PDF buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">効果測定ダッシュボード</h1>
          <p className="text-sm text-muted-foreground mt-1">プレナス様 KPI達成状況</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={generating}>
            <Eye className="h-4 w-4 mr-1" /> プレビュー
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            {generating ? pdfProgress || "生成中..." : "PDF出力"}
          </Button>
        </div>
      </div>

      {/* ═══ PDF Export Container (printable pages) ═══ */}
      <div ref={containerRef}>
        {/* ─── Page 1: Cover + KPI Gauges ─── */}
        <section className="report-page bg-white" style={{ width: "210mm", minHeight: "297mm", padding: "15mm 12mm", boxSizing: "border-box" }}>
          {/* Report Header */}
          <div className="border-b-2 border-slate-800 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-slate-900 text-center">効果測定月次レポート</h1>
            <div className="flex justify-between items-end mt-3 text-sm text-slate-600">
              <div>
                <p>提出先: 株式会社プレナス 御中</p>
                <p>対象期間: {periodStart} 〜 {periodEnd}</p>
              </div>
              <div className="text-right">
                <p>作成日: {reportDate}</p>
                <p>作成: Store OSX</p>
              </div>
            </div>
          </div>

          {/* Overall Score */}
          <div className="border rounded-lg p-4 mb-6 bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">総合KPI達成スコア</p>
                  <p className="text-3xl font-bold text-slate-900">{overallScore}<span className="text-base text-slate-500 ml-1">/ 100点</span></p>
                </div>
              </div>
              <div className="flex gap-8 text-center">
                <div>
                  <p className="text-xl font-bold text-slate-900">{summary.totalCases}</p>
                  <p className="text-[11px] text-slate-500">総案件数</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{summary.completedCases}</p>
                  <p className="text-[11px] text-slate-500">完了件数</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{summary.avgProcessingDays}</p>
                  <p className="text-[11px] text-slate-500">平均処理日数</p>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Summary Table */}
          <h2 className="text-base font-bold text-slate-800 mb-3">KPI達成状況</h2>
          <table className="w-full border-collapse text-sm mb-6">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 text-left font-semibold">KPI項目</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-semibold">基準</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-semibold">対象件数</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-semibold">達成件数</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-semibold">達成率</th>
                <th className="border border-slate-300 px-3 py-2 text-center font-semibold">判定</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "至急案件 一次対応", target: "当日/翌日", ...kpis.urgentResponse },
                { name: "見積書提出", target: "7日以内", ...kpis.estimateSubmission },
                { name: "施工完了", target: "承認後10日以内", ...kpis.constructionCompletion },
                { name: "完了報告書提出", target: "完了後5日以内", ...kpis.reportSubmission },
                { name: "現場再訪ゼロ", target: "一発完了", ...kpis.noRevisit },
              ].map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="border border-slate-300 px-3 py-2 font-medium">{row.name}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{row.target}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{row.total}件</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{row.met}件</td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-bold">{row.rate}%</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">
                    {row.rate >= 90 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800">優良</span>
                    ) : row.rate >= 70 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-yellow-100 text-yellow-800">良好</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">要改善</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Radar Chart */}
          <h2 className="text-base font-bold text-slate-800 mb-3">KPIバランス</h2>
          <div className="flex justify-center">
            <ResponsiveContainer width={350} height={250}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="達成率" dataKey="value" stroke="#1e293b" fill="#1e293b" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ─── Page 2: Trends + Workload ─── */}
        <section className="report-page bg-white" style={{ width: "210mm", minHeight: "297mm", padding: "15mm 12mm", boxSizing: "border-box" }}>
          <div className="border-b border-slate-300 pb-2 mb-6">
            <h2 className="text-lg font-bold text-slate-800">KPI達成率推移（月別）</h2>
            <p className="text-xs text-slate-500">{periodStart} 〜 {periodEnd}</p>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="key" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <Tooltip formatter={(v: number) => [`${v}%`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="urgentRate" name="至急対応" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="estimateRate" name="見積提出" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="constructionRate" name="施工完了" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="reportRate" name="報告書" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="noRevisitRate" name="再訪ゼロ" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>

          {/* Workload */}
          {workload.length > 0 && (
            <div className="mt-8">
              <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                担当者別ワークロード
              </h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold">担当者</th>
                    <th className="border border-slate-300 px-3 py-2 text-center font-semibold">担当件数</th>
                    <th className="border border-slate-300 px-3 py-2 text-center font-semibold">完了件数</th>
                    <th className="border border-slate-300 px-3 py-2 text-center font-semibold">完了率</th>
                  </tr>
                </thead>
                <tbody>
                  {workload.map((w: { name: string; caseCount: number; completedCount: number }, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="border border-slate-300 px-3 py-2 font-medium">{w.name}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{w.caseCount}件</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{w.completedCount}件</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">
                        {w.caseCount > 0 ? Math.round((w.completedCount / w.caseCount) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* KPI Standards Footer */}
          <div className="mt-8 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-2">KPI基準一覧</h3>
            <div className="grid grid-cols-5 gap-2 text-[11px]">
              <div className="p-2 rounded bg-amber-50 border border-amber-200">
                <p className="font-semibold text-amber-800 mb-0.5">至急一次対応</p>
                <p className="text-amber-700">当日/翌日に対応</p>
              </div>
              <div className="p-2 rounded bg-blue-50 border border-blue-200">
                <p className="font-semibold text-blue-800 mb-0.5">見積書提出</p>
                <p className="text-blue-700">依頼日より7日以内</p>
              </div>
              <div className="p-2 rounded bg-green-50 border border-green-200">
                <p className="font-semibold text-green-800 mb-0.5">施工完了</p>
                <p className="text-green-700">承認後10日以内</p>
              </div>
              <div className="p-2 rounded bg-purple-50 border border-purple-200">
                <p className="font-semibold text-purple-800 mb-0.5">完了報告書</p>
                <p className="text-purple-700">完了から5日以内</p>
              </div>
              <div className="p-2 rounded bg-cyan-50 border border-cyan-200">
                <p className="font-semibold text-cyan-800 mb-0.5">再訪ゼロ</p>
                <p className="text-cyan-700">一発完了を目標</p>
              </div>
            </div>
          </div>

          {/* Page footer */}
          <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-slate-400" style={{ position: "relative", marginTop: "auto", paddingTop: "20px" }}>
            <p>本レポートはStore OSXにより自動生成されました。 作成日: {reportDate}</p>
          </div>
        </section>
      </div>

      {/* PdfPreviewModal */}
      <PdfPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        containerRef={containerRef}
        fileName={`効果測定レポート_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`}
        pageSelector=".report-page"
      />
    </div>
  );
}
