import jsPDF from "jspdf";
import { toast } from "sonner";
import type { Case } from "../../../drizzle/schema";
import {
  toFullWidthDigits as _toFullWidthDigits,
  reportLabel as _reportLabel,
} from "../../../shared/reportText";

// jsPDFは日本語フォントが標準で含まれないため、html2canvasベースで作成
// Tailwind4のoklch色をサポートする html2canvas-pro を使用
import html2canvas from "html2canvas-pro";

// PDF生成中に適用する除外辞書（全角化・括弧除去の対象外にする語）。
// generateXxxPDF 呼び出し時にセットし、内部のラッパー経由で参照する。
let _exclusions: string[] = [];

// 既存の呼び出し名（toFullWidthDigits / reportLabel）を維持したまま、
// モジュールスコープの除外辞書を自動適用するローカルラッパー。
function toFullWidthDigits(input: string | number | null | undefined): string {
  return _toFullWidthDigits(input, _exclusions);
}
function reportLabel(input: string | number | null | undefined): string {
  return _reportLabel(input, _exclusions);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return toFullWidthDigits(new Date(d).toLocaleDateString("ja-JP"));
}
function fmtYen(n: number | null | undefined): string {
  if (n == null) return "—";
  return `￥${toFullWidthDigits(n.toLocaleString())}`;
}

function buildQuoteHTML(c: Case): string {
  const tax = c.estimatedCost ? Math.floor(c.estimatedCost * 0.1) : 0;
  const total = (c.estimatedCost ?? 0) + tax;
  return `
  <div style="width:794px; padding:48px; font-family: 'Noto Serif JP', serif; color:#1a2238; background:#fff; box-sizing:border-box;">
    <div style="text-align:center; border-bottom:2px solid #1a2238; padding-bottom:16px; margin-bottom:32px;">
      <p style="letter-spacing:0.3em; font-size:11px; color:#666; margin:0;">QUOTATION</p>
      <h1 style="font-size:32px; margin:8px 0 0; font-weight:600;">御 見 積 書</h1>
    </div>

    <div style="display:flex; justify-content:space-between; margin-bottom:32px;">
      <div>
        <p style="font-size:14px; margin:0 0 8px;"><strong>${reportLabel(c.storeName)}</strong> 御中</p>
        <p style="font-size:12px; color:#555; margin:0;">下記のとおりお見積り申し上げます。</p>
      </div>
      <div style="font-size:11px; text-align:right;">
        <p style="margin:0 0 4px;">見積番号: ${toFullWidthDigits(c.requestNumber)}</p>
        <p style="margin:0 0 4px;">発行日: ${fmtDate(new Date())}</p>
      </div>
    </div>

    <div style="border:1px solid #1a2238; padding:20px; margin-bottom:24px; background:#f9f8f5;">
      <p style="font-size:12px; color:#666; margin:0 0 6px;">御見積金額　税込</p>
      <p style="font-size:32px; font-family:'Noto Serif JP', serif; font-weight:600; margin:0; color:#1a2238;">
        ${fmtYen(total)}
      </p>
    </div>

    <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:24px;">
      <thead>
        <tr style="background:#1a2238; color:#fff;">
          <th style="padding:10px; text-align:left; border:1px solid #1a2238;">項目</th>
          <th style="padding:10px; text-align:left; border:1px solid #1a2238;">内容</th>
          <th style="padding:10px; text-align:right; border:1px solid #1a2238; width:140px;">金額</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:10px; border:1px solid #ddd;">工事種別</td>
          <td style="padding:10px; border:1px solid #ddd;">${[c.categoryLarge, c.categoryMedium, c.categorySmall].filter(Boolean).map((v) => reportLabel(v as string)).join("　・　") || "—"}</td>
          <td style="padding:10px; border:1px solid #ddd; text-align:right;">—</td>
        </tr>
        <tr>
          <td style="padding:10px; border:1px solid #ddd;">作業区分</td>
          <td style="padding:10px; border:1px solid #ddd;">${c.workType ? reportLabel(c.workType) : "—"}</td>
          <td style="padding:10px; border:1px solid #ddd; text-align:right;">—</td>
        </tr>
        <tr>
          <td style="padding:10px; border:1px solid #ddd;">材料費</td>
          <td style="padding:10px; border:1px solid #ddd;">${c.requestContent ? reportLabel(c.requestContent) : "—"}</td>
          <td style="padding:10px; border:1px solid #ddd; text-align:right;">${fmtYen(c.estimatedMaterialCost)}</td>
        </tr>
        <tr>
          <td style="padding:10px; border:1px solid #ddd;">作業費</td>
          <td style="padding:10px; border:1px solid #ddd;">技術者作業費</td>
          <td style="padding:10px; border:1px solid #ddd; text-align:right;">${fmtYen(c.estimatedLaborCost)}</td>
        </tr>
        <tr style="background:#f9f8f5;">
          <td colspan="2" style="padding:10px; border:1px solid #ddd; text-align:right;">小計</td>
          <td style="padding:10px; border:1px solid #ddd; text-align:right;">${fmtYen(c.estimatedCost)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:10px; border:1px solid #ddd; text-align:right;">消費税　１０％</td>
          <td style="padding:10px; border:1px solid #ddd; text-align:right;">${fmtYen(tax)}</td>
        </tr>
        <tr style="background:#1a2238; color:#fff;">
          <td colspan="2" style="padding:12px; border:1px solid #1a2238; text-align:right; font-weight:600;">合計</td>
          <td style="padding:12px; border:1px solid #1a2238; text-align:right; font-weight:600;">${fmtYen(total)}</td>
        </tr>
      </tbody>
    </table>

    <div style="font-size:11px; color:#555;">
      <p style="margin:0 0 4px;">■ 備考</p>
      <p style="margin:0 0 4px; white-space:pre-wrap;">${c.notes ? reportLabel(c.notes) : "—"}</p>
    </div>

    ${c.contractorName ? `
    <div style="margin-top:48px; border-top:1px solid #ddd; padding-top:16px; text-align:right; font-size:12px;">
      <p style="margin:0 0 4px; font-weight:600;">${reportLabel(c.contractorName)}</p>
      <p style="margin:0 0 4px;">${c.contractorPic ? reportLabel(c.contractorPic) : ""}</p>
      <p style="margin:0;">${c.contractorPhone ? toFullWidthDigits(c.contractorPhone) : ""}</p>
    </div>` : ""}
  </div>`;
}

function buildCompletionHTML(c: Case): string {
  return `
  <div style="width:794px; padding:48px; font-family: 'Noto Serif JP', serif; color:#1a2238; background:#fff; box-sizing:border-box;">
    <div style="text-align:center; border-bottom:2px solid #1a2238; padding-bottom:16px; margin-bottom:32px;">
      <p style="letter-spacing:0.3em; font-size:11px; color:#666; margin:0;">COMPLETION REPORT</p>
      <h1 style="font-size:32px; margin:8px 0 0; font-weight:600;">完 了 報 告 書</h1>
    </div>

    <div style="display:flex; justify-content:space-between; margin-bottom:32px;">
      <div>
        <p style="font-size:14px; margin:0 0 8px;"><strong>${reportLabel(c.storeName)}</strong> 御中</p>
        <p style="font-size:12px; color:#555; margin:0;">下記のとおり工事完了をご報告いたします。</p>
      </div>
      <div style="font-size:11px; text-align:right;">
        <p style="margin:0 0 4px;">案件番号: ${toFullWidthDigits(c.requestNumber)}</p>
        <p style="margin:0 0 4px;">報告日: ${fmtDate(new Date())}</p>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:24px;">
      <tr>
        <th style="padding:10px; border:1px solid #ddd; background:#f9f8f5; text-align:left; width:160px;">店舗名</th>
        <td style="padding:10px; border:1px solid #ddd;">${reportLabel(c.storeName)}</td>
      </tr>
      <tr>
        <th style="padding:10px; border:1px solid #ddd; background:#f9f8f5; text-align:left;">住所</th>
        <td style="padding:10px; border:1px solid #ddd;">${c.address ? toFullWidthDigits(c.address) : "—"}</td>
      </tr>
      <tr>
        <th style="padding:10px; border:1px solid #ddd; background:#f9f8f5; text-align:left;">工事種別</th>
        <td style="padding:10px; border:1px solid #ddd;">${[c.categoryLarge, c.categoryMedium, c.categorySmall].filter(Boolean).map((v) => reportLabel(v as string)).join("　・　") || "—"}</td>
      </tr>
      <tr>
        <th style="padding:10px; border:1px solid #ddd; background:#f9f8f5; text-align:left;">作業区分</th>
        <td style="padding:10px; border:1px solid #ddd;">${c.workType ? reportLabel(c.workType) : "—"}</td>
      </tr>
      <tr>
        <th style="padding:10px; border:1px solid #ddd; background:#f9f8f5; text-align:left;">現調日</th>
        <td style="padding:10px; border:1px solid #ddd;">${fmtDate(c.surveyDate)}</td>
      </tr>
      <tr>
        <th style="padding:10px; border:1px solid #ddd; background:#f9f8f5; text-align:left;">施工日</th>
        <td style="padding:10px; border:1px solid #ddd;">${fmtDate(c.constructionDate)}</td>
      </tr>
      <tr>
        <th style="padding:10px; border:1px solid #ddd; background:#f9f8f5; text-align:left;">完了日</th>
        <td style="padding:10px; border:1px solid #ddd;">${fmtDate(c.completedAt ?? c.updatedAt)}</td>
      </tr>
    </table>

    <div style="margin-bottom:24px;">
      <p style="font-size:13px; font-weight:600; border-left:3px solid #1a2238; padding-left:10px; margin:0 0 10px;">作業内容</p>
      <p style="font-size:12px; white-space:pre-wrap; line-height:1.8; margin:0 0 0 13px;">${c.requestContent ? reportLabel(c.requestContent) : "—"}</p>
    </div>

    <div style="margin-bottom:24px;">
      <p style="font-size:13px; font-weight:600; border-left:3px solid #1a2238; padding-left:10px; margin:0 0 10px;">作業金額</p>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr>
          <th style="padding:8px; border:1px solid #ddd; background:#f9f8f5; text-align:left; width:160px;">見積金額</th>
          <td style="padding:8px; border:1px solid #ddd; text-align:right;">${fmtYen(c.estimatedCost)}</td>
        </tr>
        <tr>
          <th style="padding:8px; border:1px solid #ddd; background:#f9f8f5; text-align:left;">実績金額</th>
          <td style="padding:8px; border:1px solid #ddd; text-align:right;">${fmtYen(c.actualCost)}</td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom:24px;">
      <p style="font-size:13px; font-weight:600; border-left:3px solid #1a2238; padding-left:10px; margin:0 0 10px;">備考</p>
      <p style="font-size:12px; white-space:pre-wrap; margin:0 0 0 13px;">${c.notes ? reportLabel(c.notes) : "—"}</p>
    </div>

    ${c.contractorName ? `
    <div style="margin-top:48px; border-top:1px solid #ddd; padding-top:16px; text-align:right; font-size:12px;">
      <p style="margin:0 0 4px; font-weight:600;">${reportLabel(c.contractorName)}</p>
      <p style="margin:0 0 4px;">担当：${c.contractorPic ? reportLabel(c.contractorPic) : ""}</p>
      <p style="margin:0;">${c.contractorPhone ? toFullWidthDigits(c.contractorPhone) : ""}</p>
    </div>` : ""}
  </div>`;
}

async function htmlToPDF(html: string, fileName: string) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const target = container.firstElementChild as HTMLElement;
    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const ratio = canvas.height / canvas.width;
    let imgWidth = pdfWidth;
    let imgHeight = pdfWidth * ratio;
    if (imgHeight > pdfHeight) {
      imgHeight = pdfHeight;
      imgWidth = pdfHeight / ratio;
    }
    const x = (pdfWidth - imgWidth) / 2;
    const y = 0;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", x, y, imgWidth, imgHeight);
    pdf.save(fileName);
    toast.success("PDFをダウンロードしました");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "PDF生成に失敗しました");
  } finally {
    document.body.removeChild(container);
  }
}

function safeName(c: Case): string {
  return `${toFullWidthDigits(c.requestNumber)}_${c.storeName}`.replace(/[\\/:*?"<>|]/g, "_");
}

export async function generateQuotePDF(c: Case, exclusions: string[] = []) {
  _exclusions = exclusions;
  await htmlToPDF(buildQuoteHTML(c), `見積書_${safeName(c)}.pdf`);
}

export async function generateCompletionReportPDF(c: Case, exclusions: string[] = []) {
  _exclusions = exclusions;
  await htmlToPDF(buildCompletionHTML(c), `完了報告書_${safeName(c)}.pdf`);
}
