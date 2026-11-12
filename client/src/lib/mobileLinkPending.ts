/**
 * 未ログインで /mobile-link を開いた場合に、OAuth ログイン後（コールバックは常に "/" へ戻る）に
 * 承認画面へ戻すための一時保存。確認コードの有効期限（10分）に合わせて 15 分で破棄する。
 */
const PENDING_KEY = "storeosx.mobileLink.pending";
const PENDING_TTL_MS = 15 * 60 * 1000;

export function savePendingMobileLinkCode(code: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ code, savedAt: Date.now() }));
  } catch {
    // プライベートモード等で保存できない場合は手入力で続けられる。
  }
}

export function clearPendingMobileLinkCode() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // noop
  }
}

export function takePendingMobileLinkCode(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    const parsed = JSON.parse(raw) as { code?: unknown; savedAt?: unknown };
    if (typeof parsed.code !== "string" || typeof parsed.savedAt !== "number") return null;
    if (now - parsed.savedAt > PENDING_TTL_MS) return null;
    return parsed.code;
  } catch {
    return null;
  }
}
