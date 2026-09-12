export type ReportPdfProfile = {
  renderScale: number;
  jpegQuality: number;
  maxImageEdge: number;
  imageQuality: number;
  imageConcurrency: number;
};

/**
 * 写真付き報告書の負荷に応じて、PDF生成時のメモリ使用量を抑える。
 * 44枚などの大量写真でも、フル解像度画像を同時展開しない設定を返す。
 */
export function getReportPdfProfile(
  totalPages: number,
  photoCount: number,
  lowMemoryDevice = false,
): ReportPdfProfile {
  const isVeryHeavy = lowMemoryDevice || photoCount > 30 || totalPages > 10;
  const isHeavy = photoCount > 16 || totalPages > 6;

  if (isVeryHeavy) {
    return {
      renderScale: 1,
      jpegQuality: 0.68,
      maxImageEdge: 1024,
      imageQuality: 0.76,
      imageConcurrency: 2,
    };
  }

  if (isHeavy) {
    return {
      renderScale: 1.25,
      jpegQuality: 0.74,
      maxImageEdge: 1280,
      imageQuality: 0.8,
      imageConcurrency: 3,
    };
  }

  return {
    renderScale: totalPages > 3 ? 1.5 : 1.7,
    jpegQuality: 0.82,
    maxImageEdge: 1600,
    imageQuality: 0.84,
    imageConcurrency: 4,
  };
}

/** iPhone/iPadや端末メモリ4GB以下では安全側のプロファイルを使う。 */
export function isLowMemoryBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/i.test(ua);
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return isAppleMobile || (typeof deviceMemory === "number" && deviceMemory <= 4);
}
