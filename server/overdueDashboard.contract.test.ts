import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const homeSource = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const accessManagementSource = readFileSync(resolve(root, "client/src/pages/AccessManagement.tsx"), "utf8");
const appSource = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");

describe("経過案件3区分ダッシュボード", () => {
  it("3か月以上・1か月以上・漏電関係と施工予定週を表示する", () => {
    expect(homeSource).toContain("3か月以上");
    expect(homeSource).toContain("1か月以上");
    expect(homeSource).toContain("漏電関係");
    expect(homeSource).toContain("施工予定日（予定週）");
    expect(homeSource).toContain("施工予定日 未設定");
    expect(homeSource).toContain("row.daysElapsed");
  });

  it("行クリックで案件詳細へ遷移する", () => {
    expect(homeSource).toContain("setLocation(`/cases/${row.id}`)");
  });

  it("案件の施工日が未設定なら工事ルート予定だけを補完する", () => {
    expect(routerSource).toContain('route.taskType !== "construction"');
    expect(routerSource).toContain("selectPreferredConstructionDate(constructionDatesByCase.get(item.id) ?? [])");
  });

  it("未設定行から施工予定日と施工業者を選択して保存できる", () => {
    expect(homeSource).toContain("予定日・業者を設定");
    expect(homeSource).toContain("施工予定日・施工業者を設定");
    expect(homeSource).toContain("trpc.dashboard.schedulingOptions.useQuery");
    expect(homeSource).toContain("trpc.dashboard.scheduleCase.useMutation");
    expect(homeSource).toContain("utils.dashboard.overview.invalidate()");
    expect(homeSource).toContain("utils.crossSchedule.list.invalidate()");
  });

  it("partner画面では設定操作を無効化し、APIでも拒否する", () => {
    expect(homeSource).toContain("canEditSchedule={false}");
    expect(homeSource).toContain("{canEditSchedule && (");
    expect(routerSource).toContain('ctx.user.role === "partner"');
    expect(routerSource).toContain("施工予定の設定権限がありません");
  });

  it("設定済み案件を変更・解除し、未設定案件を一括設定できる", () => {
    expect(homeSource).toContain("変更を保存");
    expect(homeSource).toContain("施工予定日と施工業者を解除しますか");
    expect(homeSource).toContain("未設定をすべて選択");
    expect(homeSource).toContain("一括設定する");
    expect(routerSource).toContain("clearScheduleCase: protectedProcedure");
    expect(routerSource).toContain("bulkScheduleCases: protectedProcedure");
  });

  it("協力業者ダッシュボードへ本人宛ての担当案件通知を表示する", () => {
    expect(homeSource).toContain("新しい担当案件のお知らせ");
    expect(homeSource).toContain("trpc.dashboard.partnerNotifications.useQuery");
    expect(homeSource).toContain("すべて既読");
    expect(routerSource).toContain("partnerNotifications: protectedProcedure");
    expect(routerSource).toContain("markPartnerNotificationRead: protectedProcedure");
  });

  it("失注理由を4分類から選び、失注タブから即時復活できる", () => {
    expect(homeSource).toContain("① 高額なため");
    expect(homeSource).toContain("② 対応に不備（遅いなど）");
    expect(homeSource).toContain("③ 別業者手配");
    expect(homeSource).toContain("④ その他");
    expect(homeSource).toContain("trpc.dashboard.markCaseLost.useMutation");
    expect(homeSource).toContain("trpc.dashboard.reviveLostCase.useMutation");
    expect(homeSource).toContain("復活する");
    expect(routerSource).toContain("markCaseLost: protectedProcedure");
    expect(routerSource).toContain("reviveLostCase: protectedProcedure");
  });

  it("管理者画面で役割と閲覧エリアを設定できる", () => {
    expect(appSource).toContain('/settings/access');
    expect(accessManagementSource).toContain("役割・閲覧エリア管理");
    expect(accessManagementSource).toContain("trpc.users.updateAccess.useMutation");
    expect(accessManagementSource).toContain("選択した都道府県のみ");
    expect(routerSource).toContain("updateAccess: adminProcedure");
  });
});
