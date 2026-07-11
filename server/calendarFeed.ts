/**
 * ICS (iCalendar) フィード生成ヘルパー
 * 工程スケジュールをiCalendar形式で出力し、
 * Googleカレンダー/Appleカレンダー/Outlookで購読可能にする。
 */
import { getDb } from "./db";
import { caseSchedules, cases } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// ICSの日付フォーマット（終日イベント用: YYYYMMDD）
function toIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

// 終了日は翌日にする（ICSの終日イベントは排他的終了日）
function toIcsEndDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// ICSテキストのエスケープ
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// UIDを生成（安定的に同じスケジュールIDから同じUIDを生成）
function generateUid(scheduleId: number): string {
  return `schedule-${scheduleId}@store-osx.plenus`;
}

// カレンダーフィードトークンの生成
export function generateCalendarToken(): string {
  return `cal_${crypto.randomBytes(24).toString("hex")}`;
}

// カレンダーフィードトークンの検証（app_settingsから取得）
export async function validateCalendarToken(token: string): Promise<{ valid: boolean; scope: "all" | "case"; caseId?: number }> {
  const db = await getDb();
  if (!db) return { valid: false, scope: "all" };

  // 全件フィードトークンを確認
  const { appSettings } = await import("../drizzle/schema");
  const rows = await db.select().from(appSettings).where(eq(appSettings.settingKey, "calendarFeedToken"));
  if (rows.length > 0) {
    try {
      const stored = JSON.parse(rows[0].settingValue) as { token: string };
      if (stored.token === token) return { valid: true, scope: "all" };
    } catch {}
  }

  // 案件別トークンを確認
  const caseRows = await db.select().from(appSettings).where(eq(appSettings.settingKey, "calendarFeedTokens"));
  if (caseRows.length > 0) {
    try {
      const tokens = JSON.parse(caseRows[0].settingValue) as Record<string, string>;
      for (const [caseIdStr, t] of Object.entries(tokens)) {
        if (t === token) return { valid: true, scope: "case", caseId: Number(caseIdStr) };
      }
    } catch {}
  }

  return { valid: false, scope: "all" };
}

// 全件のICSフィードを生成
export async function generateAllSchedulesFeed(): Promise<string> {
  const db = await getDb();
  if (!db) return generateEmptyCalendar();

  const schedules = await db.select().from(caseSchedules);
  // 案件名を取得
  const caseIds = Array.from(new Set(schedules.map(s => s.caseId)));
  const caseMap = new Map<number, string>();
  if (caseIds.length > 0) {
    const caseRows = await db.select({ id: cases.id, storeName: cases.storeName, requestNumber: cases.requestNumber }).from(cases);
    for (const c of caseRows) {
      caseMap.set(c.id, `${c.storeName} (${c.requestNumber})`);
    }
  }

  return generateIcsContent(schedules, caseMap, "Store OSX 全工程スケジュール");
}

// 案件別のICSフィードを生成
export async function generateCaseSchedulesFeed(caseId: number): Promise<string> {
  const db = await getDb();
  if (!db) return generateEmptyCalendar();

  const schedules = await db.select().from(caseSchedules).where(eq(caseSchedules.caseId, caseId));
  const caseRows = await db.select({ id: cases.id, storeName: cases.storeName, requestNumber: cases.requestNumber }).from(cases).where(eq(cases.id, caseId));
  const caseMap = new Map<number, string>();
  if (caseRows.length > 0) {
    caseMap.set(caseRows[0].id, `${caseRows[0].storeName} (${caseRows[0].requestNumber})`);
  }

  const caseName = caseMap.get(caseId) || `案件 #${caseId}`;
  return generateIcsContent(schedules, caseMap, `Store OSX ${caseName} 工程`);
}

// ICSコンテンツ生成
function generateIcsContent(
  schedules: Array<{
    id: number;
    caseId: number;
    title: string;
    startDate: string;
    endDate: string;
    status: string;
    memo: string | null;
    progress: number;
    updatedAt: Date;
  }>,
  caseMap: Map<number, string>,
  calendarName: string,
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Store OSX//Plenus Checkbook//JP",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    "X-WR-TIMEZONE:Asia/Tokyo",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const s of schedules) {
    const caseName = caseMap.get(s.caseId) || `案件 #${s.caseId}`;
    const description = [
      `案件: ${caseName}`,
      `ステータス: ${s.status}`,
      `進捗: ${s.progress}%`,
      s.memo ? `メモ: ${s.memo}` : "",
    ].filter(Boolean).join("\\n");

    const dtstamp = s.updatedAt
      ? s.updatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
      : new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${generateUid(s.id)}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${toIcsDate(s.startDate)}`,
      `DTEND;VALUE=DATE:${toIcsEndDate(s.endDate)}`,
      `SUMMARY:${escapeIcs(`[${s.status}] ${s.title}`)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `CATEGORIES:${escapeIcs(caseName)}`,
      s.status === "完了" ? "STATUS:COMPLETED" : s.status === "進行中" ? "STATUS:IN-PROCESS" : "STATUS:TENTATIVE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function generateEmptyCalendar(): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Store OSX//Plenus Checkbook//JP",
    "X-WR-CALNAME:Store OSX 工程スケジュール",
    "X-WR-TIMEZONE:Asia/Tokyo",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "END:VCALENDAR",
  ].join("\r\n");
}
