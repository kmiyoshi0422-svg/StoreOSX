export const APP_ROLES = [
  "user",
  "executive",
  "admin",
  "owner",
  "partner",
  "customer",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type AreaAccessUser = {
  role: AppRole | string;
  areaAccessMode?: "all" | "selected" | null;
  allowedPrefectures?: string | string[] | null;
};

export function canViewInternalFinancials(role: string) {
  return role === "owner" || role === "admin" || role === "executive";
}

export function canViewProfit(role: string) {
  return role === "owner";
}

export function canManageAccess(role: string) {
  return role === "owner" || role === "admin";
}

export function canManageCases(role: string) {
  return role === "owner" || role === "admin" || role === "executive" || role === "user";
}

export function canEditSurveyImpression(role: string) {
  return role === "owner" || role === "admin" || role === "user";
}

export function parseAllowedPrefectures(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  } catch {
    return [];
  }
}

export function hasAllAreaAccess(user: AreaAccessUser) {
  if (user.role === "owner" || user.role === "admin") return true;
  return user.areaAccessMode !== "selected";
}

export function canAccessPrefecture(user: AreaAccessUser, prefecture: string | null | undefined) {
  if (hasAllAreaAccess(user)) return true;
  if (!prefecture) return false;
  return parseAllowedPrefectures(user.allowedPrefectures).includes(prefecture);
}

export function filterCasesByArea<T>(
  rows: T[],
  user: AreaAccessUser,
) {
  return rows.filter((row) =>
    canAccessPrefecture(
      user,
      (row as { prefecture?: string | null }).prefecture,
    ),
  );
}

export const INTERNAL_FINANCIAL_FIELDS = [
  "estimatedCost",
  "plenusQuoteAmount",
  "estimatedMaterialCost",
  "estimatedLaborCost",
  "is10mYen",
  "managementFee",
  "siteExpense",
  "ownSurveyCost",
  "partnerSurveyCost",
  "transportCost",
  "laborCost",
  "actualCost",
  "actualMaterialCost",
  "actualLaborCost",
  "expenseBudget",
  "invoiceNumber",
  "invoiceDate",
] as const;

export function stripInternalFinancialFields<T>(row: T): T {
  const result = { ...row } as Record<string, unknown>;
  for (const field of INTERNAL_FINANCIAL_FIELDS) {
    if (field in result) result[field] = null;
  }
  return result as T;
}

export function applyFinancialVisibility<T>(row: T, role: string): T {
  if (canViewInternalFinancials(role)) return row;
  return stripInternalFinancialFields(row);
}

/** 外部向けの自由記述に明示的な金額がある場合は文脈ごと非表示にし、部分伏せ字による漏れを避ける。 */
export function redactTextWithAmounts(value: string | null | undefined): string | null | undefined {
  if (!value) return value;
  return /(?:[¥￥]\s*\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s*(?:億|万|千)?円)/.test(value)
    ? "金額に関する記述を含むため非表示"
    : value;
}

export function maskProfitValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => maskProfitValues(item)) as T;
  }
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (["profit", "margin", "grossProfit", "grossMargin", "totalProfit", "profitMargin"].includes(key)) {
      result[key] = null;
    } else {
      result[key] = maskProfitValues(item);
    }
  }
  return result as T;
}
