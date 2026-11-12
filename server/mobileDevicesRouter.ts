import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAllUsers } from "./db";
import { protectedProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import {
  canManageAllMobileDevices,
  decideDeviceGrant,
  describeDeviceGrant,
  displayNameOf,
  drizzleMobileAuthStore,
  mobileLookupLimiter,
  revokeMobileAccessTokenById,
  toMobileDeviceView,
  type MobileAuthStore,
} from "./mobileAuth";

const userCodeInput = z.object({ userCode: z.string().trim().min(1).max(32) });

const DECIDE_FAILURE_MESSAGES = {
  invalid_code: "確認コードの形式が正しくありません（例: BCDF-GHJK）",
  not_found: "この確認コードの連携申請は見つかりません。アプリで連携をやり直してください",
  expired: "確認コードの有効期限（10分）が切れています。アプリで連携をやり直してください",
  decided: "この連携申請はすでに処理済みです",
} as const;

/** 承認・拒否は Web ブラウザでログインしたセッションに限定する（端末トークンで別端末を承認させない）。 */
function assertWebSession(ctx: Pick<TrpcContext, "authMethod">) {
  if (ctx.authMethod !== "cookie") {
    throw new TRPCError({ code: "FORBIDDEN", message: "端末連携の承認は Web 版 Store-OSX にログインして行ってください" });
  }
}

function assertLookupRate(userId: number) {
  if (!mobileLookupLimiter(`user:${userId}`)) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "確認コードの入力が多すぎます。しばらく待ってから再度お試しください" });
  }
}

export function createMobileDevicesRouter(store: MobileAuthStore = drizzleMobileAuthStore) {
  return router({
    /** 承認画面に出す申請内容（端末名・OS・申請時刻）。 */
    lookup: protectedProcedure.input(userCodeInput).query(async ({ ctx, input }) => {
      assertWebSession(ctx);
      assertLookupRate(ctx.user.id);
      return describeDeviceGrant(store, input.userCode);
    }),

    approve: protectedProcedure.input(userCodeInput).mutation(async ({ ctx, input }) => {
      assertWebSession(ctx);
      assertLookupRate(ctx.user.id);
      const result = await decideDeviceGrant(store, { userCode: input.userCode, userId: ctx.user.id, decision: "approve" });
      if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: DECIDE_FAILURE_MESSAGES[result.reason] });
      return { success: true as const, deviceName: result.deviceName };
    }),

    deny: protectedProcedure.input(userCodeInput).mutation(async ({ ctx, input }) => {
      assertWebSession(ctx);
      assertLookupRate(ctx.user.id);
      const result = await decideDeviceGrant(store, { userCode: input.userCode, userId: ctx.user.id, decision: "deny" });
      if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: DECIDE_FAILURE_MESSAGES[result.reason] });
      return { success: true as const, deviceName: result.deviceName };
    }),

    /** 自分が連携している端末。 */
    listMine: protectedProcedure.query(async ({ ctx }) => {
      const rows = await store.listActiveTokens({ userId: ctx.user.id, now: new Date() });
      return rows.map(toMobileDeviceView);
    }),

    /** 全利用者の連携端末（owner / admin）。 */
    listAll: protectedProcedure.query(async ({ ctx }) => {
      if (!canManageAllMobileDevices(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "全端末の一覧は管理者のみ閲覧できます" });
      }
      const [rows, people] = await Promise.all([store.listActiveTokens({ now: new Date() }), getAllUsers()]);
      const byId = new Map(people.map((person) => [person.id, person]));
      return rows.map((row) => {
        const person = byId.get(row.userId);
        return {
          ...toMobileDeviceView(row),
          userName: person ? displayNameOf(person) : `利用者 #${row.userId}`,
          userRole: person?.role ?? null,
        };
      });
    }),

    /** 連携解除。本人の端末は本人が、全端末は owner / admin が解除できる。 */
    revoke: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const result = await revokeMobileAccessTokenById(store, { id: input.id, actor: ctx.user });
        if (result === "not_found") throw new TRPCError({ code: "NOT_FOUND", message: "連携端末が見つかりません（すでに解除済みの可能性があります）" });
        if (result === "forbidden") throw new TRPCError({ code: "FORBIDDEN", message: "他の利用者の端末は解除できません" });
        return { success: true as const };
      }),
  });
}

export const mobileDevicesRouter = createMobileDevicesRouter();
