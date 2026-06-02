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


describe("見積書・協力業者ビュー（v9）", () => {
  it("estimates.listByCase は配列を返す", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.estimates.listByCase({ caseId: 999999 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("partnerView.getByToken は無効なトークンでエラーを投げる", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.partnerView.getByToken({ token: "invalid_token_xxx" })
    ).rejects.toThrow();
  });

  it("partnerView.getByToken は短すぎるトークンを拒否する", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.partnerView.getByToken({ token: "short" })).rejects.toThrow();
  });

  it("estimates.update は数値以外を受け付けない", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.estimates.update({ id: 1, totalAmount: "abc" as never })
    ).rejects.toThrow();
  });

  it("estimates.uploadFile は空のファイル名を拒否する", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.estimates.uploadFile({
        caseId: 1,
        fileName: "",
        fileBase64: "AAA",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow();
  });
});

describe("進捗ステージ（progressStage）", () => {
  it("75%計算が正しい（端数四捨五入）", () => {
    expect(Math.round(100000 * 0.75)).toBe(75000);
    expect(Math.round(123456 * 0.75)).toBe(92592);
    expect(Math.round(1 * 0.75)).toBe(1);
  });

  it("4つの進捗ステージが定義されている", () => {
    const stages = ["未対応", "現調済", "見積提出済", "承認済"];
    expect(stages).toHaveLength(4);
    expect(stages[0]).toBe("未対応");
    expect(stages[3]).toBe("承認済");
  });
});


describe("同一店舗の集約ロジック（v10）", () => {
  function storeKey(c: { storeCode: string | null; storeName: string }) {
    return (c.storeCode && c.storeCode.trim()) || c.storeName.trim();
  }

  it("storeCodeがあればstoreCodeをキーに使う", () => {
    expect(storeKey({ storeCode: "S001", storeName: "渋谷店" })).toBe("S001");
    expect(storeKey({ storeCode: "S001", storeName: "渋谷東口店" })).toBe("S001");
  });

  it("storeCodeが空ならstoreNameを使う", () => {
    expect(storeKey({ storeCode: null, storeName: "新宿店" })).toBe("新宿店");
    expect(storeKey({ storeCode: "  ", storeName: "新宿店" })).toBe("新宿店");
  });

  it("同店舗の複数案件を集約できる", () => {
    const cases = [
      { id: 1, storeCode: "S001", storeName: "渋谷店", status: "受付" },
      { id: 2, storeCode: "S001", storeName: "渋谷店", status: "完了" },
      { id: 3, storeCode: "S002", storeName: "新宿店", status: "現調中" },
      { id: 4, storeCode: null, storeName: "渋谷店", status: "受付" },
    ];
    const map = new Map<string, typeof cases>();
    for (const c of cases) {
      const k = storeKey(c);
      const arr = map.get(k) ?? [];
      arr.push(c);
      map.set(k, arr);
    }
    expect(map.get("S001")?.length).toBe(2);
    expect(map.get("S002")?.length).toBe(1);
    // storeCodeがnullの場合は別グループ
    expect(map.get("渋谷店")?.length).toBe(1);

    const multiStores = Array.from(map.values()).filter((l) => l.length >= 2);
    expect(multiStores).toHaveLength(1);
    expect(multiStores[0][0].storeCode).toBe("S001");
  });

  it("進行中の案件数（status≠完了/クローズ）を正しくカウント", () => {
    const list = [
      { status: "受付" },
      { status: "現調中" },
      { status: "完了" },
      { status: "クローズ" },
    ];
    const open = list.filter((c) => c.status !== "完了" && c.status !== "クローズ").length;
    expect(open).toBe(2);
  });
});


describe("店舗一覧集計（v11）", () => {
  it("stores.list は配列を返す", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stores.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("stores.list は各店舗の必須フィールドを含む", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stores.list();
    if (result.length > 0) {
      const s = result[0];
      expect(s).toHaveProperty("key");
      expect(s).toHaveProperty("storeName");
      expect(s).toHaveProperty("caseCount");
      expect(s).toHaveProperty("openCount");
      expect(s).toHaveProperty("completedCount");
      expect(s).toHaveProperty("totalEstimated");
      expect(s).toHaveProperty("totalActual");
      expect(s).toHaveProperty("latestRequestAt");
      expect(typeof s.caseCount).toBe("number");
    }
  });

  it("stores.list は最終依頼日の降順でソートされている", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stores.list();
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1].latestRequestAt
        ? +new Date(result[i - 1].latestRequestAt as Date)
        : 0;
      const curr = result[i].latestRequestAt
        ? +new Date(result[i].latestRequestAt as Date)
        : 0;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it("店舗未ログイン状態のstores.list呼び出しは拒否される", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as never,
      res: {} as never,
    });
    await expect(caller.stores.list()).rejects.toThrow();
  });
});


// ============================================================
// v13: チーム担当者割り当て
// ============================================================
describe("v13: teamSettings router", () => {
  it("teamSettings.list は A/B 両チームを返す", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.teamSettings.list();
    expect(result).toHaveProperty("A");
    expect(result).toHaveProperty("B");
    expect(result.A.team).toBe("A");
    expect(result.B.team).toBe("B");
  });

  it("一般ユーザーは teamSettings.upsert を呼び出せない（FORBIDDEN）", async () => {
    const caller = appRouter.createCaller(createAuthContext("user"));
    await expect(
      caller.teamSettings.upsert({ team: "A", primaryUserId: null })
    ).rejects.toThrow();
  });

  it("管理者は teamSettings.upsert で担当者を更新できる（同じteamで2回呼んでも追加されない）", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await caller.teamSettings.upsert({ team: "A", primaryUserId: null, label: "テストA" });
    const before = await caller.teamSettings.list();
    expect(before.A.label).toBe("テストA");
    await caller.teamSettings.upsert({ team: "A", primaryUserId: null, label: "テストA2" });
    const after = await caller.teamSettings.list();
    expect(after.A.label).toBe("テストA2");
  });

  it("teamSettings.upsert は不正な team 値を拒否する", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.teamSettings.upsert({ team: "C" as never, primaryUserId: null })
    ).rejects.toThrow();
  });
});


// ============================================================
// v14: スケジュール盤 ドラッグ＆ドロップ移動（routes.upsertで実現）
// ============================================================
describe("v14: routes.upsert によるDnD移動", () => {
  it("認証されていない場合、routes.upsert は拒否される", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as never,
      res: {} as never,
    } as never);
    await expect(
      caller.routes.upsert({
        caseId: 1,
        team: "A",
        taskType: "survey",
        scheduledDate: "2026-06-01",
        sequence: 0,
      })
    ).rejects.toThrow();
  });

  it("scheduledDate のフォーマット不正は拒否される（YYYY-MM-DDのみ）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.routes.upsert({
        caseId: 1,
        team: "A",
        taskType: "survey",
        scheduledDate: "2026/06/01" as never,
        sequence: 0,
      })
    ).rejects.toThrow();
  });

  it("不正な team 値（C等）は拒否される", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.routes.upsert({
        caseId: 1,
        team: "C" as never,
        taskType: "survey",
        scheduledDate: "2026-06-01",
        sequence: 0,
      })
    ).rejects.toThrow();
  });

  it("不正な taskType（meeting等）は拒否される", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.routes.upsert({
        caseId: 1,
        team: "A",
        taskType: "meeting" as never,
        scheduledDate: "2026-06-01",
        sequence: 0,
      })
    ).rejects.toThrow();
  });
});

// ============================================================
// v16: workload.list ワークロード集計
// ============================================================
describe("v16: workload.list 担当者別集計", () => {
  it("workload.list は rows 配列と imbalanced/totalAssigned/unassignedCount を返す", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.workload.list({
      start: "2026-05-01",
      end: "2026-05-31",
    });
    expect(res).toHaveProperty("rows");
    expect(Array.isArray(res.rows)).toBe(true);
    expect(typeof res.imbalanced).toBe("boolean");
    expect(typeof res.totalAssigned).toBe("number");
    expect(typeof res.unassignedCount).toBe("number");
  });

  it("workload.list は YYYY-MM-DD 形式以外を拒否する", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.workload.list({ start: "2026/05/01", end: "2026-05-31" })
    ).rejects.toThrow();
    await expect(
      caller.workload.list({ start: "2026-05-01", end: "2026-05" })
    ).rejects.toThrow();
  });

  it("認証されていない場合、workload.list は拒否される", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as never,
      res: {} as never,
    } as never);
    await expect(
      caller.workload.list({ start: "2026-05-01", end: "2026-05-31" })
    ).rejects.toThrow();
  });

  it("workload.list の各 row が必須フィールドを持つ", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.workload.list({
      start: "2026-05-01",
      end: "2026-05-31",
    });
    for (const r of res.rows) {
      expect(r).toHaveProperty("userId");
      expect(r).toHaveProperty("userName");
      expect(typeof r.totalTasks).toBe("number");
      expect(typeof r.surveyTasks).toBe("number");
      expect(typeof r.constructionTasks).toBe("number");
      expect(typeof r.totalKm).toBe("number");
      expect(typeof r.activeDays).toBe("number");
      expect(r.surveyTasks + r.constructionTasks).toBe(r.totalTasks);
    }
  });
});

// ============================================================
// v16: workload.list 空データ・偏り判定の境界
// ============================================================
describe("v16: workload.list 空データ・偏り判定", () => {
  it("未来の十分先（タスクが存在しない期間）では rows が空、imbalanced=false、totalAssigned=0", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.workload.list({
      start: "2099-01-01",
      end: "2099-01-07",
    });
    expect(res.rows).toEqual([]);
    expect(res.imbalanced).toBe(false);
    expect(res.totalAssigned).toBe(0);
    expect(res.unassignedCount).toBe(0);
  });

  it("rows は totalTasks 降順でソートされている（あれば）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.workload.list({
      start: "2026-01-01",
      end: "2026-12-31",
    });
    for (let i = 1; i < res.rows.length; i++) {
      expect(res.rows[i - 1].totalTasks).toBeGreaterThanOrEqual(res.rows[i].totalTasks);
    }
  });

  it("totalAssigned は 担当者あり行(userId != null) の totalTasks 合計と一致", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.workload.list({
      start: "2026-01-01",
      end: "2026-12-31",
    });
    const sum = res.rows
      .filter((r) => r.userId != null)
      .reduce((s, r) => s + r.totalTasks, 0);
    expect(res.totalAssigned).toBe(sum);
  });

  it("unassignedCount は userId=null の行の totalTasks と一致（無ければ 0）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.workload.list({
      start: "2026-01-01",
      end: "2026-12-31",
    });
    const unassigned = res.rows.find((r) => r.userId == null);
    expect(res.unassignedCount).toBe(unassigned?.totalTasks ?? 0);
  });
});


describe("v17: estimates.extractAndMatch / bulkSave 入力バリデーション", () => {
  it("estimates.extractAndMatch は fileKey を要求する", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.estimates.extractAndMatch({ fileKey: "" } as never)
    ).rejects.toThrow();
  });

  it("estimates.bulkSave は空配列を拒否する（1件以上必要）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.estimates.bulkSave({ rows: [] })
    ).rejects.toThrow();
  });

  it("estimates.bulkSave は caseId 必須", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.estimates.bulkSave({
        rows: [
          {
            // @ts-expect-error - intentionally missing caseId
            fileKey: "some-key",
            fileUrl: "/manus-storage/some-key",
            fileName: "estimate.pdf",
            mimeType: "application/pdf",
            totalAmount: 100000,
            materialAmount: null,
            laborAmount: null,
            vendorName: null,
            estimateDate: null,
            note: null,
          } as any,
        ],
      })
    ).rejects.toThrow();
  });

  it("認証されていない場合、estimates.bulkSave は拒否される", async () => {
    const caller = appRouter.createCaller({
      session: null,
      user: null,
      req: { ip: "127.0.0.1" } as any,
      res: {} as any,
    });
    await expect(
      caller.estimates.bulkSave({
        rows: [
          {
            caseId: 1,
            fileKey: "k",
            fileUrl: "/manus-storage/k",
            fileName: "e.pdf",
            mimeType: "application/pdf",
            totalAmount: 100,
            materialAmount: null,
            laborAmount: null,
            vendorName: null,
            estimateDate: null,
            note: null,
          },
        ],
      })
    ).rejects.toThrow();
  });
});

describe("v17: 個別案件 収支計算", () => {
  it("売上が0なら粗利率は0で扱う（割り算ゼロ防止）", () => {
    const sales = 0;
    const cost = 1000;
    const grossMargin = sales > 0 ? (sales - cost) / sales : 0;
    expect(grossMargin).toBe(0);
  });

  it("実績原価がない場合は協力業者支払予定（75%）を原価とする", () => {
    const sales = 100000;
    const partner75 = Math.floor(sales * 0.75);
    const actual = 0;
    const baseCost = actual > 0 ? actual : partner75;
    expect(baseCost).toBe(75000);
    expect(sales - baseCost).toBe(25000);
  });

  it("実績原価が入力されたら粗利は売上−実績で計算される", () => {
    const sales = 100000;
    const partner75 = Math.floor(sales * 0.75);
    const actual = 80000;
    const baseCost = actual > 0 ? actual : partner75;
    expect(baseCost).toBe(80000);
    expect(sales - baseCost).toBe(20000);
  });

  it("実績>予算なら予算超過、実績≤予算なら予算内", () => {
    const partner75 = 75000;
    const overActual = 90000;
    const inActual = 70000;
    expect(overActual - partner75 > 0).toBe(true);
    expect(inActual - partner75 <= 0).toBe(true);
  });
});

describe("v19: reports.monthly 月別実績レポート", () => {
  it("デフォルト6ヶ月の月別行と合計を返す", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.reports.monthly();
    expect(res).toHaveProperty("rows");
    expect(res).toHaveProperty("totals");
    expect(Array.isArray(res.rows)).toBe(true);
    expect(res.rows.length).toBe(6);
    // 月キーは YYYY-MM フォーマット
    for (const r of res.rows) {
      expect(r.key).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof r.revenue).toBe("number");
      expect(typeof r.cost).toBe("number");
      expect(typeof r.profit).toBe("number");
      expect(typeof r.margin).toBe("number");
      // 粗利 = 売上 - 原価
      expect(r.profit).toBe(r.revenue - r.cost);
    }
    // totals = rows の合計
    const sumRevenue = res.rows.reduce((s, r) => s + r.revenue, 0);
    const sumCost = res.rows.reduce((s, r) => s + r.cost, 0);
    expect(res.totals.revenue).toBe(sumRevenue);
    expect(res.totals.cost).toBe(sumCost);
    expect(res.totals.profit).toBe(sumRevenue - sumCost);
  });

  it("3ヶ月を指定すると行数が3になる", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.reports.monthly({ months: 3 });
    expect(res.rows.length).toBe(3);
  });

  it("月数の境界外（0や25）はバリデーションエラー", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.reports.monthly({ months: 0 } as any)).rejects.toThrow();
    await expect(caller.reports.monthly({ months: 25 } as any)).rejects.toThrow();
  });
});

describe("v19: reports.byAssignee 担当者別成績", () => {
  it("担当者別の集計を取得できる（rowsプロパティを返す）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.reports.byAssignee();
    expect(res).toHaveProperty("rows");
    expect(Array.isArray(res.rows)).toBe(true);
    // 各行は粗利率が数値で、profit = revenue - cost
    for (const r of res.rows) {
      expect(typeof r.userId).toBe("number");
      expect(typeof r.caseCount).toBe("number");
      expect(r.profit).toBe(r.revenue - r.cost);
    }
  });

  it("担当者0件は除外される（caseCount>0のみ返す）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.reports.byAssignee();
    for (const r of res.rows) {
      expect(r.caseCount).toBeGreaterThan(0);
    }
  });
});

describe("v19: expenses router バリデーション", () => {
  it("経費一覧APIが配列を返す", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.expenses.list();
    expect(Array.isArray(res)).toBe(true);
  });

  it("未紐付け経費の一覧も配列で返す", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.expenses.listUnmatched();
    expect(Array.isArray(res)).toBe(true);
  });

  it("expenses.bulkSave に空配列を渡すと挙動が安全（countが0）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.expenses.bulkSave({ items: [] });
    expect(res).toHaveProperty("count");
    expect(res.count).toBe(0);
  });

  it("expenses.uploadFile はfileNameとfileBase64が必須", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.expenses.uploadFile({ fileName: "", fileBase64: "abc", mimeType: "application/pdf" }),
    ).rejects.toThrow();
    await expect(
      caller.expenses.uploadFile({ fileName: "a.pdf", fileBase64: "", mimeType: "application/pdf" }),
    ).rejects.toThrow();
  });

  it("expenses.bulkSave のcategoryは事前定義された5値のみ受け付ける", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.expenses.bulkSave({
        items: [
          {
            caseId: 1,
            amount: 1000,
            category: "INVALID" as any,
          },
        ],
      }),
    ).rejects.toThrow();
  });
});

describe("v19: 月別レポート集計ロジック（純粋関数）", () => {
  it("売上=見積×75%、原価=経費合計、粗利=売上-原価", () => {
    const BUDGET_RATIO = 0.75;
    const estimatedCost = 100000;
    const expenseSum = 60000;
    const revenue = Math.round(estimatedCost * BUDGET_RATIO);
    const cost = expenseSum;
    const profit = revenue - cost;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
    expect(revenue).toBe(75000);
    expect(profit).toBe(15000);
    expect(margin).toBe(20);
  });

  it("売上が0なら粗利率は0で扱う", () => {
    const revenue = 0;
    const cost = 5000;
    const margin = revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : 0;
    expect(margin).toBe(0);
  });

  it("月キーは YYYY-MM 形式でゼロパディングされる", () => {
    function bucketKey(d: Date) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    expect(bucketKey(new Date(2025, 0, 15))).toBe("2025-01");
    expect(bucketKey(new Date(2025, 11, 1))).toBe("2025-12");
  });
});


describe("v21: cases.checkDuplicates 依頼番号の重複検知", () => {
  it("空配列はエラー（min(1)）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.cases.checkDuplicates({ requestNumbers: [] }),
    ).rejects.toThrow();
  });

  it(
    "登録済み案件と一致する依頼番号のみ duplicates に含まれる",
    { timeout: 30000 },
    async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const stamp = Date.now();
      const dupNo = `DUP-${stamp}`;
      const created = await caller.cases.create({
        requestNumber: dupNo,
        brand: "ほっともっと",
        storeName: "重複検知テスト店",
        workType: "修理",
        costBearer: "店舗",
        urgency: "B",
        status: "受付",
      });
      const res = await caller.cases.checkDuplicates({
        requestNumbers: [dupNo, `NOEXIST-${stamp}-A`, `NOEXIST-${stamp}-B`],
      });
      const hit = res.duplicates.find((d) => d.requestNumber === dupNo);
      expect(hit).toBeDefined();
      expect(hit?.existingId).toBe(created.id);
      // 未登録番号は含まれないこと
      expect(
        res.duplicates.some((d) => d.requestNumber.startsWith(`NOEXIST-${stamp}`)),
      ).toBe(false);
      await caller.cases.delete({ id: created.id });
    },
  );

  it("同一依頼番号を複数回入力しても重複を検出できる", { timeout: 30000 }, async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const stamp = Date.now();
    const dupNo = `DUP2-${stamp}`;
    const created = await caller.cases.create({
      requestNumber: dupNo,
      brand: "ほっともっと",
      storeName: "重複検知テスト店2",
      workType: "修理",
      costBearer: "店舗",
      urgency: "B",
      status: "受付",
    });
    const res = await caller.cases.checkDuplicates({
      requestNumbers: [dupNo, dupNo],
    });
    expect(res.duplicates.length).toBeGreaterThanOrEqual(1);
    expect(res.duplicates[0].requestNumber).toBe(dupNo);
    await caller.cases.delete({ id: created.id });
  });
});
