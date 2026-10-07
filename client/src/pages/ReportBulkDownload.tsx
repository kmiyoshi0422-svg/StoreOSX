import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Archive, FileText, Loader2, Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createReportZip } from "@/lib/reportBulkZip";
import { BULK_REPORT_LIMIT, BULK_REPORT_MAX_BYTES, reportArchiveName, type BulkReportType } from "../../../shared/reportBulk";

const types: BulkReportType[] = ["現場調査報告書", "施工完了報告書"];
type Choice = { caseId: number; reportType: BulkReportType };
type ReadyReport = Choice & { fileName: string; bytes: ArrayBuffer; url: string; pageCount: number };
const keyOf = (choice: Choice) => `${choice.caseId}:${choice.reportType}`;

async function captureOne(item: Choice & { fileName: string }): Promise<ReadyReport> {
  const token = crypto.randomUUID();
  const route = item.reportType === "現場調査報告書" ? "survey-report" : "completion-report";
  return new Promise<ReadyReport>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.title = `${item.fileName}のPDF生成`;
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;left:-12000px;top:0;width:1440px;height:920px;opacity:0;pointer-events:none";
    const finish = () => { clearTimeout(timer); window.removeEventListener("message", receive); iframe.remove(); };
    const receive = (event: MessageEvent) => {
      const message = event.data;
      if (event.origin !== window.location.origin || event.source !== iframe.contentWindow ||
        message?.source !== "storeosx-report-bulk" || message.token !== token ||
        message.caseId !== item.caseId || message.reportType !== item.reportType) return;
      finish();
      if (message.error) { reject(new Error(`${item.fileName}: ${message.error}`)); return; }
      if (!(message.bytes instanceof ArrayBuffer) || !message.pageCount) {
        reject(new Error(`${item.fileName}: A4ページの確認に失敗しました`)); return;
      }
      const bytes = message.bytes as ArrayBuffer;
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      resolve({ ...item, bytes, pageCount: message.pageCount, url });
    };
    const timer = window.setTimeout(() => { finish(); reject(new Error(`${item.fileName}: 読み込みが時間切れです。通信状態を確認してください`)); }, 150_000);
    window.addEventListener("message", receive);
    document.body.appendChild(iframe);
    iframe.src = `/cases/${item.caseId}/${route}?bulkZipToken=${encodeURIComponent(token)}`;
  });
}

export default function ReportBulkDownload() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [reports, setReports] = useState<ReadyReport[]>([]);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const reportsRef = useRef<ReadyReport[]>([]);
  const mounted = useRef(true);
  const { data: candidates, isLoading, error } = trpc.reportBulk.candidates.useQuery();
  const validate = trpc.reportBulk.validate.useMutation();
  useEffect(() => () => { mounted.current = false; reportsRef.current.forEach((report) => URL.revokeObjectURL(report.url)); }, []);
  const clearReports = () => {
    reportsRef.current.forEach((report) => URL.revokeObjectURL(report.url));
    reportsRef.current = [];
    setReports([]);
    setVerified(new Set());
    setPreviewOpen(false);
  };
  const visible = useMemo(() => (candidates || []).filter((row) =>
    `${row.requestNumber} ${row.storeName}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (row.canSurvey || row.canCompletion)), [candidates, search]);
  const toggle = (choice: Choice) => {
    if (busy) return;
    clearReports();
    setChoices((current) => {
      const exists = current.some((row) => keyOf(row) === keyOf(choice));
      if (!exists && current.length >= BULK_REPORT_LIMIT) { toast.warning(`一度に${BULK_REPORT_LIMIT}件まで選択できます`); return current; }
      return exists ? current.filter((row) => keyOf(row) !== keyOf(choice)) : [...current, choice];
    });
  };
  const generate = async () => {
    setBusy(true);
    clearReports();
    const prepared: ReadyReport[] = [];
    try {
      const valid = await validate.mutateAsync(choices);
      let total = 0;
      for (let index = 0; index < valid.length; index++) {
        setProgress(`${index + 1} / ${valid.length} 件目のA4 PDFを生成中：${valid[index].requestNumber}`);
        const report = await captureOne(valid[index]);
        total += report.bytes.byteLength;
        if (total > BULK_REPORT_MAX_BYTES) {
          URL.revokeObjectURL(report.url);
          throw new Error("生成したPDFの合計が80MBを超えました。少ない件数でやり直してください");
        }
        prepared.push(report);
      }
      if (!mounted.current) { prepared.forEach((report) => URL.revokeObjectURL(report.url)); return; }
      reportsRef.current = prepared;
      setReports(prepared);
      setActive(0);
      setPreviewOpen(true);
      setProgress("");
      toast.success(`${prepared.length}件のPDFを生成しました。全件のレイアウトを確認してください`);
    } catch (error) {
      prepared.forEach((report) => URL.revokeObjectURL(report.url));
      if (mounted.current) toast.error(error instanceof Error ? error.message : "報告書一括生成に失敗しました");
    } finally { if (mounted.current) { setBusy(false); setProgress(""); } }
  };
  const download = async () => {
    if (reports.length < 2 || verified.size !== reports.length) return;
    setBusy(true);
    try {
      setProgress("ZIPファイルを作成中…");
      const blob = await createReportZip(reports, (percent) => setProgress(`ZIPファイルを作成中…${percent}%`));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = reportArchiveName();
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success(`${reports.length}件の報告書をZIPでダウンロードしました`);
      setPreviewOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ZIPを作成できませんでした");
    } finally { setBusy(false); setProgress(""); }
  };

  return <div className="space-y-5 pb-14">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-5">
      <div><p className="text-xs tracking-[0.18em] uppercase text-muted-foreground">REPORT ARCHIVE</p>
        <h1 className="text-2xl font-semibold mt-1">報告書を選んでZIPダウンロード</h1>
        <p className="text-sm text-muted-foreground mt-2">現調・完了報告書を2〜{BULK_REPORT_LIMIT}件選択。既存のA4全ページ・写真・署名を使用します。</p></div>
      <Button variant="outline" onClick={() => navigate("/pdf-history")}>保存済みPDF履歴から選ぶ</Button>
    </div>
    <Card><CardContent className="pt-5 space-y-3">
      <p className="text-sm">PDF生成履歴に保存されていない案件も、ここから報告書を生成できます。ZIPに入れる前に<strong>全件をプレビューで確認</strong>してください。原本がない写真は作りません。</p>
      <div className="relative max-w-lg"><Search className="h-4 w-4 absolute top-3 left-3 text-muted-foreground" />
        <Input className="pl-9" placeholder="依頼番号・店舗名で検索" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">選択済み {choices.length} / {BULK_REPORT_LIMIT}件</span>
        <Button disabled={busy || choices.length < 2} onClick={generate}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          A4 PDFを生成して確認
        </Button>
        {choices.length > 0 && <Button variant="ghost" disabled={busy} onClick={() => { setChoices([]); clearReports(); }}>選択解除</Button>}
        {progress && <span role="status" className="text-sm text-primary">{progress}</span>}
      </div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">案件別の報告書</CardTitle></CardHeader>
      <CardContent className="space-y-1 max-h-[650px] overflow-y-auto">
        {isLoading ? <p className="py-8 text-center text-muted-foreground">案件を読み込み中…</p> : error ?
          <p className="text-red-600">{error.message}</p> : visible.length === 0 ?
          <p className="py-8 text-center text-muted-foreground">対象の案件がありません</p> :
          visible.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-3 border-b py-3 last:border-b-0">
            <div className="min-w-[190px] flex-1"><p className="font-medium">{row.requestNumber} · {row.storeName}</p></div>
            {types.map((type) => { const available = type === "現場調査報告書" ? row.canSurvey : row.canCompletion;
              const checked = choices.some((choice) => choice.caseId === row.id && choice.reportType === type);
              return <label key={type} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${available ? "cursor-pointer" : "opacity-40"}`}>
                <Checkbox checked={checked} disabled={!available || busy} onCheckedChange={() => toggle({ caseId: row.id, reportType: type })} />{type}
              </label>; })}
          </div>)}
      </CardContent></Card>
    <Dialog open={previewOpen} onOpenChange={(open) => { if (!busy) setPreviewOpen(open); }}>
      <DialogContent className="max-w-[min(96vw,1180px)] h-[94vh] flex flex-col overflow-hidden">
        <DialogHeader><DialogTitle>全件プレビュー確認 · {reports.length}件</DialogTitle></DialogHeader>
        {reports.length > 0 && <>
          <div className="flex gap-2 overflow-x-auto shrink-0 pb-1">{reports.map((report, index) =>
            <Button key={keyOf(report)} variant={active === index ? "default" : "outline"} size="sm" onClick={() => setActive(index)}>
              {verified.has(keyOf(report)) && <CheckCircle2 className="h-3 w-3 mr-1" />}{index + 1}. {report.reportType} · 案件{report.caseId}
            </Button>)}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground shrink-0">
            <span>{reports[active].fileName} · A4 {reports[active].pageCount}ページ</span>
            <Button variant="outline" size="sm" asChild><a href={reports[active].url} target="_blank" rel="noreferrer">別タブで全ページを見る</a></Button>
            <Button variant={verified.has(keyOf(reports[active])) ? "secondary" : "outline"} size="sm" onClick={() =>
              setVerified((current) => new Set(current).add(keyOf(reports[active])))}>
              {verified.has(keyOf(reports[active])) ? "確認済み" : "この報告書を確認しました"}
            </Button>
          </div>
          <iframe className="flex-1 min-h-0 w-full rounded border bg-white" title="A4報告書PDFプレビュー" src={reports[active].url} />
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">{verified.size} / {reports.length}件を確認済み。各PDFの全ページ・写真・署名を確認してください。</span>
            <Button disabled={busy || verified.size !== reports.length} onClick={download}>
              <Archive className="h-4 w-4 mr-2" />{busy ? progress || "ZIPを生成中…" : "確認した報告書をZIPでダウンロード"}
            </Button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
