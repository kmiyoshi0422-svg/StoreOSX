import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useMemo, useRef, useState } from "react";
import { Download, Eye, Loader2, Search, Images, CheckSquare, Square } from "lucide-react";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";
import {
  toFullWidthDigits as _toFullWidthDigits,
  reportLabel as _reportLabel,
} from "../../../shared/reportText";
import { inlineImages } from "@/lib/imageDataUrl";

// PDF/写真台帳の全角化・括弧除去の対象外にする除外辞書（コンポーネントからsetReportExclusionsで注入）。
let _exclusions: string[] = [];
function setReportExclusions(terms: string[]) {
  _exclusions = terms;
}
function toFullWidthDigits(input: string | number | null | undefined): string {
  return _toFullWidthDigits(input, _exclusions);
}
function reportLabel(input: string | number | null | undefined): string {
  return _reportLabel(input, _exclusions);
}



const PHOTO_TYPE_ORDER = [
  "現調",
  "施工前A",
  "施工前B",
  "施工後A",
  "施工後B",
  "メーカー型番",
  "設置状況",
  "その他",
];

type PhotoRow = {
  id: number;
  caseId: number;
  fileUrl: string;
  photoType: string;
  workCategory: string | null;
  workItem: string | null;
  memo: string | null;
  orderNo: number;
  rotation: number | null;
  createdAt: Date;
};

type CaseRow = {
  id: number;
  requestNumber: string;
  brand: string | null;
  storeName: string;
  address: string | null;
  contractorName: string | null;
};

export default function PhotoLedgerBatch() {
  const { data: cases = [], isLoading } = trpc.cases.list.useQuery();
  const [keyword, setKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: exclusionRows = [] } = trpc.fullwidthExclusions.list.useQuery();
  setReportExclusions(exclusionRows.map((r) => r.term));

  // 一括取得（選択された案件分の写真）
  const ledgerQuery = trpc.photos.listByCases.useQuery(
    { caseIds: selectedIds },
    { enabled: selectedIds.length > 0 },
  );

  const filteredCases = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return cases;
    return cases.filter((c) => {
      return (
        c.requestNumber?.toLowerCase().includes(kw) ||
        c.storeName?.toLowerCase().includes(kw) ||
        (c.brand ?? "").toLowerCase().includes(kw) ||
        (c.address ?? "").toLowerCase().includes(kw)
      );
    });
  }, [cases, keyword]);

  const toggleOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllFiltered = () => {
    setSelectedIds(filteredCases.map((c) => c.id));
  };
  const clearSelection = () => setSelectedIds([]);

  // 案件ごとに写真をグループ化（2枚/ページ）してページ配列を構築
  const ledgerData = useMemo(() => {
    if (!ledgerQuery.data) return [];
    const photoRows = ledgerQuery.data.photos as unknown as PhotoRow[];
    const caseRows = ledgerQuery.data.cases as unknown as CaseRow[];
    const caseMap = new Map<number, CaseRow>();
    caseRows.forEach((c) => caseMap.set(c.id, c));

    // 選択順を維持
    return selectedIds
      .map((cid) => {
        const c = caseMap.get(cid);
        if (!c) return null;
        const photos = photoRows
          .filter((p) => p.caseId === cid)
          .sort((a, b) => {
            const ai = PHOTO_TYPE_ORDER.indexOf(a.photoType);
            const bi = PHOTO_TYPE_ORDER.indexOf(b.photoType);
            if (ai !== bi) return ai - bi;
            return a.orderNo - b.orderNo;
          });
        const pages: PhotoRow[][] = [];
        for (let i = 0; i < photos.length; i += 2) {
          pages.push(photos.slice(i, i + 2));
        }
        return { caseInfo: c, pages, photoCount: photos.length };
      })
      .filter((x): x is { caseInfo: CaseRow; pages: PhotoRow[][]; photoCount: number } => x !== null);
  }, [ledgerQuery.data, selectedIds]);

  const totalPhotos = ledgerData.reduce((sum, d) => sum + d.photoCount, 0);

  const handleDownloadPDF = async () => {
    if (!containerRef.current || ledgerData.length === 0) return;
    if (totalPhotos === 0) {
      toast.error("選択した案件に写真がありません");
      return;
    }
    setGenerating(true);
    const restore = await inlineImages(containerRef.current).catch(() => () => {});
    try {

      // フォントの読み込みを待つ（日本語フォントが未ロードだと文字化けする）
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 100));

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const pageEls = containerRef.current.querySelectorAll<HTMLElement>(".ledger-page");

      setProgress({ current: 0, total: pageEls.length });

      for (let i = 0; i < pageEls.length; i++) {
        const canvas = await html2canvas(pageEls[i], {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 800,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const canvasRatio = canvas.height / canvas.width;
        const targetWidth = pdfWidth;
        const targetHeight = pdfWidth * canvasRatio;
        const finalHeight = Math.min(targetHeight, pdfHeight);
        const finalWidth =
          finalHeight < targetHeight ? finalHeight / canvasRatio : targetWidth;
        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", x, y, finalWidth, finalHeight);
        setProgress({ current: i + 1, total: pageEls.length });
      }

      const today = new Date()
        .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
        .replace(/\//g, "");
      pdf.save(`写真台帳_一括_${toFullWidthDigits(ledgerData.length)}件_${today}.pdf`);
      toast.success(`${ledgerData.length}件の写真台帳をPDF出力しました`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PDF生成に失敗しました";
      toast.error(msg);
    } finally {
      restore();
      setGenerating(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-jp text-2xl font-bold tracking-tight flex items-center gap-2">
          <Images className="h-6 w-6" />
          写真台帳（一括PDF出力）
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          複数の案件を選択して、まとめて1つのPDFに出力できます。月次のまとめ提出にご利用ください。
        </p>
      </div>

      {/* 選択ツールバー */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="案件番号・店舗名・ブランド・住所で絞り込み"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                <CheckSquare className="h-3.5 w-3.5" />
                表示中をすべて選択
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                disabled={selectedIds.length === 0}
              >
                <Square className="h-3.5 w-3.5" />
                選択解除
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedIds.length}</span> 件選択中
              {selectedIds.length > 0 && ledgerQuery.data && (
                <span className="ml-2">写真 {toFullWidthDigits(totalPhotos)} 枚</span>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={selectedIds.length === 0 || ledgerQuery.isLoading || totalPhotos === 0}
            >
              <Eye className="h-4 w-4" />
              プレビュー
            </Button>
            <Button
              onClick={handleDownloadPDF}
              disabled={selectedIds.length === 0 || generating || ledgerQuery.isLoading}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {generating
                ? progress
                  ? `PDF生成中... ${progress.current}/${progress.total}`
                  : "PDF生成中..."
                : "一括PDFダウンロード"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 案件選択リスト */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          該当する案件がありません
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filteredCases.map((c) => {
            const checked = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleOne(c.id)}
                className={`flex items-start gap-3 text-left rounded-lg border p-3 transition-colors ${
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:bg-accent/40"
                }`}
              >
                <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-wider text-muted-foreground">
                      {toFullWidthDigits(c.requestNumber)}
                    </span>
                    {c.brand && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        {c.brand}
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium text-sm truncate font-serif-jp">{c.storeName}</p>
                  {c.address && (
                    <p className="text-xs text-muted-foreground truncate">{c.address}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 非表示の台帳本体（PDF生成元） */}
      <div style={{ position: "fixed", left: 0, top: 0, zIndex: -9999, opacity: 0, pointerEvents: "none" }} aria-hidden>
        <div ref={containerRef} className="ledger-container">
          {ledgerData.map(({ caseInfo, pages }) => (
            <div key={caseInfo.id}>
              {/* 案件表紙 */}
              <section className="ledger-page bg-white p-6" style={{ width: 800 }}>
                <div className="text-center mb-12">
                  <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-3">
                    Photo Ledger
                  </p>
                  <h1 className="font-serif-jp text-[32px] font-bold tracking-tight">写真台帳</h1>
                  <div className="w-16 h-px bg-foreground/30 mx-auto mt-6" />
                </div>
                <div className="space-y-3 max-w-md mx-auto mt-12">
                  <LedgerRow label="案件番号" value={toFullWidthDigits(caseInfo.requestNumber)} />
                  <LedgerRow label="ブランド" value={caseInfo.brand ? reportLabel(caseInfo.brand) : "—"} />
                  <LedgerRow label="店舗名" value={reportLabel(caseInfo.storeName)} />
                  <LedgerRow label="店舗住所" value={caseInfo.address ? toFullWidthDigits(caseInfo.address) : "—"} />
                  <LedgerRow label="協力会社" value={caseInfo.contractorName ? reportLabel(caseInfo.contractorName) : "—"} />
                  <LedgerRow
                    label="作成日"
                    value={toFullWidthDigits(
                      new Date().toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    )}
                  />
                </div>
              </section>

              {/* 写真ページ */}
              {pages.map((pagePhotos, pi) => (
                <section
                  key={pi}
                  className="ledger-page bg-white p-6"
                  style={{ width: 800 }}
                >
                  <div className="flex items-center justify-between mb-6 pb-3 border-b border-border/60">
                    <div>
                      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                        {toFullWidthDigits(caseInfo.requestNumber)}
                      </p>
                      <h2 className="font-serif-jp text-base font-semibold">
                        {reportLabel(caseInfo.storeName)}
                      </h2>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      ページ {toFullWidthDigits(pi + 1)} / {toFullWidthDigits(pages.length)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {pagePhotos.map((photo) => (
                      <div key={photo.id} className="ledger-photo">
                        <div className="grid grid-cols-[1fr_180px] gap-4 items-start">
                          <div className="aspect-[4/3] bg-muted overflow-hidden rounded">
                            <img
                              src={photo.fileUrl}
                              alt=""
                              crossOrigin="anonymous"
                              className="w-full h-full object-cover"
                              style={{
                                imageOrientation: "from-image",
                                transform: photo.rotation
                                  ? `rotate(${photo.rotation}deg)`
                                  : undefined,
                              }}
                            />
                          </div>
                          <div className="space-y-2 text-[13px]">
                            <div className="pb-2 border-b border-border/40">
                              <p className="text-[9.5px] tracking-widest text-muted-foreground uppercase">
                                Type
                              </p>
                              <p className="font-semibold font-serif-jp">{reportLabel(photo.photoType)}</p>
                            </div>
                            <div>
                              <p className="text-[9.5px] tracking-widest text-muted-foreground uppercase">
                                工事項目
                              </p>
                              <p>{photo.workCategory ? reportLabel(photo.workCategory) : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[9.5px] tracking-widest text-muted-foreground uppercase">
                                作業内容
                              </p>
                              <p className="leading-snug">{photo.workItem ? reportLabel(photo.workItem) : "—"}</p>
                            </div>
                            {photo.memo && (
                              <div className="pt-2 border-t border-border/40">
                                <p className="text-[9.5px] tracking-widest text-muted-foreground uppercase">
                                  Memo
                                </p>
                                <p className="leading-snug whitespace-pre-wrap">{reportLabel(photo.memo)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* PDFプレビューモーダル */}
      <PdfPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        containerRef={containerRef}
        fileName={`写真台帳_一括_${ledgerData.length}件`}
        pageSelector=".ledger-page"
      />
    </div>
  );
}

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-6 border-b border-border/30 pb-2">
      <dt className="text-[10.5px] tracking-widest text-muted-foreground uppercase w-24 shrink-0">
        {label}
      </dt>
      <dd className="text-[14px] flex-1 font-serif-jp">{value}</dd>
    </div>
  );
}
