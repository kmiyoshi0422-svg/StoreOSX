import type { Case } from "../drizzle/schema";

type EligibleCase = Pick<Case, "urgency" | "requestContent" | "categoryLarge" | "categoryMedium" | "categorySmall">;

/** 自動的に全電気案件を変更対象にしない。S または明示的に漏電が記載された案件だけ。 */
export function isEmergencySurveyCase(c: EligibleCase): boolean {
  return c.urgency === "S" || [c.requestContent, c.categoryLarge, c.categoryMedium, c.categorySmall]
    .some((text) => text?.includes("漏電"));
}

/** 依頼日時と記録済み現調日を日本時間の暦日で比較（24時間以内との混同を防ぐ）。 */
export function jstCalendarDay(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function parseSurveyCalendarDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00+09:00`);
  return jstCalendarDay(date) === value ? date : null;
}

export function sameDaySurveyLabel(requestDate: Date | string | null | undefined, surveyDate: Date | string | null | undefined): "同日" | "別日" | "判定不可" {
  const requestDay = jstCalendarDay(requestDate);
  const surveyDay = jstCalendarDay(surveyDate);
  if (!requestDay || !surveyDay) return "判定不可";
  return requestDay === surveyDay ? "同日" : "別日";
}
