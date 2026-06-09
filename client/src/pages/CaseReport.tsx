import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Loader2, PenLine, RotateCcw } from "lucide-react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { inlineImages } from "@/lib/imageDataUrl";
import { SignaturePad } from "@/components/SignaturePad";
import type { Case, Photo } from "../../../drizzle/schema";

export type ReportType = "survey" | "completion";

// 報告書ごとの設定
const REPORT_CONFIG: Record<
  ReportType,
  {
    title: string;
    eyebrow: string;
    leadText: string;
    photoTypes: string[]; // 採用する写真区分
    fileLabel: string;
    dateLabel: string;
    dateField: (c: Case) => Date | null | undefined;
  }
> = {
  survey: {
    title: "現場調査報告書",
    eyebrow: "SITE SURVEY REPORT",
    leadText: "下記のとおり現場調査を実施いたしましたのでご報告いたします。",
    photoTypes: ["現調", "施工前A", "施工前B"],
    fileLabel: "現場調査報告書",
    dateLabel: "現調日",
    dateField: (c) => c.surveyDate,
  },
  completion: {
    title: "施工完了報告書",
    eyebrow: "COMPLETION REPORT",
    leadText: "下記のとおり施工が完了いたしましたのでご報告いたします。",
    photoTypes: ["施工後A", "施工後B", "設置状況"],
    fileLabel: "施工完了報告書",
    dateLabel: "施工日",
    dateField: (c) => c.constructionDate,
  },
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function fmtYen(n: number | null | undefined): string {
  if (n == null) return "—";
  return `¥${n.toLocaleString()}`;
}

export default function CaseReport({
  id,
  reportType,
}: {
  id: number;
  reportType: ReportType;
}) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const config = REPORT_CONFIG[reportType];

  const { data: caseData, isLoading: caseLoading } = trpc.cases.get.useQuery({ id });
  const { data: photos = [], isLoading: photosLoading } = trpc.photos.listByCase.useQuery({
    caseId: id,
  });
  const { data: signature, isLoading: sigLoading } = trpc.signatures.get.useQuery({
    caseId: id,
    reportType,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [editingSig, setEditingSig] = useState(false);

  const saveSig = trpc.signatures.save.useMutation({
    onSuccess: () => {
      toast.success("サインを保存しました");
      setEditingSig(false);
      utils.signatures.get.invalidate({ caseId: id, reportType });
      utils.signatures.getByCase.invalidate({ caseId: id });
    },
    onError: (e) => toast.error(e.message || "サインの保存に失敗しました"),
  });
  const deleteSig = trpc.signatures.delete.useMutation({
    onSuccess: () => {
      toast.success("サインを削除しました");
      utils.signatures.get.invalidate({ caseId: id, reportType });
      utils.signatures.getByCase.invalidate({ caseId: id });
    },
    onError: (e) => toast.error(e.message || "サインの削除に失敗しました"),
  });

  // 該当区分の写真を抽出（順序: config.photoTypes の順 → orderNo）
  const reportPhotos = useMemo(() => {
    const order = config.photoTypes;
    return [...photos]
      .filter((p) => order.includes(p.photoType))
      .sort((a, b) => {
        const ai = order.indexOf(a.photoType);
        const bi = order.indexOf(b.photoType);
        if (ai !== bi) return ai - bi;
        return a.orderNo - b.orderNo;
      });
  }, [photos, config.photoTypes]);

  // 写真ページ（4枚／ページ）
  const photoPages = useMemo(() => {
    const result: Photo[][] = [];
    for (let i = 0; i < reportPhotos.length; i += 4) {
      result.push(reportPhotos.slice(i, i + 4));
    }
    return result;
  }, [reportPhotos]);

  const handleDownloadPDF = async () => {
    if (!containerRef.current || !caseData) return;
    setGenerating(true);
    const restore = await inlineImages(containerRef.current).catch(() => () => {});
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const pages = containerRef.current.querySelectorAll<HTMLElement>(".report-page");
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const canvasRatio = canvas.height / canvas.width;
        const targetHeight = pdfWidth * canvasRatio;
        const finalHeight = Math.min(targetHeight, pdfHeight);
        const finalWidth = finalHeight < targetHeight ? finalHeight / canvasRatio : pdfWidth;
        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2;
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", x, y, finalWidth, finalHeight);
      }
      const safe = `${caseData.requestNumber}_${caseData.storeName}`.replace(
        /[\\/:*?"<>|]/g,
        "_",
      );
      pdf.save(`${config.fileLabel}_${safe}.pdf`);
      toast.success("PDFをダウンロードしました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF生成に失敗しました");
    } finally {
      restore();
      setGenerating(false);
    }
  };

  if (caseLoading || photosLoading || sigLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!caseData) {
    return <div className="text-center py-12 text-muted-foreground">案件が見つかりません</div>;
  }

  const hasSig = !!signature;

  return (
    <div>
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border/60 mb-6">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/cases/${id}`)}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            案件詳細に戻る
          </Button>
          <Button onClick={handleDownloadPDF} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating ? "PDF生成中..." : "PDFダウンロード"}
          </Button>
        </div>
      </div>

      {/* 署名コントロール（PDFには含めない） */}
      <div className="no-print max-w-[800px] mx-auto mb-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <PenLine className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-serif-jp text-base font-semibold">プレナス責任者サイン</h3>
            </div>

            {hasSig && !editingSig ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="rounded-lg border border-border bg-white p-2">
                    <img
                      src={signature!.fileUrl}
                      alt="サイン"
                      className="h-20 object-contain"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {signature!.signerName && (
                      <p>
                        署名者：<span className="text-foreground font-medium">{signature!.signerName}</span>
                      </p>
                    )}
                    <p>サイン日時：{new Date(signature!.signedAt).toLocaleString("ja-JP")}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingSig(true)}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    サインし直す
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteSig.mutate({ caseId: id, reportType })}
                    disabled={deleteSig.isPending}
                  >
                    削除
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-1.5 max-w-xs">
                  <Label htmlFor="signerName" className="text-xs">
                    署名者名（任意）
                  </Label>
                  <Input
                    id="signerName"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="例）プレナス 山田"
                    className="h-9"
                  />
                </div>
                <SignaturePad
                  saving={saveSig.isPending}
                  onConfirm={(dataUrl) =>
                    saveSig.mutate({
                      caseId: id,
                      reportType,
                      signerName: signerName.trim() || null,
                      imageBase64: dataUrl,
                    })
                  }
                />
                {hasSig && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingSig(false)}>
                    キャンセル
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 報告書本体（PDFソース） */}
      <div ref={containerRef} className="report-container max-w-[800px] mx-auto">
        {/* 1ページ目：基本情報 */}
        <section className="report-page bg-white border border-border/60 shadow-sm p-12 mb-6">
          <div className="text-center border-b-2 border-foreground/80 pb-4 mb-8">
            <p className="text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
              {config.eyebrow}
            </p>
            <h1 className="font-serif-jp text-3xl font-bold mt-2">{config.title}</h1>
          </div>

          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-sm mb-1">
                <strong className="font-serif-jp text-base">{caseData.storeName}</strong> 御中
              </p>
              <p className="text-xs text-muted-foreground">{config.leadText}</p>
            </div>
            <div className="text-[11px] text-muted-foreground text-right space-y-1">
              <p>案件番号：{caseData.requestNumber}</p>
              <p>報告日：{fmtDate(new Date())}</p>
            </div>
          </div>

          <table className="w-full border-collapse text-xs mb-8">
            <tbody>
              <ReportRow label="ブランド" value={caseData.brand} />
              <ReportRow label="店舗名" value={caseData.storeName} />
              <ReportRow label="店舗住所" value={caseData.address || "—"} />
              <ReportRow label="店舗電話" value={caseData.storePhone || "—"} />
              <ReportRow
                label="工事種別"
                value={`${caseData.categoryLarge || "—"} / ${caseData.categoryMedium || "—"} / ${caseData.categorySmall || "—"}`}
              />
              <ReportRow label="作業区分" value={caseData.workType || "—"} />
              <ReportRow label={config.dateLabel} value={fmtDate(config.dateField(caseData))} />
              {reportType === "completion" && (
                <>
                  <ReportRow label="完了日" value={fmtDate(caseData.completedAt ?? caseData.updatedAt)} />
                  <ReportRow label="見積金額" value={fmtYen(caseData.estimatedCost)} />
                  <ReportRow label="実績金額" value={fmtYen(caseData.actualCost)} />
                </>
              )}
              <ReportRow label="協力会社" value={caseData.contractorName || "—"} />
            </tbody>
          </table>

          <div className="mb-8">
            <p className="text-[13px] font-semibold border-l-[3px] border-foreground/80 pl-2.5 mb-2.5">
              {reportType === "survey" ? "調査内容・依頼内容" : "作業内容"}
            </p>
            <p className="text-xs whitespace-pre-wrap leading-relaxed ml-3">
              {caseData.requestContent || "—"}
            </p>
          </div>

          {caseData.notes && (
            <div className="mb-8">
              <p className="text-[13px] font-semibold border-l-[3px] border-foreground/80 pl-2.5 mb-2.5">
                備考
              </p>
              <p className="text-xs whitespace-pre-wrap leading-relaxed ml-3">{caseData.notes}</p>
            </div>
          )}

          {/* 署名欄 */}
          <SignatureBlock signature={signature} />
        </section>

        {/* 写真ページ */}
        {photoPages.length === 0 ? (
          <section className="report-page bg-white border border-border/60 shadow-sm p-12 mb-6">
            <p className="text-center text-sm text-muted-foreground py-12">
              {reportType === "survey"
                ? "現場調査写真（現調／施工前）が登録されていません。"
                : "施工後写真（施工後／設置状況）が登録されていません。"}
            </p>
          </section>
        ) : (
          photoPages.map((pagePhotos, pi) => (
            <section
              key={pi}
              className="report-page bg-white border border-border/60 shadow-sm p-10 mb-6"
            >
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-border/60">
                <div>
                  <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                    {caseData.requestNumber}
                  </p>
                  <h2 className="font-serif-jp text-base font-semibold">
                    {config.title} 写真
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  Page {pi + 1} / {photoPages.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {pagePhotos.map((photo) => (
                  <div key={photo.id} className="space-y-2">
                    <div className="aspect-[4/3] bg-muted overflow-hidden rounded">
                      <img
                        src={photo.fileUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ imageOrientation: "from-image" }}
                      />
                    </div>
                    <div className="text-[11px] space-y-0.5">
                      <p className="font-semibold font-serif-jp">{photo.photoType}</p>
                      {photo.workItem && <p className="text-muted-foreground">{photo.workItem}</p>}
                      {photo.memo && (
                        <p className="text-muted-foreground leading-snug whitespace-pre-wrap">
                          {photo.memo}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .report-page {
            box-shadow: none !important;
            border: none !important;
            page-break-after: always;
            margin: 0 !important;
            padding: 20mm 18mm !important;
            min-height: 297mm;
          }
          .report-page:last-child { page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th className="py-2 px-3 border border-border/60 bg-muted/40 text-left font-medium w-36 align-top">
        {label}
      </th>
      <td className="py-2 px-3 border border-border/60 align-top">{value}</td>
    </tr>
  );
}

function SignatureBlock({
  signature,
}: {
  signature: { fileUrl: string; signerName: string | null; signedAt: Date } | null | undefined;
}) {
  return (
    <div className="mt-12 pt-6 border-t border-border/60">
      <div className="flex items-end justify-end gap-8">
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground mb-1">プレナス責任者サイン</p>
          <div className="w-56 h-24 border-b-2 border-foreground/70 flex items-end justify-center pb-1">
            {signature ? (
              <img src={signature.fileUrl} alt="サイン" className="max-h-20 object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground/60 mb-6">（未署名）</span>
            )}
          </div>
          {signature?.signerName && (
            <p className="text-xs mt-2 font-serif-jp">{signature.signerName}</p>
          )}
          {signature && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {new Date(signature.signedAt).toLocaleDateString("ja-JP")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
