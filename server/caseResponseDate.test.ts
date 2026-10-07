import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { jstCalendarDay } from "../shared/emergencySurveyDate";

type User = NonNullable<TrpcContext["user"]>;
function caller(role: User["role"], area?: string[]) {
  const now = new Date();
  return appRouter.createCaller({
    user: { id: role === "owner" ? 1 : 993827, openId: `case-response-${role}`,
      name: role, email: `${role}@example.test`, loginMethod: "manus", role,
      areaAccessMode: area ? "selected" : "all", allowedPrefectures: area ? JSON.stringify(area) : null,
      createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}
const owner = caller("owner"), staff = caller("user", ["山口県"]), outside = caller("user", ["東京都"]);
const partner = caller("partner"), customer = caller("customer");

describe("案件カードの初回対応実績と対応予定", () => {
  let urgentId = 0, ordinaryId = 0, leakId = 0;
  beforeAll(async () => {
    const suffix = Date.now().toString();
    urgentId = (await owner.cases.create({ requestNumber: `TEST-RESPONSE-S-${suffix}`, storeName: "初動日テスト緊急店", prefecture: "山口県", urgency: "S", requestContent: "漏水" })).id;
    ordinaryId = (await owner.cases.create({ requestNumber: `TEST-RESPONSE-A-${suffix}`, storeName: "予定日テスト通常店", prefecture: "山口県", urgency: "A", requestContent: "建具修理" })).id;
    leakId = (await owner.cases.create({ requestNumber: `TEST-RESPONSE-LEAK-${suffix}`, storeName: "初動日テスト漏電店", prefecture: "山口県", urgency: "B", requestContent: "漏電調査" })).id;
  }, 30000);
  afterAll(async () => {
    for (const id of [urgentId, ordinaryId, leakId]) if (id) await owner.cases.delete({ id });
  }, 30000);

  it("緊急S/漏電の初回対応実績を根拠付きで記録・訂正・解除し現調日・完了日・ステータスを変えない", async () => {
    const before = await owner.cases.get({ id: urgentId });
    expect((await staff.cases.setResponseDate({ id: urgentId, kind: "first_response", date: "2026-09-10", note: "担当者の電話連絡記録を確認" })).changed).toBe(true);
    const after = await owner.cases.get({ id: urgentId });
    expect(jstCalendarDay(after?.firstResponseDate)).toBe("2026-09-10");
    expect(after?.surveyDate).toEqual(before?.surveyDate);
    expect(after?.constructionDate).toEqual(before?.constructionDate);
    expect(after?.completedAt).toEqual(before?.completedAt);
    expect(after?.status).toBe(before?.status);
    expect(after?.responsePlannedDate).toBeNull();
    expect((await owner.cases.setResponseDate({ id: urgentId, kind: "first_response", date: "2026-09-10", note: "重複登録しない確認記録" })).changed).toBe(false);
    await owner.cases.setResponseDate({ id: urgentId, kind: "first_response", date: "2026-09-11", note: "記録と照らして日付を訂正" });
    await owner.cases.setResponseDate({ id: urgentId, kind: "first_response", date: null, note: "誤記録と分かり日付を解除" });
    const history = await owner.cases.responseDateHistory({ id: urgentId });
    expect(history).toHaveLength(3);
    expect(history[0]).toMatchObject({ kind: "first_response", recordedBy: 1, note: "誤記録と分かり日付を解除" });
    expect(jstCalendarDay(history[1].beforeDate)).toBe("2026-09-10");
    expect(jstCalendarDay(history[1].afterDate)).toBe("2026-09-11");
    expect((await owner.cases.get({ id: urgentId }))?.firstResponseDate).toBeNull();
    await owner.cases.setResponseDate({ id: leakId, kind: "first_response", date: "2026-09-10", note: "漏電初動の電話履歴を確認" });
    expect(jstCalendarDay((await owner.cases.get({ id: leakId }))?.firstResponseDate)).toBe("2026-09-10");
  }, 30000);

  it("高Aの通常案件は対応予定だけを保存・変更・解除でき、実績には転用しない", async () => {
    expect((await staff.cases.setResponseDate({ id: ordinaryId, kind: "planned_response", date: "2027-01-31" })).changed).toBe(true);
    const updated = await owner.cases.get({ id: ordinaryId });
    expect(jstCalendarDay(updated?.responsePlannedDate)).toBe("2027-01-31");
    expect(updated?.firstResponseDate).toBeNull();
    expect(updated?.surveyDate).toBeNull();
    await owner.cases.setResponseDate({ id: ordinaryId, kind: "planned_response", date: null, note: "日程再調整" });
    const logs = await owner.cases.responseDateHistory({ id: ordinaryId });
    expect(logs).toHaveLength(2);
    expect(logs[0].note).toBe("日程再調整");
    expect((await owner.cases.get({ id: ordinaryId }))?.responsePlannedDate).toBeNull();
  }, 30000);

  it("外部・担当外・区分違い・将来の実績日・一般更新を拒否し外部には日付を返さない", async () => {
    for (const who of [partner, customer, outside]) {
      await expect(who.cases.setResponseDate({ id: urgentId, kind: "first_response", date: "2026-09-10", note: "現地確認の記録がある" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(who.cases.responseDateHistory({ id: urgentId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(owner.cases.setResponseDate({ id: urgentId, kind: "planned_response", date: "2027-01-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(owner.cases.setResponseDate({ id: ordinaryId, kind: "first_response", date: "2026-09-10", note: "誤った種別の入力テスト" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(owner.cases.setResponseDate({ id: urgentId, kind: "first_response", date: "2099-01-01", note: "未来の日付は拒否する" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(owner.cases.setResponseDate({ id: ordinaryId, kind: "planned_response", date: "2026-02-30" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(owner.cases.update({ id: urgentId, data: { firstResponseDate: new Date() } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(owner.cases.update({ id: ordinaryId, data: { responsePlannedDate: new Date() } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const visible = await partner.cases.get({ id: leakId });
    expect(visible?.firstResponseDate).toBeNull();
    expect(visible?.responsePlannedDate).toBeNull();
    const summary = (await partner.cases.listSummary()).find(c => c.id === leakId);
    expect(summary?.firstResponseDate).toBeNull();
  }, 30000);
});
