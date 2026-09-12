import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Download, FileClock, FileText, Loader2, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const REPORT_TYPES = [
  "現場調査報告書",
  "施工完了報告書",
  "写真台帳",
  "写真台帳一括",
  "ダッシュボード",
  "効果検証",
  "横断工程表",
  "その他",
] as const;

const PAGE_SIZE = 50;

function dateMs(value: string, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return date.getTime();
}

function formatBytes(size: number | null) {
  if (!size) return "—";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function PdfHistory() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [reportType, setReportType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);

  const input = useMemo(() => ({
    search: search.trim() || undefined,
    reportType: reportType === "all" ? undefined : reportType as (typeof REPORT_TYPES)[number],
    startMs: dateMs(startDate),
    endMs: dateMs(endDate, true),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [search, reportType, startDate, endDate, page]);

  const { data, isLoading, error } = trpc.pdfHistory.list.useQuery(input, {
    enabled: !!user && user.role !== "partner",
  });

  if (user?.role === "partner") {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center text-muted-foreground">
          PDF生成履歴を閲覧する権限がありません。
        </CardContent>
      </Card>
    );
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap border-b pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">PDF Archive</p>
          <h1 className="text-3xl font-semibold tracking-tight">PDF生成履歴</h1>
          <p className="text-sm text-muted-foreground mt-2">過去に生成した報告書・写真台帳・ダッシュボードPDFを再ダウンロードできます。</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1.5">{total.toLocaleString()} 件</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" />絞り込み</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] items-end">
          <div>
            <label className="text-xs text-muted-foreground">案件・店舗・ファイル名・生成者</label>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="キーワード検索" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">PDF種別</label>
            <Select value={reportType} onValueChange={(value) => { setReportType(value); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {REPORT_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">生成日（開始）</label>
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0); }} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">生成日（終了）</label>
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0); }} />
          </div>
          <Button variant="outline" onClick={() => { setSearch(""); setReportType("all"); setStartDate(""); setEndDate(""); setPage(0); }}>クリア</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />読み込み中...</div>
          ) : error ? (
            <div className="py-16 text-center text-red-600">{error.message}</div>
          ) : data?.items.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground"><FileClock className="h-10 w-10 mx-auto mb-3 opacity-50" />該当するPDF履歴はありません</div>
          ) : (
            <div className="divide-y">
              {data?.items.map((item) => (
                <div key={item.id} className="p-4 flex items-center gap-4 flex-wrap md:flex-nowrap">
                  <div className="h-11 w-11 shrink-0 flex items-center justify-center bg-red-50 text-red-700 rounded-md"><FileText className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{item.fileName}</p>
                      <Badge variant="outline">{item.reportType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.requestNumber ? `${item.requestNumber} · ${item.storeName ?? ""} · ` : ""}
                      {new Date(item.createdAt).toLocaleString("ja-JP")} · {item.generatedByName ?? "不明"} · {formatBytes(item.fileSize)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {item.caseId && <Button variant="outline" size="sm" onClick={() => setLocation(`/cases/${item.caseId}`)}>案件を開く</Button>}
                    <Button size="sm" asChild>
                      <a href={item.fileUrl} target="_blank" rel="noreferrer" download={item.fileName}><Download className="h-4 w-4 mr-1.5" />再ダウンロード</a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total === 0 ? 0 : page * PAGE_SIZE + 1}〜{Math.min((page + 1) * PAGE_SIZE, total)} / {total}件</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>前へ</Button>
          <span>{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>次へ</Button>
        </div>
      </div>
    </div>
  );
}
