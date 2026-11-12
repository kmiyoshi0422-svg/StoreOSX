/**
 * モバイルアプリの端末連携（RFC 8628 デバイス認可方式）と端末トークン認証。
 *
 * 流れ:
 *   1. アプリが /api/mobile-auth/start で device_code（端末だけが持つ秘密値）と user_code（確認コード）を受け取る。
 *   2. 利用者が Web 版 /mobile-link で Store-OSX にログインし、確認コードを確かめて承認する（Cookie セッション限定）。
 *   3. アプリが /api/mobile-auth/poll で承認を検知し、端末トークン（smx_...）を一度だけ受け取る。
 *   4. 以降のアプリからのリクエストは Authorization: Bearer smx_... で認証し、users の役割・閲覧エリア・利用停止をそのまま適用する。
 *
 * 平文の device_code と端末トークンは DB に保存せず、SHA-256 ハッシュで照合する。
 * Web ブラウザの Cookie セッションがある場合は常に Cookie を優先し、既存の Web ログインの挙動は変えない。
 */
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import {
  mobileAccessTokens,
  mobileDeviceGrants,
  users,
  type MobileAccessToken,
  type MobileDeviceGrant,
  type User,
} from "../drizzle/schema";
import { getDb } from "./db";

export const MOBILE_TOKEN_PREFIX = "smx_";
export const MOBILE_GRANT_TTL_MS = 10 * 60 * 1000;
/** 承認後、アプリがトークンを受け取れる猶予。 */
export const MOBILE_APPROVED_PICKUP_MS = 5 * 60 * 1000;
export const MOBILE_POLL_INTERVAL_SEC = 3;
export const MOBILE_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** 最終利用日時の更新間隔（毎リクエストの書き込みを避ける）。 */
const TOKEN_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
/** RFC 8628 推奨の母音なし 20 文字。読み間違えやすい文字と単語化を避ける。 */
export const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
export const USER_CODE_LENGTH = 8;
export const MOBILE_PLATFORMS = ["ios", "android", "web", "other"] as const;
export type MobilePlatform = (typeof MOBILE_PLATFORMS)[number];

type GrantStatus = MobileDeviceGrant["status"];

export type NewMobileDeviceGrant = Pick<
  MobileDeviceGrant,
  "deviceCodeHash" | "userCode" | "deviceName" | "platform" | "expiresAt"
>;
export type NewMobileAccessToken = Pick<
  MobileAccessToken,
  "userId" | "grantId" | "tokenHash" | "tokenPrefix" | "deviceName" | "platform" | "expiresAt"
>;
export type MobileUser = User & { disabledAt?: Date | null; nameOverride?: string | null };

/** 保存先の抽象。本番は Drizzle、テストはメモリ実装を使う。 */
export interface MobileAuthStore {
  insertGrant(row: NewMobileDeviceGrant): Promise<void>;
  findGrantByDeviceCodeHash(hash: string): Promise<MobileDeviceGrant | null>;
  findGrantByUserCode(userCode: string): Promise<MobileDeviceGrant | null>;
  markGrantPolled(id: number, at: Date): Promise<void>;
  /** status が from のときだけ更新し、更新できたかを返す（同時実行での二重処理を防ぐ）。 */
  transitionGrant(
    id: number,
    from: GrantStatus,
    patch: Partial<Pick<MobileDeviceGrant, "status" | "userId" | "decidedAt" | "expiresAt">>,
  ): Promise<boolean>;
  deleteGrantsExpiredBefore(before: Date): Promise<void>;
  insertToken(row: NewMobileAccessToken): Promise<void>;
  findTokenByHash(hash: string): Promise<MobileAccessToken | null>;
  findTokenById(id: number): Promise<MobileAccessToken | null>;
  touchToken(id: number, at: Date): Promise<void>;
  revokeToken(id: number, revokedBy: number | null, at: Date): Promise<boolean>;
  listActiveTokens(filter: { userId?: number; now: Date }): Promise<MobileAccessToken[]>;
  findUserById(id: number): Promise<MobileUser | null>;
}

// ─── 値の生成と正規化 ──────────────────────────────────────

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateUserCode() {
  let code = "";
  for (let i = 0; i < USER_CODE_LENGTH; i += 1) {
    code += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)];
  }
  return code;
}

/** 入力された確認コードから区切り・空白を除いて大文字化する。形式外なら null。 */
export function normalizeUserCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const code = input.toUpperCase().replace(/[\s\-‐－ー_]/g, "");
  if (code.length !== USER_CODE_LENGTH) return null;
  for (const char of code) {
    if (!USER_CODE_ALPHABET.includes(char)) return null;
  }
  return code;
}

export function formatUserCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function generateDeviceCode() {
  return randomBytes(32).toString("base64url");
}

export function generateMobileAccessToken() {
  return `${MOBILE_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function displayNameOf(user: Pick<MobileUser, "name" | "email"> & { nameOverride?: string | null }) {
  return user.nameOverride?.trim() || user.name?.trim() || user.email?.trim() || "名称未設定";
}

function sanitizeDeviceName(value: string | null | undefined) {
  const trimmed = (value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (trimmed || "モバイル端末").slice(0, 120);
}

function isDuplicateEntryError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; errno?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062) return true;
    if (typeof candidate.message === "string" && /Duplicate entry/.test(candidate.message)) return true;
    current = candidate.cause;
  }
  return false;
}

// ─── 認証情報の選択（Cookie 優先） ────────────────────────────

export type AuthCredential =
  | { kind: "cookie"; value: string }
  | { kind: "mobile"; token: string }
  | { kind: "none" };

/**
 * リクエストから使う認証情報を選ぶ。
 * セッション Cookie があれば必ず Cookie を使い（既存 Web の挙動を維持）、
 * Cookie が無いときだけ Authorization: Bearer smx_... を端末トークンとして扱う。
 */
export function selectAuthCredential(req: Pick<Request, "headers">): AuthCredential {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookieHeader(cookieHeader);
    const value = cookies[COOKIE_NAME];
    if (value) return { kind: "cookie", value };
  }
  const token = extractMobileBearer(req);
  if (token) return { kind: "mobile", token };
  return { kind: "none" };
}

export function extractMobileBearer(req: Pick<Request, "headers">): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  if (!token.startsWith(MOBILE_TOKEN_PREFIX) || token.length > 128) return null;
  return token;
}

// ─── 端末連携の各操作 ──────────────────────────────────────

export async function startDeviceGrant(
  store: MobileAuthStore,
  input: { deviceName?: string | null; platform?: string | null },
  now = new Date(),
) {
  const deviceName = sanitizeDeviceName(input.deviceName);
  const platform: MobilePlatform = (MOBILE_PLATFORMS as readonly string[]).includes(input.platform ?? "")
    ? (input.platform as MobilePlatform)
    : "other";
  const expiresAt = new Date(now.getTime() + MOBILE_GRANT_TTL_MS);
  // 1日以上前に期限切れになった申請は確認コードの再利用のために片付ける。
  await store.deleteGrantsExpiredBefore(new Date(now.getTime() - 24 * 60 * 60 * 1000)).catch(() => undefined);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    try {
      await store.insertGrant({
        deviceCodeHash: hashSecret(deviceCode),
        userCode,
        deviceName,
        platform,
        expiresAt,
      });
      return {
        deviceCode,
        userCode: formatUserCode(userCode),
        expiresIn: Math.round(MOBILE_GRANT_TTL_MS / 1000),
        interval: MOBILE_POLL_INTERVAL_SEC,
        verificationPath: "/mobile-link",
      };
    } catch (error) {
      if (!isDuplicateEntryError(error)) throw error;
    }
  }
  throw new Error("確認コードを発行できませんでした。時間をおいて再度お試しください");
}

export type PollResult =
  | { status: "pending"; interval: number }
  | { status: "slow_down"; interval: number }
  | { status: "denied" }
  | { status: "expired" }
  | {
      status: "approved";
      accessToken: string;
      expiresAt: Date;
      user: { id: number; name: string; role: string };
    };

export async function pollDeviceGrant(
  store: MobileAuthStore,
  deviceCode: string,
  now = new Date(),
): Promise<PollResult> {
  const grant = await store.findGrantByDeviceCodeHash(hashSecret(deviceCode));
  if (!grant || grant.status === "consumed") return { status: "expired" };
  if (grant.status === "denied") return { status: "denied" };
  if (grant.expiresAt.getTime() <= now.getTime()) return { status: "expired" };

  if (grant.status === "pending") {
    const last = grant.lastPolledAt?.getTime();
    // 確認間隔より速い問い合わせは slow_down（RFC 8628 §3.5）。多少の通信ゆらぎは許容する。
    if (last !== undefined && now.getTime() - last < MOBILE_POLL_INTERVAL_SEC * 1000 - 750) {
      await store.markGrantPolled(grant.id, now);
      return { status: "slow_down", interval: MOBILE_POLL_INTERVAL_SEC + 2 };
    }
    await store.markGrantPolled(grant.id, now);
    return { status: "pending", interval: MOBILE_POLL_INTERVAL_SEC };
  }

  // approved: 先に consumed へ切り替えられた 1 回だけトークンを発行する。
  const claimed = await store.transitionGrant(grant.id, "approved", { status: "consumed" });
  if (!claimed || !grant.userId) return { status: "expired" };
  const user = await store.findUserById(grant.userId);
  if (!user || user.disabledAt) return { status: "denied" };

  const accessToken = generateMobileAccessToken();
  const expiresAt = new Date(now.getTime() + MOBILE_TOKEN_TTL_MS);
  await store.insertToken({
    userId: user.id,
    grantId: grant.id,
    tokenHash: hashSecret(accessToken),
    tokenPrefix: accessToken.slice(0, 12),
    deviceName: grant.deviceName,
    platform: grant.platform,
    expiresAt,
  });
  return {
    status: "approved",
    accessToken,
    expiresAt,
    user: { id: user.id, name: displayNameOf(user), role: user.role },
  };
}

export type GrantLookup =
  | { state: "invalid_code" }
  | { state: "not_found" }
  | { state: "expired" }
  | { state: "decided"; status: GrantStatus }
  | {
      state: "pending";
      userCode: string;
      deviceName: string;
      platform: string;
      createdAt: Date;
      expiresAt: Date;
    };

export async function describeDeviceGrant(
  store: MobileAuthStore,
  rawUserCode: string,
  now = new Date(),
): Promise<GrantLookup> {
  const userCode = normalizeUserCode(rawUserCode);
  if (!userCode) return { state: "invalid_code" };
  const grant = await store.findGrantByUserCode(userCode);
  if (!grant) return { state: "not_found" };
  if (grant.status !== "pending") return { state: "decided", status: grant.status };
  if (grant.expiresAt.getTime() <= now.getTime()) return { state: "expired" };
  return {
    state: "pending",
    userCode: formatUserCode(grant.userCode),
    deviceName: grant.deviceName,
    platform: grant.platform,
    createdAt: grant.createdAt,
    expiresAt: grant.expiresAt,
  };
}

export async function decideDeviceGrant(
  store: MobileAuthStore,
  input: { userCode: string; userId: number; decision: "approve" | "deny" },
  now = new Date(),
): Promise<{ ok: true; deviceName: string } | { ok: false; reason: Exclude<GrantLookup["state"], "pending"> }> {
  const lookup = await describeDeviceGrant(store, input.userCode, now);
  if (lookup.state !== "pending") return { ok: false, reason: lookup.state };
  const grant = await store.findGrantByUserCode(normalizeUserCode(input.userCode)!);
  if (!grant) return { ok: false, reason: "not_found" };
  const updated = await store.transitionGrant(
    grant.id,
    "pending",
    input.decision === "approve"
      ? {
          status: "approved",
          userId: input.userId,
          decidedAt: now,
          expiresAt: new Date(now.getTime() + MOBILE_APPROVED_PICKUP_MS),
        }
      : { status: "denied", userId: input.userId, decidedAt: now },
  );
  if (!updated) return { ok: false, reason: "decided" };
  return { ok: true, deviceName: grant.deviceName };
}

/** 端末トークンからユーザーを解決する。失効・期限切れ・利用停止は null。 */
export async function authenticateMobileAccessToken(
  store: MobileAuthStore,
  token: string,
  now = new Date(),
): Promise<MobileUser | null> {
  if (!token.startsWith(MOBILE_TOKEN_PREFIX)) return null;
  const row = await store.findTokenByHash(hashSecret(token));
  if (!row || row.revokedAt) return null;
  if (row.expiresAt.getTime() <= now.getTime()) return null;
  const user = await store.findUserById(row.userId);
  if (!user || user.disabledAt) return null;
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > TOKEN_TOUCH_INTERVAL_MS) {
    await store.touchToken(row.id, now).catch(() => undefined);
  }
  return user;
}

export async function revokeMobileAccessTokenByValue(store: MobileAuthStore, token: string, now = new Date()) {
  const row = await store.findTokenByHash(hashSecret(token));
  if (!row) return false;
  if (row.revokedAt) return true;
  return store.revokeToken(row.id, row.userId, now);
}

export function canManageAllMobileDevices(role: string) {
  return role === "owner" || role === "admin";
}

export async function revokeMobileAccessTokenById(
  store: MobileAuthStore,
  input: { id: number; actor: { id: number; role: string } },
  now = new Date(),
): Promise<"revoked" | "not_found" | "forbidden"> {
  const row = await store.findTokenById(input.id);
  if (!row || row.revokedAt) return "not_found";
  if (row.userId !== input.actor.id && !canManageAllMobileDevices(input.actor.role)) return "forbidden";
  await store.revokeToken(row.id, input.actor.id, now);
  return "revoked";
}

export function toMobileDeviceView(row: MobileAccessToken) {
  return {
    id: row.id,
    userId: row.userId,
    deviceName: row.deviceName,
    platform: row.platform,
    tokenPrefix: row.tokenPrefix,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
  };
}

// ─── レート制限（プロセス内の簡易スライディングウィンドウ） ─────────────

export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      hits.forEach((times, entryKey) => {
        if (times.every((time) => now - time >= windowMs)) hits.delete(entryKey);
      });
    }
    return true;
  };
}

export const mobileLookupLimiter = createRateLimiter(30, 10 * 60 * 1000);

function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.ip || "unknown";
}

// ─── Drizzle 実装 ───────────────────────────────────────────

const MOBILE_AUTH_DDL = [
  `CREATE TABLE IF NOT EXISTS mobile_access_tokens (
    id int AUTO_INCREMENT NOT NULL,
    user_id int NOT NULL,
    grant_id int,
    token_hash varchar(64) NOT NULL,
    token_prefix varchar(12) NOT NULL,
    device_name varchar(120) NOT NULL,
    platform varchar(20) NOT NULL,
    last_used_at timestamp NULL,
    expires_at timestamp NOT NULL,
    revoked_at timestamp NULL,
    revoked_by int,
    created_at timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT mobile_access_tokens_id PRIMARY KEY (id),
    CONSTRAINT uniq_mobile_token_hash UNIQUE (token_hash),
    KEY idx_mobile_token_user (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS mobile_device_grants (
    id int AUTO_INCREMENT NOT NULL,
    device_code_hash varchar(64) NOT NULL,
    user_code varchar(8) NOT NULL,
    device_name varchar(120) NOT NULL,
    platform varchar(20) NOT NULL,
    status enum('pending','approved','denied','consumed') NOT NULL DEFAULT 'pending',
    user_id int,
    decided_at timestamp NULL,
    expires_at timestamp NOT NULL,
    last_polled_at timestamp NULL,
    created_at timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT mobile_device_grants_id PRIMARY KEY (id),
    CONSTRAINT uniq_mobile_grant_device_code UNIQUE (device_code_hash),
    CONSTRAINT uniq_mobile_grant_user_code UNIQUE (user_code),
    KEY idx_mobile_grant_expires (expires_at)
  )`,
];

/** 起動時にテーブルを用意する（マイグレーション 0057 と同じ定義、既存なら何もしない）。 */
export async function ensureMobileAuthSchema() {
  const db = await getDb();
  if (!db) return;
  for (const statement of MOBILE_AUTH_DDL) {
    await db.execute(sql.raw(statement));
  }
}

function affectedRows(result: unknown) {
  if (Array.isArray(result)) {
    const first = result[0] as { affectedRows?: number } | undefined;
    return first?.affectedRows ?? 0;
  }
  return (result as { affectedRows?: number } | null)?.affectedRows ?? 0;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db;
}

export const drizzleMobileAuthStore: MobileAuthStore = {
  async insertGrant(row) {
    const db = await requireDb();
    await db.insert(mobileDeviceGrants).values(row);
  },
  async findGrantByDeviceCodeHash(hash) {
    const db = await requireDb();
    const [row] = await db.select().from(mobileDeviceGrants).where(eq(mobileDeviceGrants.deviceCodeHash, hash)).limit(1);
    return row ?? null;
  },
  async findGrantByUserCode(userCode) {
    const db = await requireDb();
    const [row] = await db.select().from(mobileDeviceGrants).where(eq(mobileDeviceGrants.userCode, userCode)).limit(1);
    return row ?? null;
  },
  async markGrantPolled(id, at) {
    const db = await requireDb();
    await db.update(mobileDeviceGrants).set({ lastPolledAt: at }).where(eq(mobileDeviceGrants.id, id));
  },
  async transitionGrant(id, from, patch) {
    const db = await requireDb();
    const result = await db
      .update(mobileDeviceGrants)
      .set(patch)
      .where(and(eq(mobileDeviceGrants.id, id), eq(mobileDeviceGrants.status, from)));
    return affectedRows(result) === 1;
  },
  async deleteGrantsExpiredBefore(before) {
    const db = await requireDb();
    await db.delete(mobileDeviceGrants).where(lt(mobileDeviceGrants.expiresAt, before));
  },
  async insertToken(row) {
    const db = await requireDb();
    await db.insert(mobileAccessTokens).values(row);
  },
  async findTokenByHash(hash) {
    const db = await requireDb();
    const [row] = await db.select().from(mobileAccessTokens).where(eq(mobileAccessTokens.tokenHash, hash)).limit(1);
    return row ?? null;
  },
  async findTokenById(id) {
    const db = await requireDb();
    const [row] = await db.select().from(mobileAccessTokens).where(eq(mobileAccessTokens.id, id)).limit(1);
    return row ?? null;
  },
  async touchToken(id, at) {
    const db = await requireDb();
    await db.update(mobileAccessTokens).set({ lastUsedAt: at }).where(eq(mobileAccessTokens.id, id));
  },
  async revokeToken(id, revokedBy, at) {
    const db = await requireDb();
    const result = await db
      .update(mobileAccessTokens)
      .set({ revokedAt: at, revokedBy })
      .where(and(eq(mobileAccessTokens.id, id), isNull(mobileAccessTokens.revokedAt)));
    return affectedRows(result) === 1;
  },
  async listActiveTokens({ userId, now }) {
    const db = await requireDb();
    const conditions = [isNull(mobileAccessTokens.revokedAt), gt(mobileAccessTokens.expiresAt, now)];
    if (userId !== undefined) conditions.push(eq(mobileAccessTokens.userId, userId));
    return db
      .select()
      .from(mobileAccessTokens)
      .where(and(...conditions))
      .orderBy(desc(mobileAccessTokens.createdAt))
      .limit(500);
  },
  async findUserById(id) {
    const db = await requireDb();
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return (row as MobileUser | undefined) ?? null;
  },
};

// ─── REST エンドポイント（アプリ／モバイル BFF から呼ばれる） ────────────

const startSchema = z.object({
  deviceName: z.string().max(200).nullish(),
  platform: z.string().max(20).nullish(),
});
const pollSchema = z.object({ deviceCode: z.string().min(20).max(200) });

export function registerMobileAuthRoutes(app: Express, store: MobileAuthStore = drizzleMobileAuthStore) {
  const startLimiter = createRateLimiter(20, 10 * 60 * 1000);
  const pollLimiter = createRateLimiter(400, 10 * 60 * 1000);

  const noStore = (res: Response) => res.set("Cache-Control", "no-store");

  app.post("/api/mobile-auth/start", async (req: Request, res: Response) => {
    noStore(res);
    if (!startLimiter(clientIp(req))) {
      res.status(429).json({ error: "連携の開始が多すぎます。しばらく待ってから再度お試しください" });
      return;
    }
    const parsed = startSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "端末情報の形式が正しくありません" });
      return;
    }
    try {
      res.json(await startDeviceGrant(store, parsed.data));
    } catch (error) {
      console.error("[MobileAuth] start failed:", error);
      res.status(500).json({ error: "連携を開始できませんでした" });
    }
  });

  app.post("/api/mobile-auth/poll", async (req: Request, res: Response) => {
    noStore(res);
    if (!pollLimiter(clientIp(req))) {
      res.status(429).json({ error: "問い合わせが多すぎます。しばらく待ってから再度お試しください" });
      return;
    }
    const parsed = pollSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "連携コードの形式が正しくありません" });
      return;
    }
    try {
      res.json(await pollDeviceGrant(store, parsed.data.deviceCode));
    } catch (error) {
      console.error("[MobileAuth] poll failed:", error);
      res.status(500).json({ error: "連携状態を確認できませんでした" });
    }
  });

  app.post("/api/mobile-auth/revoke", async (req: Request, res: Response) => {
    noStore(res);
    const token = extractMobileBearer(req);
    if (!token) {
      res.status(401).json({ error: "端末トークンがありません" });
      return;
    }
    try {
      await revokeMobileAccessTokenByValue(store, token);
      res.json({ success: true });
    } catch (error) {
      console.error("[MobileAuth] revoke failed:", error);
      res.status(500).json({ error: "連携を解除できませんでした" });
    }
  });
}
