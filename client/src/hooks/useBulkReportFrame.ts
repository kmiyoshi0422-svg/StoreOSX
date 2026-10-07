import { useEffect, useRef, type RefObject } from "react";
import html2canvas from "html2canvas-pro";
import { clearDataUrlCache, inlineImages } from "@/lib/imageDataUrl";
import { getReportPdfProfile, isLowMemoryBrowser } from "@/lib/reportPdfProfile";
import { createReportPdfFromPages } from "@/lib/reportPdfPages";

export async function captureBulkReportPdf(container: HTMLElement, photoCount: number): Promise<{ bytes: ArrayBuffer; pageCount: number }> {
  let restore = () => {};
  try {
    await document.fonts?.ready;
    await new Promise((resolve) => setTimeout(resolve, 180));
    const pages = Array.from(container.querySelectorAll<HTMLElement>(".report-page"));
    if (!pages.length) throw new Error("A4報告書ページがありません");
    const profile = getReportPdfProfile(pages.length, photoCount, isLowMemoryBrowser());
    restore = await inlineImages(container, { maxEdge: profile.maxImageEdge, quality: profile.imageQuality,
      concurrency: profile.imageConcurrency, strict: true });
    const jpegs: string[] = [];
    for (const page of pages) {
      const canvas = await html2canvas(page, { scale: profile.renderScale, useCORS: true,
        allowTaint: false, backgroundColor: "#ffffff", logging: false, windowWidth: 800,
        imageTimeout: 30_000, removeContainer: true });
      jpegs.push(canvas.toDataURL("image/jpeg", profile.jpegQuality));
      canvas.width = canvas.height = 0;
    }
    return { bytes: createReportPdfFromPages(jpegs).output("arraybuffer"), pageCount: jpegs.length };
  } finally {
    restore();
    clearDataUrlCache();
  }
}

/** 同一オリジンの一括報告書画面からだけ使用。通常の編集・プレビュー導線は変更しない。 */
export function useBulkReportFrame(params: {
  caseId: number;
  type: "現場調査報告書" | "施工完了報告書";
  containerRef: RefObject<HTMLDivElement | null>;
  ready: boolean;
  failed: boolean;
  photoCount: number;
}) {
  const runRef = useRef<string | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("bulkZipToken");
    if (!token || window.parent === window || runRef.current === token || (!params.ready && !params.failed)) return;
    runRef.current = token;
    const send = (result: Record<string, unknown>, buffer?: ArrayBuffer) => {
      window.parent.postMessage({ source: "storeosx-report-bulk", token, caseId: params.caseId,
        reportType: params.type, ...result }, window.location.origin, buffer ? [buffer] : []);
    };
    if (params.failed) { send({ error: "案件データの取得に失敗しました" }); return; }
    void (async () => {
      try {
        const container = params.containerRef.current;
        if (!container) throw new Error("報告書が読み込まれていません");
        const { bytes, pageCount } = await captureBulkReportPdf(container, params.photoCount);
        send({ pageCount, bytes }, bytes);
      } catch (error) {
        send({ error: error instanceof Error ? error.message : "報告書のPDF生成に失敗しました" });
      }
    })();
  }, [params.caseId, params.type, params.containerRef, params.ready, params.failed, params.photoCount]);
}
