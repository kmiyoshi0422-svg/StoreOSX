import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const homeSource = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");

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
});
