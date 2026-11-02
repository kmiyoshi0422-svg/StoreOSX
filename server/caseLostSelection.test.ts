import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { TrpcContext } from "./_core/context";
import { LOST_REASON_OPTIONS } from "../shared/caseLost";
const state = vi.hoisted(() => ({
  current: {} as any,
  getCaseById: vi.fn(), updateCase: vi.fn(), createStatusLog: vi.fn(),
  createPartnerAssignmentNotification: vi.fn(), getChecklistItemById: vi.fn(),
  getChecklistByCaseId: vi.fn(), updateChecklistItem: vi.fn(),
}));
vi.mock("./db", async (original) => ({ ...(await original<typeof import("./db")>()), ...state }));
import { appRouter } from "./routers";
function context(role: NonNullable<TrpcContext["user"]>["role"] = "owner"): TrpcContext {
  const now = new Date();
  return { user: { id: 1, openId: "TEST-LOST", name: "確認者", email: "test-lost@example.invalid", role, loginMethod: "manus", createdAt: now, updatedAt: now, lastSignedIn: now }, req: { headers: {}, protocol: "https" } as any, res: {} as any };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.current = { id: 101, requestNumber: "TEST-LOST-101", storeName: "失注テスト店舗", status: "見積中", progressStage: "現調済", prefecture: "福岡県", partnerId: null, assigneeId: 10, constructionDate: new Date("2026-12-01T03:00:00Z"), completedAt: new Date("2026-10-29T03:00:00Z"), preLostStatus: null, lostReason: null };
  state.getCaseById.mockImplementation(async () => ({ ...state.current }));
  state.updateCase.mockImplementation(async (_id, next) => { Object.assign(state.current, next); });
  state.createStatusLog.mockResolvedValue(1);
  state.getChecklistItemById.mockResolvedValue({ id: 201, caseId: 101, phase: "施工", checked: true });
  state.getChecklistByCaseId.mockResolvedValue([{ id: 201, caseId: 101, phase: "施工", checked: true }]);
  state.updateChecklistItem.mockResolvedValue(undefined);
});
describe("失注選択と復活のAPI", () => {
  it.each(LOST_REASON_OPTIONS)("理由$valueで保存し実完了日・担当・予定・進捗を保持", async ({ value }) => {
    const before = { ...state.current };
    const caller = appRouter.createCaller(context("user"));
    await caller.dashboard.markCaseLost({ caseId: 101, reason: value, reasonDetail: value === "その他" ? "別の理由の詳細" : null });
    expect(state.current).toMatchObject({ status: "失注", lostReason: value, preLostStatus: "見積中", progressStage: before.progressStage, assigneeId: before.assigneeId, constructionDate: before.constructionDate, completedAt: before.completedAt });
    expect(state.updateCase.mock.calls[0][1]).not.toHaveProperty("progressStage");
    expect(state.updateCase.mock.calls[0][1]).not.toHaveProperty("completedAt");
    expect(state.createStatusLog).toHaveBeenCalledWith(expect.objectContaining({ fromStatus: "見積中", toStatus: "失注" }));
  });
  it.each(["受付", "現調中", "見積中", "施工待ち", "施工中", "完了", "クローズ"])("失注前が%sでも元の状態と既存日付へ復活", async status => {
    state.current.status = status;
    const before = { ...state.current };
    const caller = appRouter.createCaller(context());
    await caller.dashboard.markCaseLost({ caseId: 101, reason: "高額なため" });
    await expect(caller.dashboard.reviveLostCase({ caseId: 101 })).resolves.toMatchObject({ status });
    expect(state.current).toMatchObject({ status, preLostStatus: null, lostReason: null, progressStage: before.progressStage, completedAt: before.completedAt, constructionDate: before.constructionDate });
  });
  it("その他の空白理由と1000文字超を保存しない", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.dashboard.markCaseLost({ caseId: 101, reason: "その他", reasonDetail: "  " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.dashboard.markCaseLost({ caseId: 101, reason: "その他", reasonDetail: "あ".repeat(1001) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.updateCase).not.toHaveBeenCalled();
  });
  it("通常ステータス更新では理由なし失注にできない", async () => {
    await expect(appRouter.createCaller(context()).cases.update({ id: 101, data: { status: "失注" }, forceStage: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.updateCase).not.toHaveBeenCalled();
  });
  it("通常ステータス・強制進捗・完了報告では失注を復活できない", async () => {
    state.current.status = "失注";
    const caller = appRouter.createCaller(context());
    await expect(caller.cases.update({ id: 101, data: { status: "受付" } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.cases.update({ id: 101, data: { progressStage: "承認済" }, forceStage: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.statusLogs.completeWithReport({ caseId: 101, comment: "完了", photos: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.updateCase).not.toHaveBeenCalled();
  });
  it("失注中も同じ状態を維持する備考の更新はできる", async () => {
    state.current.status = "失注";
    await expect(appRouter.createCaller(context()).cases.update({ id: 101, data: { status: "失注", notes: "再提出確認中" } })).resolves.toMatchObject({ success: true });
    expect(state.current).toMatchObject({ status: "失注", notes: "再提出確認中", progressStage: "現調済" });
  });
  it.each(["partner", "customer"] as const)("%sは失注・復活を操作できない", async role => {
    const caller = appRouter.createCaller(context(role));
    await expect(caller.dashboard.markCaseLost({ caseId: 101, reason: "高額なため" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.current.status = "失注";
    await expect(caller.dashboard.reviveLostCase({ caseId: 101 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.updateCase).not.toHaveBeenCalled();
  });
  it("エリア外の社員は失注・復活にできない", async () => {
    const ctx = context("user"); Object.assign(ctx.user!, { areaAccessMode: "selected", allowedPrefectures: ["大阪府"] });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.markCaseLost({ caseId: 101, reason: "高額なため" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.current.status = "失注";
    await expect(caller.dashboard.reviveLostCase({ caseId: 101 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.updateCase).not.toHaveBeenCalled();
  });
  it("失注中の単件・一括チェックは自動的に工事完了にしない", async () => {
    state.current.status = "失注";
    const caller = appRouter.createCaller(context());
    await expect(caller.checklist.toggle({ id: 201, checked: true })).resolves.toMatchObject({ autoAdvanced: null });
    await expect(caller.checklist.bulkToggle({ ids: [201], checked: true })).resolves.toMatchObject({ autoAdvanced: null });
    expect(state.updateCase).not.toHaveBeenCalled();
  });
});
describe("失注の選択UI契約", () => {
  it("詳細の状態選択に失注があり、一覧の3形式は理由ダイアログへ接続", () => {
    const detail = readFileSync("client/src/pages/CaseDetail.tsx", "utf8");
    const list = readFileSync("client/src/pages/CasesList.tsx", "utf8");
    expect(detail).toContain('<SelectItem value="失注"');
    expect(detail).toContain("<CaseLostStatusDialog");
    expect(list.match(/renderStatusOptions\(c.status\)/g)).toHaveLength(4);
    expect(list).toContain('aria-label={`${c.requestNumber}のステータス`}');
    expect(list).toContain("setLostAction");
    expect(list).toContain("REVIVE_LOST_OPTION");
  });
  it("4つの理由はネイティブのタップ選択で、保存中・その他必須・入力保持", () => {
    const dialog = readFileSync("client/src/components/CaseLostStatusDialog.tsx", "utf8");
    expect(LOST_REASON_OPTIONS).toHaveLength(4);
    expect(dialog).toContain('type="radio"');
    expect(dialog).toContain('max-h-[90dvh]');
    expect(dialog).toContain('reason === "その他" && !detail.trim()');
    expect(dialog).toContain('disabled={busy}');
    expect(dialog).toContain('onError: error => toast.error(error.message)');
  });
});
