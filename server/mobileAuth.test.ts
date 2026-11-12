import { describe, expect, it } from "vitest";
import type { MobileAccessToken, MobileDeviceGrant } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import {
  MOBILE_GRANT_TTL_MS,
  MOBILE_POLL_INTERVAL_SEC,
  authenticateMobileAccessToken,
  createRateLimiter,
  decideDeviceGrant,
  describeDeviceGrant,
  formatUserCode,
  hashSecret,
  normalizeUserCode,
  pollDeviceGrant,
  revokeMobileAccessTokenById,
  revokeMobileAccessTokenByValue,
  selectAuthCredential,
  startDeviceGrant,
  type MobileAuthStore,
  type MobileUser,
} from "./mobileAuth";
import { createMobileDevicesRouter } from "./mobileDevicesRouter";

function createMemoryStore(people: MobileUser[]) {
  const grants: MobileDeviceGrant[] = [];
  const tokens: MobileAccessToken[] = [];
  let grantSeq = 0;
  let tokenSeq = 0;
  const store: MobileAuthStore = {
    async insertGrant(row) {
      if (grants.some((g) => g.userCode === row.userCode || g.deviceCodeHash === row.deviceCodeHash)) {
        throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
      }
      grants.push({ ...row, id: ++grantSeq, status: "pending", userId: null, decidedAt: null, lastPolledAt: null, createdAt: new Date() });
    },
    async findGrantByDeviceCodeHash(hash) {
      return grants.find((g) => g.deviceCodeHash === hash) ?? null;
    },
    async findGrantByUserCode(code) {
      return grants.find((g) => g.userCode === code) ?? null;
    },
    async markGrantPolled(id, at) {
      const grant = grants.find((g) => g.id === id);
      if (grant) grant.lastPolledAt = at;
    },
    async transitionGrant(id, from, patch) {
      const grant = grants.find((g) => g.id === id);
      if (!grant || grant.status !== from) return false;
      Object.assign(grant, patch);
      return true;
    },
    async deleteGrantsExpiredBefore(before) {
      for (let i = grants.length - 1; i >= 0; i -= 1) if (grants[i].expiresAt < before) grants.splice(i, 1);
    },
    async insertToken(row) {
      tokens.push({ ...row, grantId: row.grantId ?? null, id: ++tokenSeq, lastUsedAt: null, revokedAt: null, revokedBy: null, createdAt: new Date() });
    },
    async findTokenByHash(hash) {
      return tokens.find((t) => t.tokenHash === hash) ?? null;
    },
    async findTokenById(id) {
      return tokens.find((t) => t.id === id) ?? null;
    },
    async touchToken(id, at) {
      const token = tokens.find((t) => t.id === id);
      if (token) token.lastUsedAt = at;
    },
    async revokeToken(id, revokedBy, at) {
      const token = tokens.find((t) => t.id === id);
      if (!token || token.revokedAt) return false;
      token.revokedAt = at;
      token.revokedBy = revokedBy;
      return true;
    },
    async listActiveTokens({ userId, now }) {
      return tokens.filter((t) => !t.revokedAt && t.expiresAt > now && (userId === undefined || t.userId === userId));
    },
    async findUserById(id) {
      return people.find((p) => p.id === id) ?? null;
    },
  };
  return { store, grants, tokens };
}

function person(id: number, role: MobileUser["role"], extra: Partial<MobileUser> = {}): MobileUser {
  const now = new Date();
  return {
    id,
    openId: `open-${id}`,
    name: `利用者${id}`,
    email: `u${id}@example.com`,
    loginMethod: "manus",
    role,
    areaAccessMode: "all",
    allowedPrefectures: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    nameOverride: null,
    disabledAt: null,
    ...extra,
  } as MobileUser;
}

/** 承認まで進めた端末トークンを返す。 */
async function linkDevice(store: MobileAuthStore, userId: number, at = new Date()) {
  const started = await startDeviceGrant(store, { deviceName: "iPhone 15", platform: "ios" }, at);
  await decideDeviceGrant(store, { userCode: started.userCode, userId, decision: "approve" }, at);
  const polled = await pollDeviceGrant(store, started.deviceCode, new Date(at.getTime() + 5000));
  if (polled.status !== "approved") throw new Error(`unexpected ${polled.status}`);
  return polled;
}

describe("確認コード", () => {
  it("区切り・小文字・空白を許容して正規化し、形式外は拒否する", () => {
    expect(normalizeUserCode("bcdf-ghjk")).toBe("BCDFGHJK");
    expect(normalizeUserCode(" BCDF GHJK ")).toBe("BCDFGHJK");
    expect(normalizeUserCode("BCDF-GHJA")).toBeNull(); // 母音は使わない
    expect(normalizeUserCode("BCDF")).toBeNull();
    expect(formatUserCode("BCDFGHJK")).toBe("BCDF-GHJK");
  });
});

describe("端末連携の開始と承認待ち", () => {
  it("device_code は平文で保存せず、確認コードは XXXX-XXXX 形式で 10 分有効", async () => {
    const { store, grants } = createMemoryStore([]);
    const now = new Date("2026-11-12T00:00:00Z");
    const started = await startDeviceGrant(store, { deviceName: "Pixel 9", platform: "android" }, now);
    expect(started.userCode).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
    expect(started.expiresIn).toBe(MOBILE_GRANT_TTL_MS / 1000);
    expect(started.interval).toBe(MOBILE_POLL_INTERVAL_SEC);
    expect(grants[0].deviceCodeHash).toBe(hashSecret(started.deviceCode));
    expect(JSON.stringify(grants)).not.toContain(started.deviceCode);
    expect(grants[0].platform).toBe("android");
  });

  it("承認前は pending、確認間隔より速い問い合わせは slow_down", async () => {
    const { store } = createMemoryStore([]);
    const now = new Date("2026-11-12T00:00:00Z");
    const started = await startDeviceGrant(store, {}, now);
    expect((await pollDeviceGrant(store, started.deviceCode, now)).status).toBe("pending");
    expect((await pollDeviceGrant(store, started.deviceCode, new Date(now.getTime() + 500))).status).toBe("slow_down");
    expect((await pollDeviceGrant(store, started.deviceCode, new Date(now.getTime() + 4000))).status).toBe("pending");
  });

  it("10 分を過ぎた申請は承認も受け取りもできない", async () => {
    const { store } = createMemoryStore([person(1, "user")]);
    const now = new Date("2026-11-12T00:00:00Z");
    const started = await startDeviceGrant(store, {}, now);
    const later = new Date(now.getTime() + MOBILE_GRANT_TTL_MS + 1);
    expect(await describeDeviceGrant(store, started.userCode, later)).toEqual({ state: "expired" });
    expect(await decideDeviceGrant(store, { userCode: started.userCode, userId: 1, decision: "approve" }, later)).toEqual({ ok: false, reason: "expired" });
    expect((await pollDeviceGrant(store, started.deviceCode, later)).status).toBe("expired");
  });

  it("拒否された申請は denied を返し、トークンを発行しない", async () => {
    const { store, tokens } = createMemoryStore([person(1, "user")]);
    const started = await startDeviceGrant(store, {});
    expect(await decideDeviceGrant(store, { userCode: started.userCode, userId: 1, decision: "deny" })).toMatchObject({ ok: true });
    expect((await pollDeviceGrant(store, started.deviceCode)).status).toBe("denied");
    expect(tokens).toHaveLength(0);
  });

  it("承認済みのトークンは 1 回だけ受け渡し、同時の問い合わせでも二重発行しない", async () => {
    const { store, tokens } = createMemoryStore([person(7, "partner", { nameOverride: "山田設備" })]);
    const started = await startDeviceGrant(store, { deviceName: "iPhone", platform: "ios" });
    await decideDeviceGrant(store, { userCode: started.userCode, userId: 7, decision: "approve" });
    const results = await Promise.all([
      pollDeviceGrant(store, started.deviceCode),
      pollDeviceGrant(store, started.deviceCode),
    ]);
    const approved = results.filter((r) => r.status === "approved");
    expect(approved).toHaveLength(1);
    expect(tokens).toHaveLength(1);
    const first = approved[0];
    if (first.status !== "approved") throw new Error("unreachable");
    expect(first.accessToken.startsWith("smx_")).toBe(true);
    expect(first.user).toEqual({ id: 7, name: "山田設備", role: "partner" });
    expect(tokens[0].tokenHash).toBe(hashSecret(first.accessToken));
    expect(JSON.stringify(tokens)).not.toContain(first.accessToken);
    expect((await pollDeviceGrant(store, started.deviceCode)).status).toBe("expired");
  });

  it("処理済みの申請は再承認できない", async () => {
    const { store } = createMemoryStore([person(1, "user")]);
    const started = await startDeviceGrant(store, {});
    await decideDeviceGrant(store, { userCode: started.userCode, userId: 1, decision: "approve" });
    expect(await decideDeviceGrant(store, { userCode: started.userCode, userId: 1, decision: "approve" })).toEqual({ ok: false, reason: "decided" });
  });
});

describe("端末トークンでの認証", () => {
  it("有効なトークンは連携した利用者（役割そのまま）を返す", async () => {
    const { store } = createMemoryStore([person(3, "executive")]);
    const linked = await linkDevice(store, 3);
    const user = await authenticateMobileAccessToken(store, linked.accessToken);
    expect(user?.id).toBe(3);
    expect(user?.role).toBe("executive");
  });

  it("利用停止（退職）した利用者のトークンは拒否する", async () => {
    const people = [person(4, "user")];
    const { store } = createMemoryStore(people);
    const linked = await linkDevice(store, 4);
    people[0].disabledAt = new Date();
    expect(await authenticateMobileAccessToken(store, linked.accessToken)).toBeNull();
  });

  it("失効・期限切れ・未知のトークンは拒否する", async () => {
    const { store, tokens } = createMemoryStore([person(5, "user")]);
    const linked = await linkDevice(store, 5);
    expect(await authenticateMobileAccessToken(store, "smx_unknown")).toBeNull();
    expect(await authenticateMobileAccessToken(store, linked.accessToken, new Date(tokens[0].expiresAt.getTime() + 1))).toBeNull();
    expect(await revokeMobileAccessTokenByValue(store, linked.accessToken)).toBe(true);
    expect(await authenticateMobileAccessToken(store, linked.accessToken)).toBeNull();
  });

  it("他人の端末は本人以外解除できず、owner/admin は解除できる", async () => {
    const { store } = createMemoryStore([person(1, "user"), person(2, "partner"), person(9, "admin")]);
    await linkDevice(store, 2);
    expect(await revokeMobileAccessTokenById(store, { id: 1, actor: { id: 1, role: "user" } })).toBe("forbidden");
    expect(await revokeMobileAccessTokenById(store, { id: 1, actor: { id: 9, role: "admin" } })).toBe("revoked");
    expect(await revokeMobileAccessTokenById(store, { id: 1, actor: { id: 9, role: "admin" } })).toBe("not_found");
  });
});

describe("認証情報の選択", () => {
  it("セッション Cookie があれば Bearer より Cookie を優先する", () => {
    const credential = selectAuthCredential({
      headers: { cookie: "app_session_id=jwt-value; other=1", authorization: "Bearer smx_abc" },
    } as never);
    expect(credential).toEqual({ kind: "cookie", value: "jwt-value" });
  });

  it("Cookie が無いときだけ smx_ の Bearer を端末トークンとして扱う", () => {
    expect(selectAuthCredential({ headers: { authorization: "Bearer smx_abc" } } as never)).toEqual({ kind: "mobile", token: "smx_abc" });
    expect(selectAuthCredential({ headers: { authorization: "Bearer other-token" } } as never)).toEqual({ kind: "none" });
    expect(selectAuthCredential({ headers: {} } as never)).toEqual({ kind: "none" });
  });
});

describe("mobileDevices ルーター", () => {
  function ctxFor(user: MobileUser, authMethod: TrpcContext["authMethod"]): TrpcContext {
    return { user, authMethod, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
  }

  it("承認は Web の Cookie セッションに限定し、端末トークンからは拒否する", async () => {
    const owner = person(1, "owner");
    const { store } = createMemoryStore([owner]);
    const router = createMobileDevicesRouter(store);
    const started = await startDeviceGrant(store, { deviceName: "iPad" });
    await expect(router.createCaller(ctxFor(owner, "mobile")).approve({ userCode: started.userCode })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(router.createCaller(ctxFor(owner, "cookie")).approve({ userCode: started.userCode })).resolves.toEqual({ success: true, deviceName: "iPad" });
  });

  it("自分の端末一覧にはトークン本体やハッシュを含めない", async () => {
    const member = person(2, "user");
    const { store } = createMemoryStore([member]);
    await linkDevice(store, 2);
    const list = await createMobileDevicesRouter(store).createCaller(ctxFor(member, "cookie")).listMine();
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("tokenHash");
    expect(list[0].deviceName).toBe("iPhone 15");
  });

  it("全端末一覧は owner/admin 以外は拒否する", async () => {
    const member = person(2, "user");
    const { store } = createMemoryStore([member]);
    await expect(createMobileDevicesRouter(store).createCaller(ctxFor(member, "cookie")).listAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("レート制限", () => {
  it("窓内の上限を超えると false、窓を過ぎると回復する", () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow("ip", 0)).toBe(true);
    expect(allow("ip", 10)).toBe(true);
    expect(allow("ip", 20)).toBe(false);
    expect(allow("ip", 1500)).toBe(true);
  });
});
