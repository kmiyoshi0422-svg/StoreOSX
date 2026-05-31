import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { DEFAULT_CHECKLIST } from "../shared/checklist-template";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createAuthContext("admin");
}

describe("cases router", () => {
  it("案件一覧を取得できる（配列を返す）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.cases.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("checklist template", () => {
  it("デフォルトチェックリストが業務フロー順で4フェーズ揃っている", () => {
    const phases = new Set(DEFAULT_CHECKLIST.map((i) => i.phase));
    expect(phases.has("受付")).toBe(true);
    expect(phases.has("現調")).toBe(true);
    expect(phases.has("施工")).toBe(true);
    expect(phases.has("完了")).toBe(true);
  });

  it("デフォルトチェックリストの項目数が十分にある（30件以上）", () => {
    expect(DEFAULT_CHECKLIST.length).toBeGreaterThanOrEqual(30);
  });
});

describe("cases.summary 予実集計", () => {
  it("予実サマリーAPIが数値フィールドを返す（管理者のみ）", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cases.summary();
    expect(result).toBeDefined();
    expect(typeof result.totalEstimated).toBe("number");
    expect(typeof result.totalActual).toBe("number");
    expect(typeof result.diff).toBe("number");
    // 差分 = 実績 - 予算（見積×75%）
    expect(result.diff).toBe(result.totalActual - result.totalBudget);
  });
});

describe("cases.bulkImport CSV一括登録", () => {
  it("空配列を渡すとエラーになる（最低1件必要）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.cases.bulkImport({ rows: [] })).rejects.toThrow();
  });

  it("必須項目が揃っていれば一括登録できる", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const stamp = Date.now();
    const result = await caller.cases.bulkImport({
      rows: [
        {
          requestNumber: `TEST-${stamp}-1`,
          storeName: "テスト店舗A",
          brand: "ほっともっと",
          status: "受付",
          urgency: "B",
        },
        {
          requestNumber: `TEST-${stamp}-2`,
          storeName: "テスト店舗B",
          brand: "やよい軒",
          status: "受付",
          urgency: "C",
        },
      ],
    });
    expect(result.inserted).toBe(2);
  });
});

describe("cases.monthlyReport 月次レポート", () => {
  it("月次・店舗別集計を取得できる（管理者のみ）", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const res = await caller.cases.monthlyReport();
    expect(res).toHaveProperty("monthly");
    expect(res).toHaveProperty("byStore");
    expect(Array.isArray(res.monthly)).toBe(true);
    expect(Array.isArray(res.byStore)).toBe(true);
  });
});

describe("checklist.toggle 自動ステータス遷移", () => {
  it("受付フェーズの全項目をチェックすると現調中に進む", { timeout: 30000 }, async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const created = await caller.cases.create({
      requestNumber: `AUTO-${Date.now()}`,
      brand: "ほっともっと",
      storeName: "自動遷移テスト店",
      categoryLarge: "電気",
      categoryMedium: "コンセント",
    });
    const id = created.id;
    const items = await caller.checklist.listByCase({ caseId: id });
    const receptionItems = items.filter((i) => i.phase === "受付");
    expect(receptionItems.length).toBeGreaterThan(0);
    let lastResult: { success: boolean; autoAdvanced: { from: string; to: string } | null } | null = null;
    for (const it of receptionItems) {
      lastResult = await caller.checklist.toggle({ id: it.id, checked: true });
    }
    expect(lastResult?.autoAdvanced).not.toBeNull();
    expect(lastResult?.autoAdvanced?.to).toBe("現調中");
    const after = await caller.cases.get({ id });
    expect(after?.status).toBe("現調中");
    await caller.cases.delete({ id });
  });
});


describe("partners router 協力会社マスタ", () => {
  it("create→list→update→delete のフルライフサイクル", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    const before = await caller.partners.list();
    const beforeCount = before.length;

    const created = await caller.partners.create({
      name: `テスト電気${Date.now()}`,
      category: "電気",
      phone: "092-123-4567",
      pic: "山田太郎",
      picPhone: "090-1234-5678",
      isActive: true,
    });
    expect(created.id).toBeGreaterThan(0);

    const afterCreate = await caller.partners.list();
    expect(afterCreate.length).toBe(beforeCount + 1);

    await caller.partners.update({
      id: created.id,
      data: { pic: "鈴木一郎", category: "給排水" },
    });
    const got = await caller.partners.get({ id: created.id });
    expect(got?.pic).toBe("鈴木一郎");
    expect(got?.category).toBe("給排水");

    await caller.partners.delete({ id: created.id });
    const afterDelete = await caller.partners.list();
    expect(afterDelete.length).toBe(beforeCount);
  }, 30000);
});

describe("v5: 業種自動推薦", () => {
  it("大項目「電気」から推薦カテゴリ「電気」が返る", async () => {
    const { recommendPartnerCategories } = await import("../shared/checklist-template");
    expect(recommendPartnerCategories("電気", null)).toEqual(["電気"]);
  });

  it("中項目「グリストラップ」を優先して給排水を返す", async () => {
    const { recommendPartnerCategories } = await import("../shared/checklist-template");
    expect(recommendPartnerCategories("内外装・サッシ・建築", "グリストラップ")).toEqual(["給排水"]);
  });

  it("マッピングがない大項目は空配列を返す", async () => {
    const { recommendPartnerCategories } = await import("../shared/checklist-template");
    expect(recommendPartnerCategories(null, null)).toEqual([]);
    expect(recommendPartnerCategories("不明", null)).toEqual([]);
  });
});

describe("v5: partners.history 発注履歴", () => {
  it("協力会社の累計サマリーが集計される", { timeout: 30000 }, async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const stamp = Date.now();
    const created = await caller.partners.create({
      name: `履歴テスト${stamp}`,
      category: "電気",
      isActive: true,
    });
    // 案件を2件作成して紐付け
    const c1 = await caller.cases.create({
      requestNumber: `HIST-${stamp}-1`,
      brand: "ほっともっと",
      storeName: "履歴テスト店",
      workType: "修理",
      costBearer: "店舗",
      status: "受付",
      urgency: "B",
      partnerId: created.id,
      estimatedCost: 50000,
      actualCost: 48000,
    });
    await caller.cases.create({
      requestNumber: `HIST-${stamp}-2`,
      brand: "ほっともっと",
      storeName: "履歴テスト店",
      workType: "修理",
      costBearer: "店舗",
      status: "完了",
      urgency: "C",
      partnerId: created.id,
      estimatedCost: 30000,
      actualCost: 31000,
    });

    const result = await caller.partners.history({ partnerId: created.id });
    expect(result.partner?.id).toBe(created.id);
    expect(result.summary.totalCases).toBeGreaterThanOrEqual(2);
    expect(result.summary.totalEstimated).toBeGreaterThanOrEqual(80000);
    expect(result.summary.totalActual).toBeGreaterThanOrEqual(79000);
    expect(typeof result.summary.statusCounts).toBe("object");

    // クリーンアップ
    await caller.cases.delete({ id: c1.id });
    // 紐付けが残るので、削除前にpartnerId外す手間は省略しpartner deleteへ
  });
});

describe("予算75%計算と管理者ガード", () => {
  it("calcBudgetは見積金額の75%を返す", async () => {
    const { calcBudget, BUDGET_RATIO } = await import("../shared/budget");
    expect(BUDGET_RATIO).toBe(0.75);
    expect(calcBudget(100000)).toBe(75000);
    expect(calcBudget(0)).toBe(0);
    expect(calcBudget(null)).toBe(0);
    expect(calcBudget(undefined)).toBe(0);
  });

  it("一般ユーザーはcases.summaryを呼び出せない（FORBIDDEN）", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(caller.cases.summary()).rejects.toThrow();
  });

  it("一般ユーザーはcases.monthlyReportを呼び出せない（FORBIDDEN）", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(caller.cases.monthlyReport()).rejects.toThrow();
  });

  it("summaryのtotalBudgetは見積合計の75%相当である", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cases.summary();
    const expected = Math.round((result.totalEstimated ?? 0) * 0.75);
    expect(Math.abs((result.totalBudget ?? 0) - expected)).toBeLessThanOrEqual(1);
  });
});

describe("v8: partners.bulkCreate 一括登録", () => {
  it("空配列はエラー（1件以上必要）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.partners.bulkCreate({ rows: [] as any })).rejects.toThrow();
  });

  it("複数件の協力会社を一括登録できる", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const stamp = Date.now();
    const res = await caller.partners.bulkCreate({
      rows: [
        { name: `テスト電気${stamp}A`, category: "電気" },
        { name: `テスト給排水${stamp}B`, category: "給排水", phone: "03-0000-0000" },
      ],
    });
    expect(res.inserted).toBe(2);
    expect(res.results.every((r) => r.ok)).toBe(true);
  });
});

describe("v8: cases.uploadPdf / partners.uploadFile 入力バリデーション", () => {
  it("uploadPdf の返り値に fileKey と url が含まれる", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    // 1ピクセルのダミーバイトをbase64化
    const tinyPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]).toString("base64");
    const res = await caller.cases.uploadPdf({
      fileName: "test.pdf",
      fileBase64: tinyPng,
      mimeType: "application/pdf",
    });
    expect(res.fileKey).toMatch(/^imports\//);
    expect(res.url).toMatch(/^\/manus-storage\//);
  });

  it("partners.extractFromFile は fileKey を要求する", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.partners.extractFromFile({ fileKey: "" as any, mimeType: "image/png" })
    ).rejects.toThrow();
  });

  it("cases.extractFromPdf は fileKey を要求する", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.cases.extractFromPdf({ fileKey: "" as any })).rejects.toThrow();
  });
});
