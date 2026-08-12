import { getDb } from "./db";
import { expenses, cases as casesTable } from "../drizzle/schema";
import { sql, gte, lte, and, eq, isNull } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

/**
 * 月次経費レポートを生成してオーナーへ通知する
 * 毎月1日に前月分の経費を集計して送信
 */
export async function generateMonthlyExpenseReport() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // 前月の期間を計算
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth(); // 前月
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const monthLabel = `${year}年${month}月`;

  // 前月の経費を取得
  const rows = await db
    .select()
    .from(expenses)
    .where(
      and(
        gte(expenses.createdAt, startDate),
        lte(expenses.createdAt, endDate)
      )
    );

  if (rows.length === 0) {
    await notifyOwner({
      title: `📊 月次経費レポート: ${monthLabel}`,
      content: `${monthLabel}の経費データはありませんでした。`,
    });
    return;
  }

  // 集計
  const totalAmount = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const totalTax = rows.reduce((sum, r) => sum + (r.taxAmount ?? 0), 0);

  // カテゴリ別集計
  const byCategory: Record<string, { count: number; amount: number }> = {};
  for (const r of rows) {
    const cat = r.category ?? "未分類";
    if (!byCategory[cat]) byCategory[cat] = { count: 0, amount: 0 };
    byCategory[cat].count++;
    byCategory[cat].amount += r.amount ?? 0;
  }

  // 入力者別集計
  const byUser: Record<string, { count: number; amount: number }> = {};
  for (const r of rows) {
    const name = r.createdByName ?? "不明";
    if (!byUser[name]) byUser[name] = { count: 0, amount: 0 };
    byUser[name].count++;
    byUser[name].amount += r.amount ?? 0;
  }

  // 承認ステータス別
  const pending = rows.filter(r => r.approvalStatus === "pending").length;
  const approved = rows.filter(r => r.approvalStatus === "approved").length;
  const rejected = rows.filter(r => r.approvalStatus === "rejected").length;

  // レポート本文を構築
  let content = `【${monthLabel} 経費レポート】\n\n`;
  content += `■ 概要\n`;
  content += `  件数: ${rows.length}件\n`;
  content += `  合計金額: ¥${totalAmount.toLocaleString()}\n`;
  content += `  消費税合計: ¥${totalTax.toLocaleString()}\n\n`;

  content += `■ 承認状況\n`;
  content += `  承認済: ${approved}件 / 未承認: ${pending}件 / 却下: ${rejected}件\n\n`;

  content += `■ カテゴリ別\n`;
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1].amount - a[1].amount);
  for (const [cat, data] of sortedCats) {
    content += `  ${cat}: ${data.count}件 ¥${data.amount.toLocaleString()}\n`;
  }

  content += `\n■ 入力者別\n`;
  const sortedUsers = Object.entries(byUser).sort((a, b) => b[1].amount - a[1].amount);
  for (const [name, data] of sortedUsers) {
    content += `  ${name}: ${data.count}件 ¥${data.amount.toLocaleString()}\n`;
  }

  await notifyOwner({
    title: `📊 月次経費レポート: ${monthLabel} (¥${totalAmount.toLocaleString()})`,
    content,
  });
}

/**
 * 報告書PDF生成＆管理者通知
 * 夜間（2〜5時）に実行。reportStatus="completed" かつ reportPdfUrl=null の案件を対象に
 * PDFダウンロードリンクを管理者に通知する。
 * 
 * NOTE: サーバーサイドでのhtml2canvas/jsPDFはブラウザ環境が必要なため、
 * ここでは「完了した報告書がある」ことを管理者に通知し、
 * PDFはフロントエンドからダウンロードしてもらう方式とする。
 * 将来的にPuppeteer等でサーバーサイドPDF生成を実装する場合はここを拡張する。
 */
export async function generateReportPdfs() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // reportStatus="completed" かつ reportPdfGeneratedAt=null の案件を取得
  const pendingReports = await db
    .select({
      id: casesTable.id,
      storeName: casesTable.storeName,
      requestNumber: casesTable.requestNumber,
      reportCompletedBy: casesTable.reportCompletedBy,
      reportCompletedAt: casesTable.reportCompletedAt,
    })
    .from(casesTable)
    .where(
      and(
        eq(casesTable.reportStatus, "completed"),
        isNull(casesTable.reportPdfGeneratedAt)
      )
    );

  if (pendingReports.length === 0) {
    return; // 通知不要
  }

  // 各案件の報告書完了を管理者に通知
  let content = `【報告書作成完了通知】\n\n`;
  content += `以下の ${pendingReports.length} 件の報告書が作成完了しました。\n`;
  content += `アプリからPDFをダウンロードしてください。\n\n`;

  for (const report of pendingReports) {
    const completedDate = report.reportCompletedAt
      ? new Date(report.reportCompletedAt).toLocaleDateString("ja-JP")
      : "不明";
    content += `━━━━━━━━━━━━━━━━━━━━\n`;
    content += `📋 ${report.storeName} (${report.requestNumber})\n`;
    content += `   完了者: ${report.reportCompletedBy ?? "不明"}\n`;
    content += `   完了日: ${completedDate}\n`;
    content += `   URL: /cases/${report.id}/survey-report\n\n`;
  }

  // 管理者に通知
  await notifyOwner({
    title: `📋 報告書完了通知: ${pendingReports.length}件の報告書が作成完了`,
    content,
  });

  // 通知済みとしてマーク（reportPdfGeneratedAtを更新）
  for (const report of pendingReports) {
    await db.update(casesTable).set({
      reportPdfGeneratedAt: new Date(),
    }).where(eq(casesTable.id, report.id));
  }
}
