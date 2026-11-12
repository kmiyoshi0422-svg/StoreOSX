import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { selectAuthCredential } from "../mobileAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /**
   * 認証に使われた資格情報。cookie = Web ブラウザのセッション、mobile = モバイル端末トークン。
   * 端末連携の承認など、Web セッションに限定する操作の判定に使う。
   */
  authMethod?: "cookie" | "mobile" | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let authMethod: TrpcContext["authMethod"] = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
    const credential = selectAuthCredential(opts.req);
    authMethod = credential.kind === "none" ? null : credential.kind;
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    authMethod,
  };
}
