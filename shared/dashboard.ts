import { calcBudget } from "./budget";

export const DASHBOARD_STATUS_ORDER = [
  "受付",
  "現調中",
  "見積中",
  "施工待ち",
  "施工中",
  "完了",
  "クローズ",
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
  surveyDate?: Date | string | null;
  revisitCount?: number | null;
  assigneeId?: number | null;
  assigneeName?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
};

export type DashboardBreakdownRow = {
  key: string;
  label: string;
  value: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

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
  const completed = cases.filter((item) => item.status === "完了" || item.status === "クローズ");
  const surveyed = cases.filter((item) => Boolean(item.surveyDate));
  const noRevisit = surveyed.filter((item) => (item.revisitCount ?? 0) === 0);
  const overdueRequestCases = cases
    .filter((item) => item.status !== "完了" && item.status !== "クローズ")
    .map((item) => {
      const requestedAt = item.requestDate ?? item.createdAt;
      const requestDay = requestedAt ? startOfDay(requestedAt) : null;
      if (!requestDay) return null;
      const daysElapsed = Math.floor((today.getTime() - requestDay.getTime()) / DAY_MS);
      if (daysElapsed < 14) return null;
      return {
        ...item,
        requestDate: requestDay,
        daysElapsed,
        ...constructionWeek(item.constructionDate),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.daysElapsed - a.daysElapsed);

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
    overdueRequestCases,
  };
}
