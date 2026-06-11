import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";

// 取得失敗画像用の軽量プレースホルダ（淡いグレー）
const PLACEHOLDER_DATA_URL =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="16" font-family="sans-serif">No Image</text></svg>',
  );

// 同一オリジンの/manus-storage経由で画像をfetchし、dataURLに変換する。
// これによりhtml2canvasが外部画像でcanvasを汚染させるのを防ぐ。
async function toDataUrl(src: string): Promise<string> {
  const res = await fetch(src, { credentials: "include" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function PhotoLedger({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { data: caseData, isLoading: caseLoading } = trpc.cases.get.useQuery({ id });
  const { data: photos = [], isLoading: photosLoading } = trpc.photos.listByCase.useQuery({
    caseId: id,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    if (!containerRef.current || !caseData) return;
    setGenerating(true);
    // PDF生成前に台帳内の画像をdataURL化して、canvas汚染（Tainted canvas）を防ぐ。
    // 元のsrcを退避し、生成後に必ず復元する。
    const imgs = Array.from(
      containerRef.current.querySelectorAll<HTMLImageElement>("img"),
    );
    const originalSrcs = imgs.map((img) => img.getAttribute("src") ?? "");
    try {
      await Promise.all(
        imgs.map(async (img, idx) => {
          const src = originalSrcs[idx];
          if (!src || src.startsWith("data:")) return;
          try {
            const dataUrl = await toDataUrl(src);
            img.src = dataUrl;
            // 差し替え後の読み込み完了を待つ
            if (typeof img.decode === "function") {
              await img.decode().catch(() => undefined);
            }
          } catch {
            // 取得失敗時はプレースホルダにして生成を継続
            img.src = PLACEHOLDER_DATA_URL;
            img.removeAttribute("srcset");
          }
        }),
      );

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const pages = containerRef.current.querySelectorAll<HTMLElement>(".ledger-page");

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        // 縦横比を保ちつつA4に収める
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
      }

      const safeName = `${caseData.requestNumber}_${caseData.storeName}`.replace(
        /[\\/:*?"<>|]/g,
        "_"
      );
      pdf.save(`写真台帳_${safeName}.pdf`);
      toast.success("PDFをダウンロードしました");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PDF生成に失敗しました";
      toast.error(msg);
    } finally {
      // 差し替えた画像のsrcを元に戻す（画面表示を復元）
      imgs.forEach((img, idx) => {
        if (originalSrcs[idx]) img.src = originalSrcs[idx];
      });
      setGenerating(false);
    }
  };

  // 写真種別ごとの並び順
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

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      const ai = PHOTO_TYPE_ORDER.indexOf(a.photoType);
      const bi = PHOTO_TYPE_ORDER.indexOf(b.photoType);
      if (ai !== bi) return ai - bi;
      return a.orderNo - b.orderNo;
    });
  }, [photos]);

  // 2枚ずつのページにグループ化
  const pages = useMemo(() => {
    const result: typeof sortedPhotos[] = [];
    for (let i = 0; i < sortedPhotos.length; i += 2) {
      result.push(sortedPhotos.slice(i, i + 2));
    }
    return result;
  }, [sortedPhotos]);

  if (caseLoading || photosLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!caseData) {
    return <div className="text-center py-12 text-muted-foreground">案件が見つかりません</div>;
  }

  return (
    <div>
      {/* Toolbar (print時は非表示) */}
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
          <Button
            onClick={handleDownloadPDF}
            disabled={photos.length === 0 || generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {generating ? "PDF生成中..." : "PDFダウンロード"}
          </Button>
        </div>
      </div>

      {/* 台帳本体 */}
      <div ref={containerRef} className="ledger-container max-w-[800px] mx-auto">
        {/* 表紙 */}
        <section className="ledger-page bg-white border border-border/60 shadow-sm p-12 mb-6">
          <div className="text-center mb-12">
            <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-3">
              Photo Ledger
            </p>
            <h1 className="font-serif-jp text-3xl font-bold tracking-tight">写真台帳</h1>
            <div className="w-16 h-px bg-foreground/30 mx-auto mt-6" />
          </div>

          <div className="space-y-3 max-w-md mx-auto mt-12">
            <LedgerRow label="案件番号" value={caseData.requestNumber} />
            <LedgerRow label="ブランド" value={caseData.brand} />
            <LedgerRow label="店舗名" value={caseData.storeName} />
            <LedgerRow label="店舗住所" value={caseData.address || "—"} />
            <LedgerRow
              label="工事種別"
              value={`${caseData.categoryLarge || "—"} / ${caseData.categoryMedium || "—"}`}
            />
            <LedgerRow label="作業区分" value={caseData.workType || "—"} />
            <LedgerRow label="協力会社" value={caseData.contractorName || "—"} />
            <LedgerRow
              label="作成日"
              value={new Date().toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            />
          </div>

          {caseData.requestContent && (
            <div className="mt-12 max-w-md mx-auto">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
                Request
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {caseData.requestContent}
              </p>
            </div>
          )}
        </section>

        {/* 写真ページ */}
        {pages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            写真が登録されていません
          </div>
        ) : (
          pages.map((pagePhotos, pi) => (
            <section
              key={pi}
              className="ledger-page bg-white border border-border/60 shadow-sm p-10 mb-6"
            >
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-border/60">
                <div>
                  <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                    {caseData.requestNumber}
                  </p>
                  <h2 className="font-serif-jp text-base font-semibold">
                    {caseData.storeName}
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  Page {pi + 1} / {pages.length}
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
                          className="w-full h-full object-cover"
                          style={{
                            imageOrientation: "from-image",
                            transform: photo.rotation
                              ? `rotate(${photo.rotation}deg)`
                              : undefined,
                          }}
                        />
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="pb-2 border-b border-border/40">
                          <p className="text-[9px] tracking-widest text-muted-foreground uppercase">
                            Type
                          </p>
                          <p className="font-semibold font-serif-jp">{photo.photoType}</p>
                        </div>
                        <div>
                          <p className="text-[9px] tracking-widest text-muted-foreground uppercase">
                            工事項目
                          </p>
                          <p>{photo.workCategory || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] tracking-widest text-muted-foreground uppercase">
                            作業内容
                          </p>
                          <p className="leading-snug">{photo.workItem || "—"}</p>
                        </div>
                        {photo.memo && (
                          <div className="pt-2 border-t border-border/40">
                            <p className="text-[9px] tracking-widest text-muted-foreground uppercase">
                              Memo
                            </p>
                            <p className="leading-snug whitespace-pre-wrap">{photo.memo}</p>
                          </div>
                        )}
                      </div>
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
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .ledger-page {
            box-shadow: none !important;
            border: none !important;
            page-break-after: always;
            margin: 0 !important;
            padding: 20mm 18mm !important;
            min-height: 297mm;
          }
          .ledger-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-6 border-b border-border/30 pb-2">
      <dt className="text-[10px] tracking-widest text-muted-foreground uppercase w-24 shrink-0">
        {label}
      </dt>
      <dd className="text-sm flex-1 font-serif-jp">{value}</dd>
    </div>
  );
}
