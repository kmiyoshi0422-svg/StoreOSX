import { calcBudget } from "./budget";

export const DASHBOARD_STATUS_ORDER = [
  "受付",
  "現調中",
  "見積中",
  "施工待ち",
  "施工中",
  "完了",
  "クローズ",
  "失注",
] as const;

export const DASHBOARD_URGENCY_ORDER = ["S", "A", "B", "C"] as const;

export type DashboardCaseInput = {
  id: number;
  requestNumber: string;
  brand?: string | null;
  storeName: string;
  storeCode?: string | null;
  prefecture?: string | null;
  status: string;
  progressStage?: string | null;
  urgency: string;
  requestDate?: Date | string | null;
  createdAt?: Date | string | null;
  constructionDate?: Date | string | null;
  requestContent?: string | null;
  categoryLarge?: string | null;
  categoryMedium?: string | null;
  categorySmall?: string | null;
  notes?: string | null;
  surveyDate?: Date | string | null;
  revisitCount?: number | null;
  assigneeId?: number | null;
  assigneeName?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  lostReason?: string | null;
  lostReasonDetail?: string | null;
  lostAt?: Date | string | null;
  lostBy?: number | null;
  preLostStatus?: string | null;
};

export type DashboardBreakdownRow = {
  key: string;
  label: string;
  value: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const LEAKAGE_RELATED_KEYWORDS = [
  "漏電",
  "ブレーカー",
  "停電",
  "絶縁",
  "ヒューズ",
  "電気が落ち",
  "電源が落ち",
] as const;

function startOfDay(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function constructionWeek(value?: Date | string | null) {
  if (!value) return { constructionDate: null, constructionWeekStart: null, constructionWeekEnd: null };
  const date = startOfDay(value);
  if (!date) return { constructionDate: null, constructionWeekStart: null, constructionWeekEnd: null };
  const mondayOffset = (date.getDay() + 6) % 7;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return { constructionDate: date, constructionWeekStart: weekStart, constructionWeekEnd: weekEnd };
}

function subtractCalendarMonths(date: Date, months: number) {
  const result = new Date(date.getFullYear(), date.getMonth() - months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
}

export function isLeakageRelated(item: DashboardCaseInput) {
  const searchable = [
    item.requestContent,
    item.categoryLarge,
    item.categoryMedium,
    item.categorySmall,
    item.notes,
  ].filter(Boolean).join(" ").toLowerCase();
  return LEAKAGE_RELATED_KEYWORDS.some((keyword) => searchable.includes(keyword.toLowerCase()));
}

export function selectPreferredConstructionDate(
  values: Array<Date | string | null | undefined>,
  now: Date = new Date(),
) {
  const today = startOfDay(now) ?? new Date();
  const dates = values
    .map((value) => value ? startOfDay(value) : null)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime());
  return dates.find((date) => date.getTime() >= today.getTime()) ?? dates.at(-1) ?? null;
}

export function buildDashboardOverview(
  cases: DashboardCaseInput[],
  options: { includeFinancials: boolean; now?: Date },
) {
  const today = startOfDay(options.now ?? new Date()) ?? new Date();
  const inProgressStatuses = new Set(["現調中", "見積中", "施工待ち", "施工中"]);
  const inProgress = cases.filter((item) => inProgressStatuses.has(item.status));
  const urgent = cases.filter((item) => item.urgency === "S" || item.urgency === "A");
  const completedStatuses = new Set(["完了", "クローズ", "失注"]);
  const completed = cases.filter((item) => completedStatuses.has(item.status));
  const surveyed = cases.filter((item) => Boolean(item.surveyDate));
  const noRevisit = surveyed.filter((item) => (item.revisitCount ?? 0) === 0);
  const unfinishedCases = cases
    .filter((item) => !completedStatuses.has(item.status))
    .map((item) => {
      const requestedAt = item.requestDate ?? item.createdAt;
      const requestDay = requestedAt ? startOfDay(requestedAt) : null;
      if (!requestDay) return null;
      const daysElapsed = Math.floor((today.getTime() - requestDay.getTime()) / DAY_MS);
      return {
        ...item,
        requestDate: requestDay,
        daysElapsed,
        ...constructionWeek(item.constructionDate),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.daysElapsed - a.daysElapsed);
  const oneMonthAgo = subtractCalendarMonths(today, 1);
  const threeMonthsAgo = subtractCalendarMonths(today, 3);
  const attentionCases = {
    threeMonthsOrMore: unfinishedCases.filter((item) => item.requestDate.getTime() <= threeMonthsAgo.getTime()),
    oneToThreeMonths: unfinishedCases.filter((item) => {
      const time = item.requestDate.getTime();
      return time <= oneMonthAgo.getTime() && time > threeMonthsAgo.getTime();
    }),
    leakageRelated: unfinishedCases.filter(isLeakageRelated),
    lost: cases
      .filter((item) => item.status === "失注")
      .map((item) => {
        const requestedAt = item.requestDate ?? item.createdAt;
        const requestDay = requestedAt ? startOfDay(requestedAt) : today;
        return {
          ...item,
          requestDate: requestDay ?? today,
          daysElapsed: requestDay
            ? Math.floor((today.getTime() - requestDay.getTime()) / DAY_MS)
            : 0,
          ...constructionWeek(item.constructionDate),
        };
      })
      .sort((a, b) => {
        const aTime = a.lostAt ? new Date(a.lostAt).getTime() : 0;
        const bTime = b.lostAt ? new Date(b.lostAt).getTime() : 0;
        return bTime - aTime;
      }),
  };

  const statusBreakdown: DashboardBreakdownRow[] = DASHBOARD_STATUS_ORDER.map((status) => ({
    key: status,
    label: status,
    value: cases.filter((item) => item.status === status).length,
  }));

  const urgencyLabels: Record<string, string> = {
    S: "S 緊急",
    A: "A 高",
    B: "B 中",
    C: "C 低",
  };
  const urgencyBreakdown: DashboardBreakdownRow[] = DASHBOARD_URGENCY_ORDER.map((urgency) => ({
    key: urgency,
    label: urgencyLabels[urgency],
    value: cases.filter((item) => item.urgency === urgency).length,
  }));

  const totalEstimated = cases.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0);
  const totalActual = cases.reduce((sum, item) => sum + (item.actualCost ?? 0), 0);
  const totalBudget = calcBudget(totalEstimated);

  return {
    generatedAt: new Date(),
    kpis: {
      total: cases.length,
      inProgress: inProgress.length,
      urgent: urgent.length,
      completed: completed.length,
      noRevisitRate: surveyed.length > 0
        ? Math.round((noRevisit.length / surveyed.length) * 100)
        : 100,
      noRevisitCount: noRevisit.length,
      surveyedCount: surveyed.length,
    },
    statusBreakdown,
    urgencyBreakdown,
    financials: options.includeFinancials
      ? {
          totalEstimated,
          totalBudget,
          totalActual,
          diff: totalActual - totalBudget,
        }
      : null,
    cases,
    recentCases: cases.slice(0, 6),
    attentionCases,
  };
}
