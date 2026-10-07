import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { isEmergencySurveyCase, jstCalendarDay, parseSurveyCalendarDay, sameDaySurveyLabel } from "../shared/emergencySurveyDate";

type User = NonNullable<TrpcContext["user"]>;
function caller(role: User["role"], prefectures?: string[]) {
  const now = new Date();
  return appRouter.createCaller({
    user: {
      id: role === "owner" ? 1 : 993811,
      openId: `emergency-survey-${role}`,
      name: role,
      email: `${role}@example.test`,
      loginMethod: "manus",
      role,
      areaAccessMode: prefectures ? "selected" : "all",
      allowedPrefectures: prefectures ? JSON.stringify(prefectures) : null,
      createdAt: now, updatedAt: now, lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}
const owner = caller("owner");
const staff = caller("user", ["山口県"]);
const outsideStaff = caller("user", ["東京都"]);
const partner = caller("partner");
const customer = caller("customer");
const evidence = { evidenceType: "completion_report" as const, evidenceNote: "完了報告書の現地調査記録を確認" };

describe("緊急案件の現調日（個別・根拠付き）", () => {
  let urgentId = 0;
  let ordinaryId = 0;
  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    urgentId = (await owner.cases.create({ requestNumber: `TEST-SURVEY-URGENT-${suffix}`, storeName: "現調日テスト緊急店", prefecture: "山口県", urgency: "S", requestDate: new Date("2026-09-10T15:10:00+09:00"), requestContent: "停電" })).id;
    ordinaryId = (await owner.cases.create({ requestNumber: `TEST-SURVEY-ORDINARY-${suffix}`, storeName: "現調日テスト通常店", prefecture: "山口県", urgency: "B", requestDate: new Date("2026-09-10T15:10:00+09:00"), requestContent: "ドア調整" })).id;
  }, 30000);
  afterAll(async () => {
    if (urgentId) await owner.cases.delete({ id: urgentId });
    if (ordinaryId) await owner.cases.delete({ id: ordinaryId });
  }, 30000);

  it("漏電または緊急Sのみを対象にし、日本時間の暦日で判定", () => {
    expect(isEmergencySurveyCase({ urgency: "B", requestContent: "漏電調査", categoryLarge: null, categoryMedium: null, categorySmall: null })).toBe(true);
    expect(isEmergencySurveyCase({ urgency: "B", requestContent: "停電", categoryLarge: null, categoryMedium: null, categorySmall: null })).toBe(false);
    expect(parseSurveyCalendarDay("2026-02-30")).toBeNull();
    expect(jstCalendarDay(parseSurveyCalendarDay("2026-09-10")!)).toBe("2026-09-10");
    expect(sameDaySurveyLabel(new Date("2026-09-10T23:45:00+09:00"), new Date("2026-09-11T00:05:00+09:00"))).toBe("別日");
    expect(sameDaySurveyLabel(null, parseSurveyCalendarDay("2026-09-10"))).toBe("判定不可");
  });

  it("緊急現調日を保存・訂正・解除して前後と記録者・根拠を残し、進捗・完了日は変更しない", async () => {
    const original = await owner.cases.get({ id: urgentId });
    expect(original?.surveyDate).toBeNull();
    const saved = await staff.cases.setEmergencySurveyDate({ id: urgentId, date: "2026-09-10", ...evidence });
    expect(saved.changed).toBe(true);
    const after = await owner.cases.get({ id: urgentId });
    expect(jstCalendarDay(after?.surveyDate)).toBe("2026-09-10");
    expect(sameDaySurveyLabel(after?.requestDate, after?.surveyDate)).toBe("同日");
    expect(after?.status).toBe(original?.status);
    expect(after?.progressStage).toBe(original?.progressStage);
    expect(after?.completedAt).toBeNull();
    expect((await staff.cases.setEmergencySurveyDate({ id: urgentId, date: "2026-09-10", ...evidence })).changed).toBe(false);
    expect((await owner.cases.setEmergencySurveyDate({ id: urgentId, date: "2026-09-11", evidenceType: "staff_confirmation", evidenceNote: "担当者に実施日を再確認して訂正" })).changed).toBe(true);
    expect((await owner.cases.setEmergencySurveyDate({ id: urgentId, date: null, evidenceType: "other", evidenceNote: "日付誤登録につき解除" })).changed).toBe(true);
    const history = await owner.cases.emergencySurveyDateHistory({ id: urgentId });
    expect(history).toHaveLength(3);
    expect(history[0]).toMatchObject({ evidenceType: "other", evidenceNote: "日付誤登録につき解除", recordedBy: 1 });
    expect(jstCalendarDay(history[1]?.beforeDate)).toBe("2026-09-10");
    expect(jstCalendarDay(history[1]?.afterDate)).toBe("2026-09-11");
    expect(jstCalendarDay(history[2]?.afterDate)).toBe("2026-09-10");
    expect((await owner.cases.get({ id: urgentId }))?.surveyDate).toBeNull();
  }, 30000);

  it("担当外社員・協力業者・顧客・非緊急案件・通常更新の抜け道を拒否", async () => {
    for (const user of [outsideStaff, partner, customer]) {
      await expect(user.cases.setEmergencySurveyDate({ id: urgentId, date: "2026-09-10", ...evidence })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(user.cases.emergencySurveyDateHistory({ id: urgentId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(owner.cases.setEmergencySurveyDate({ id: ordinaryId, date: "2026-09-10", ...evidence })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(owner.cases.update({ id: urgentId, data: { surveyDate: parseSurveyCalendarDay("2026-09-10") } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(owner.cases.setEmergencySurveyDate({ id: urgentId, date: "2026-02-30", ...evidence })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(owner.cases.setEmergencySurveyDate({ id: urgentId, date: "2099-01-01", ...evidence })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await owner.cases.get({ id: ordinaryId }))?.surveyDate).toBeNull();
  }, 30000);
});
