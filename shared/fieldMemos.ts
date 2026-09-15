import type { AppRole } from "./accessPolicy";

export const FIELD_MEMO_CATEGORIES = ["状況", "確認事項", "追加対応", "注意", "連絡"] as const;

export type FieldMemoCategory = (typeof FIELD_MEMO_CATEGORIES)[number];

export const FIELD_MEMO_MAX_LENGTH = 500;

export function canViewFieldMemos(role: AppRole | string) {
  return role === "owner" || role === "admin" || role === "user" || role === "executive" || role === "partner";
}

export function canCreateFieldMemo(role: AppRole | string) {
  return role === "owner" || role === "admin" || role === "user" || role === "partner";
}

export function canModifyFieldMemo(role: AppRole | string, currentUserId: number, authorUserId: number) {
  return canCreateFieldMemo(role) && currentUserId === authorUserId;
}
