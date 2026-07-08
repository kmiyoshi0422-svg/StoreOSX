import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Loader2, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { inlineImages } from "@/lib/imageDataUrl";

interface PdfPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PDF生成対象のコンテナref */
  containerRef: React.RefObject<HTMLElement | null>;
  /** PDFファイル名（拡張子なし） */
  fileName: string;
  /** ページセレクタ（CSSクラス名）。デフォルト: ".report-page, .ledger-page" */
  pageSelector?: string;
}

export function PdfPreviewModal({
  open,
  onOpenChange,
  containerRef,
  fileName,
  pageSelector = ".report-page, .ledger-page",
}: PdfPreviewModalProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // プレビュー画像を生成
  const generatePreview = useCallback(async () => {
    if (!containerRef.current || !open) return;
    setLoading(true);
    setPages([]);
    setCurrentPage(0);
    setZoom(1);

    try {
      // フォント読み込み待ち
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 150));

      const pageElements = containerRef.current.querySelectorAll<HTMLElement>(pageSelector);
      const targets = pageElements.length > 0 ? Array.from(pageElements) : [containerRef.current];

      const previews: string[] = [];
      for (const el of targets) {
        const canvas = await html2canvas(el, {
          scale: 1.5,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 800,
        });
        previews.push(canvas.toDataURL("image/jpeg", 0.85));
      }
      setPages(previews);
    } catch (e) {
      console.error("Preview generation failed:", e);
    } finally {
      setLoading(false);
    }
  }, [containerRef, open, pageSelector]);

  useEffect(() => {
    if (open) {
      generatePreview();
    }
  }, [open, generatePreview]);

  // PDFダウンロード
  const handleDownload = async () => {
    if (!containerRef.current) return;
    setGenerating(true);

    const restore = await inlineImages(containerRef.current).catch(() => () => {});
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 100));

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const pageElements = containerRef.current.querySelectorAll<HTMLElement>(pageSelector);
      const targets = pageElements.length > 0 ? Array.from(pageElements) : [containerRef.current];

      for (let i = 0; i < targets.length; i++) {
        const canvas = await html2canvas(targets[i], {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 800,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save(`${fileName}.pdf`);
      onOpenChange(false);
    } catch (e) {
      console.error("PDF generation failed:", e);
    } finally {
      restore();
      setGenerating(false);
    }
  };

  const prevPage = () => setCurrentPage((p) => Math.max(0, p - 1));
  const nextPage = () => setCurrentPage((p) => Math.min(pages.length - 1, p + 1));
  const zoomIn = () => setZoom((z) => Math.min(2, z + 0.25));
  const zoomOut = () => setZoom((z) => Math.max(0.5, z - 0.25));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[900px] max-h-[90vh] flex flex-col p-0 gap-0">
        {/* ヘッダー */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">
              PDFプレビュー
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* ズーム */}
              <div className="flex items-center gap-1 border rounded-md px-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={zoom <= 0.5}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-medium w-10 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={zoom >= 2}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
              {/* ページナビ */}
              {pages.length > 1 && (
                <div className="flex items-center gap-1 border rounded-md px-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevPage} disabled={currentPage === 0}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs font-medium w-16 text-center">
                    {currentPage + 1} / {pages.length}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextPage} disabled={currentPage >= pages.length - 1}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {/* ダウンロード */}
              <Button size="sm" onClick={handleDownload} disabled={generating || loading}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                {generating ? "生成中..." : "PDFダウンロード"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* プレビュー本体 */}
        <div ref={scrollRef} className="flex-1 overflow-auto bg-muted/30 p-4 flex items-start justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">プレビューを生成中...</p>
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-muted-foreground">プレビューを生成できませんでした</p>
            </div>
          ) : (
            <div
              className="transition-transform duration-200 ease-out"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
            >
              <div className="bg-white shadow-lg border rounded-sm" style={{ width: "595px" }}>
                <img
                  src={pages[currentPage]}
                  alt={`Page ${currentPage + 1}`}
                  className="w-full h-auto"
                  draggable={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* フッター：ページサムネイル */}
        {pages.length > 1 && (
          <div className="border-t px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0 bg-background">
            {pages.map((src, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`flex-shrink-0 w-14 h-20 border-2 rounded overflow-hidden transition-all ${
                  i === currentPage
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <img src={src} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
