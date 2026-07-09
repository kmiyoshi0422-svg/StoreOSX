import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2, Printer, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Move } from "lucide-react";
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

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200, 300];
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.1;

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
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // ズームリセット（ページ変更時）
  const resetView = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // プレビュー画像を生成
  const generatePreview = useCallback(async () => {
    if (!containerRef.current || !open) return;
    setLoading(true);
    setPages([]);
    setCurrentPage(0);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });

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
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 800,
        });
        previews.push(canvas.toDataURL("image/jpeg", 0.9));
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

  // マウスホイールでズーム
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !open) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.002;
        setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)));
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [open]);

  // キーボードショートカット
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
        }
      } else if (e.key === "-") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
        }
      } else if (e.key === "0") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom(1);
          setPanOffset({ x: 0, y: 0 });
        }
      } else if (e.key === "ArrowLeft") {
        setCurrentPage((p) => Math.max(0, p - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentPage((p) => Math.min(pages.length - 1, p + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, pages.length]);

  // ドラッグでパン（ズーム時のみ）
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return;
      e.preventDefault();
      setIsPanning(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    },
    [zoom, panOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !dragStart) return;
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isPanning, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDragStart(null);
  }, []);

  // ブラウザ印刷
  const handlePrint = useCallback(() => {
    if (pages.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const imagesHtml = pages
      .map(
        (src) =>
          `<div class="page"><img src="${src}" /></div>`,
      )
      .join("");
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${fileName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 0; }
  body { background: #fff; }
  .page { page-break-after: always; width: 100%; display: flex; align-items: flex-start; justify-content: center; }
  .page:last-child { page-break-after: auto; }
  .page img { width: 100%; height: auto; display: block; }
</style>
</head><body>${imagesHtml}</body></html>`);
    printWindow.document.close();
    const imgs = printWindow.document.querySelectorAll("img");
    let loaded = 0;
    const tryPrint = () => {
      loaded++;
      if (loaded >= imgs.length) {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 200);
      }
    };
    if (imgs.length === 0) {
      printWindow.print();
    } else {
      imgs.forEach((img) => {
        if (img.complete) {
          tryPrint();
        } else {
          img.onload = tryPrint;
          img.onerror = tryPrint;
        }
      });
    }
  }, [pages, fileName]);

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

  const prevPage = () => {
    setCurrentPage((p) => Math.max(0, p - 1));
    resetView();
  };
  const nextPage = () => {
    setCurrentPage((p) => Math.min(pages.length - 1, p + 1));
    resetView();
  };
  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + 0.25));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, z - 0.25));
  const fitToWidth = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1000px] max-h-[95vh] flex flex-col p-0 gap-0">
        {/* ヘッダー */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">
              PDFプレビュー
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* ズームコントロール */}
              <div className="flex items-center gap-0.5 border rounded-md px-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} title="縮小 (Ctrl+-)">
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-7 px-1.5 text-xs font-medium min-w-[48px]">
                      {zoomPercent}%
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="min-w-[80px]">
                    {ZOOM_PRESETS.map((preset) => (
                      <DropdownMenuItem
                        key={preset}
                        onClick={() => { setZoom(preset / 100); setPanOffset({ x: 0, y: 0 }); }}
                        className={`text-xs ${zoomPercent === preset ? "font-bold" : ""}`}
                      >
                        {preset}%
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} title="拡大 (Ctrl++)">
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-border mx-0.5" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fitToWidth} title="幅に合わせる (Ctrl+0)">
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {/* ページナビ */}
              {pages.length > 1 && (
                <div className="flex items-center gap-0.5 border rounded-md px-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevPage} disabled={currentPage === 0} title="前のページ (←)">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs font-medium w-16 text-center">
                    {currentPage + 1} / {pages.length}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextPage} disabled={currentPage >= pages.length - 1} title="次のページ (→)">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {/* 印刷 */}
              <Button size="sm" variant="outline" onClick={handlePrint} disabled={loading || pages.length === 0}>
                <Printer className="h-4 w-4 mr-1" />
                印刷
              </Button>
              {/* ダウンロード */}
              <Button size="sm" onClick={handleDownload} disabled={generating || loading}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                {generating ? "生成中..." : "PDFダウンロード"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ズームヒント */}
        {zoom > 1 && (
          <div className="px-4 py-1.5 bg-muted/50 border-b flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
            <Move className="h-3 w-3" />
            <span>ドラッグで表示位置を移動できます</span>
            <span className="mx-1">|</span>
            <span>Ctrl+ホイール: ズーム</span>
            <span className="mx-1">|</span>
            <span>Ctrl+0: リセット</span>
          </div>
        )}

        {/* プレビュー本体 */}
        <div
          ref={scrollRef}
          className={`flex-1 overflow-auto bg-muted/30 p-4 flex items-start justify-center ${
            zoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
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
              ref={imageRef}
              className="transition-transform duration-150 ease-out select-none"
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                transformOrigin: "top center",
              }}
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
                onClick={() => { setCurrentPage(i); resetView(); }}
                className={`flex-shrink-0 w-14 h-20 border-2 rounded overflow-hidden transition-all ${
                  i === currentPage
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <img src={src} alt={`Page ${i + 1}`} className="w-full h-full object-cover" draggable={false} />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
