import jsPDF from "jspdf";

/** A4プレビューと同じJPEGページだけからPDFを構成する。DOMの再キャプチャはしない。 */
export function createReportPdfFromPages(pages: readonly string[]): jsPDF {
  if (!pages.length || pages.some((page) => !page.startsWith("data:image/jpeg;base64,"))) {
    throw new Error("PDFプレビューが未完了です。A4レイアウトを再確認してください");
  }
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage();
    pdf.addImage(pages[i], "JPEG", 0, 0, width, height, undefined, "FAST");
  }
  return pdf;
}
