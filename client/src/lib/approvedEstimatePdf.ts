import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import type { ApprovedEstimate } from "../../../shared/estimateAssistant";

/** 氏名・住所・明細はDOMのtextContentのみへ挿入し、HTMLとして解釈しない。 */
const node = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text?: string
) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const date = (millis: number) =>
  new Date(millis).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });

/** 結果をDOMとして作りページごとに画像化する。印刷文字の途中で改ページしない。 */
export async function downloadApprovedEstimatePdf(
  quote: ApprovedEstimate
): Promise<void> {
  if (!quote?.approvedAt || !quote.items?.length || !quote.issuer?.companyName)
    throw new Error("承認済みの見積書がありません");
  const host = node("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-1;width:794px;font-family:'Noto Sans JP',sans-serif;color:#15283b;";
  const style = node("style");
  style.textContent = `
    .quote-page{position:relative;box-sizing:border-box;width:794px;height:1123px;padding:46px 54px;background:#fff;overflow:hidden;font-family:'Noto Sans JP',sans-serif;color:#15283b}
    .quote-kicker{font-size:10px;letter-spacing:3px;color:#778799}
    .quote-title{margin:5px 0 16px;font-size:29px;letter-spacing:5px;text-align:center;font-weight:700;border-bottom:3px solid #17304c;padding-bottom:12px}
    .quote-header{display:flex;justify-content:space-between;gap:14px;font-size:12px;line-height:1.6;margin-bottom:16px}
    .quote-recipient{font-size:16px;font-weight:700}.quote-meta{text-align:right;white-space:pre-line;overflow-wrap:anywhere;max-width:245px;font-size:11px}
    .quote-amount{display:flex;justify-content:space-between;align-items:center;border:1px solid #17304c;background:#eff4f8;padding:11px 16px;margin-bottom:17px;font-size:12px}
    .quote-amount strong{font-size:21px;color:#17304c}
    .quote-table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:11px}
    .quote-table th{background:#17304c;color:white;padding:8px 6px;text-align:left}
    .quote-table td{border-bottom:1px solid #d9e1e8;padding:9px 6px;vertical-align:top;overflow-wrap:anywhere;line-height:1.5}
    .quote-table .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .quote-spec{color:#657489;font-size:10px;margin-top:3px;white-space:pre-wrap}
    .quote-footer{position:absolute;bottom:38px;left:54px;right:54px;border-top:1px solid #c7d3df;padding-top:11px;font-size:10px;color:#637285}
    .quote-summary{display:flex;justify-content:flex-end;margin-top:20px;font-size:12px}
    .quote-summary dl{width:260px;margin:0}.quote-summary div{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #c7d3df}
    .quote-summary .total{font-size:16px;font-weight:700;color:#17304c;border-bottom:2px solid #17304c}
  `;
  host.appendChild(style);
  document.body.appendChild(host);
  const pages: HTMLElement[] = [];
  let tableBody!: HTMLTableSectionElement;
  let page!: HTMLElement;
  const addPage = () => {
    page = node("div", "quote-page");
    const kicker = node("div", "quote-kicker", "STORE OSX   /   QUOTATION");
    const title = node("h1", "quote-title", "御 見 積 書");
    const head = node("div", "quote-header");
    const left = node("div");
    left.append(
      node("div", "quote-recipient", quote.recipient),
      node("div", "", `${quote.storeName}　${quote.title}`),
      node("div", "", `施工場所：${quote.siteAddress || "—"}`),
      node("div", "", "下記のとおりお見積り申し上げます。")
    );
    head.append(
      left,
      node(
        "div",
        "quote-meta",
        `見積番号：${quote.requestNumber}-${quote.draftId}\n発行日：${date(quote.approvedAt)}\n承認者：${quote.approvedByName}`
      )
    );
    const amount = node("div", "quote-amount");
    amount.append(
      node("span", "", "御見積金額（税込）"),
      node("strong", "", yen(quote.total))
    );
    const table = node("table", "quote-table");
    const colgroup = node("colgroup");
    for (const w of ["46%", "9%", "8%", "17%", "20%"]) {
      const col = node("col");
      col.style.width = w;
      colgroup.appendChild(col);
    }
    const thead = node("thead");
    const heading = node("tr");
    for (const label of [
      "工事内容・規格",
      "数量",
      "単位",
      "単価（税抜）",
      "金額（税抜）",
    ])
      heading.appendChild(node("th", "", label));
    thead.appendChild(heading);
    tableBody = node("tbody");
    table.append(colgroup, thead, tableBody);
    const issuer = node("div", "quote-footer");
    issuer.append(
      node("strong", "", quote.issuer.companyName),
      node(
        "span",
        "",
        `　担当 ${quote.issuer.personName}　／　${quote.issuer.tel}　／　${quote.issuer.email}`
      )
    );
    page.append(kicker, title, head, amount, table, issuer);
    host.appendChild(page);
    pages.push(page);
  };
  try {
    await document.fonts?.ready;
    addPage();
    for (let i = 0; i < quote.items.length; i++) {
      const item = quote.items[i];
      const row = node("tr");
      const desc = node("td");
      desc.append(
        node("strong", "", item.name),
        node("div", "quote-spec", `${item.specification}${item.note ? `\n条件：${item.note}` : ""}`)
      );
      row.append(
        desc,
        node("td", "r", String(item.quantity)),
        node("td", "", item.unit),
        node("td", "r", yen(item.unitPrice)),
        node("td", "r", yen(Math.round(item.unitPrice * item.quantity)))
      );
      tableBody.appendChild(row);
      // フッターと集計欄用に最低160px確保。行ごとの高さを測り途中文字の切断を避ける。
      if (
        row.getBoundingClientRect().bottom >
          page.getBoundingClientRect().bottom - 175 &&
        tableBody.children.length > 1
      ) {
        tableBody.removeChild(row);
        addPage();
        tableBody.appendChild(row);
      }
      if (
        row.getBoundingClientRect().bottom >
        page.getBoundingClientRect().bottom - 80
      )
        throw new Error(
          "非常に長い明細があります。規格・寸法の記述を分割してください"
        );
    }
    const summary = node("div", "quote-summary");
    const dl = node("dl");
    for (const [label, value, className] of [
      ["小計", quote.subtotal, ""],
      ["消費税（10%）", quote.tax, ""],
      ["合計（税込）", quote.total, "total"],
    ] as const) {
      const line = node("div", className);
      line.append(node("dt", "", label), node("dd", "", yen(value)));
      dl.appendChild(line);
    }
    summary.appendChild(dl);
    page.insertBefore(summary, page.lastChild);
    if (
      summary.getBoundingClientRect().bottom >
      page.getBoundingClientRect().bottom - 80
    ) {
      page.removeChild(summary);
      addPage();
      page.insertBefore(summary, page.lastChild);
    }
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        backgroundColor: "#fff",
        windowWidth: 794,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });
      if (i) pdf.addPage();
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.88),
        "JPEG",
        0,
        0,
        210,
        297
      );
    }
    const filename =
      `正式見積書_${quote.requestNumber}_${quote.draftId}.pdf`.replace(
        /[\\/:*?"<>|]/g,
        "_"
      );
    pdf.save(filename);
  } finally {
    host.remove();
  }
}
