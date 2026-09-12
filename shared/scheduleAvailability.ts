const TERMINAL_STATUSES = new Set(["完了", "クローズ", "失注"]);

export type ScheduleAvailabilityCaseInput = {
  id: number;
  requestNumber: string;
  storeName: string;
  status: string;
  partnerId?: number | null;
  contractorName?: string | null;
  constructionDate?: Date | string | null;
};

export type ScheduleAvailabilityRouteInput = {
  caseId: number;
  taskType: string;
  scheduledDate: Date | string;
  partnerId?: number | null;
  contractorName?: string | null;
};

function toDateKey(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function monthDateRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("month must be YYYY-MM");
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new Error("month must be YYYY-MM");
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function buildScheduleAvailability(input: {
  cases: ScheduleAvailabilityCaseInput[];
  routes: ScheduleAvailabilityRouteInput[];
  partnerId: number;
  month: string;
  excludeCaseIds?: number[];
}) {
  const { start, end } = monthDateRange(input.month);
  const excluded = new Set(input.excludeCaseIds ?? []);
  const routesByCase = new Map<number, ScheduleAvailabilityRouteInput[]>();
  for (const route of input.routes) {
    if (route.taskType !== "construction") continue;
    const rows = routesByCase.get(route.caseId) ?? [];
    rows.push(route);
    routesByCase.set(route.caseId, rows);
  }

  const entries = input.cases.flatMap((item) => {
    if (excluded.has(item.id) || TERMINAL_STATUSES.has(item.status)) return [];
    const directDate = toDateKey(item.constructionDate);
    const fallbackRoute = directDate
      ? null
      : (routesByCase.get(item.id) ?? [])
          .map((route) => ({ route, date: toDateKey(route.scheduledDate) }))
          .filter((candidate): candidate is { route: ScheduleAvailabilityRouteInput; date: string } => Boolean(candidate.date))
          .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    const date = directDate ?? fallbackRoute?.date ?? null;
    if (!date || date < start || date > end) return [];
    const partnerId = item.partnerId ?? fallbackRoute?.route.partnerId ?? null;
    return [{
      caseId: item.id,
      requestNumber: item.requestNumber,
      storeName: item.storeName,
      date,
      partnerId,
      contractorName: item.contractorName ?? fallbackRoute?.route.contractorName ?? null,
    }];
  });

  const days = Array.from({ length: Number(end.slice(-2)) }, (_, index) => {
    const date = `${input.month}-${String(index + 1).padStart(2, "0")}`;
    const dateEntries = entries.filter((entry) => entry.date === date);
    const partnerEntries = dateEntries.filter((entry) => entry.partnerId === input.partnerId);
    return {
      date,
      totalCount: dateEntries.length,
      partnerCount: partnerEntries.length,
      partnerCases: partnerEntries,
    };
  });

  return {
    month: input.month,
    partnerId: input.partnerId,
    days,
  };
}
