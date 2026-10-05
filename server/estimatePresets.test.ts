import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { getDb } from "./db";
import {
  estimatePresetItems,
  estimatePresetCategories,
} from "../drizzle/schema";
import { presetToEstimateLine } from "../shared/estimatePresets";
import { calculateEstimate } from "../shared/estimateAssistant";

function person(role: NonNullable<TrpcContext["user"]>["role"]) {
  const now = new Date();
  return appRouter.createCaller({
    user: {
      id: 1,
      openId: `TEST-preset-${role}`,
      name: role,
      role,
      email: `test-${role}@example.invalid`,
      loginMethod: "manus",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}

describe("定型見積メニュー（標準施工単価と独立）", () => {
  const owner = person("owner");
  it("ブラインド・GT・捕虫器・はいはい店番の初期分類を表示し、価格は未登録", async () => {
    const rows = await owner.estimatePresets.list();
    expect(rows.map(x => x.name)).toEqual(
      expect.arrayContaining([
        "ブラインド",
        "GT蓋・GT内かご",
        "捕虫器取付",
        "はいはい店番取付",
      ])
    );
    const gt = rows.find(x => x.id === "grease-trap")!;
    expect(gt.items.map(x => x.name)).toEqual(
      expect.arrayContaining(["GT蓋", "GT内かご"])
    );
    expect(gt.items.every(x => x.unitPrice === null)).toBe(true);
  });
  it("定型追加は数量だけ未知のまま、設定した定型単価だけ使う（標準単価非連動）", () => {
    const base = {
      name: "GT蓋",
      specification: "600×600",
      unit: "枚",
      unitPrice: null,
      note: "現地採寸",
    };
    const unknown = presetToEstimateLine(base, "GT蓋・GT内かご");
    expect(unknown).toMatchObject({
      name: "GT蓋",
      quantity: null,
      unit: "枚",
      unitPrice: null,
    });
    const configured = presetToEstimateLine(
      { ...base, unitPrice: 15000 },
      "GT蓋・GT内かご"
    );
    expect(configured).toMatchObject({ quantity: null, unitPrice: 15000 });
    expect(calculateEstimate([configured])).toMatchObject({
      subtotal: 0,
      missing: 1,
    });
  });
  it.each(["partner", "customer"] as const)(
    "%s はメニュー一覧・変更を利用できない",
    async role => {
      await expect(person(role).estimatePresets.list()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(
        person(role).estimatePresets.saveCategory({
          value: { name: "TEST", sortOrder: 90 },
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  );
  it.each(["admin", "executive", "user"] as const)(
    "%s は定型メニューを利用可能",
    async role => {
      expect(
        (await person(role).estimatePresets.list()).length
      ).toBeGreaterThanOrEqual(4);
    }
  );
  it("分類と価格未設定項目を追加・変更・非表示にでき、競合時は既存値を保持", async () => {
    let categoryId: string | undefined;
    let itemId: string | undefined;
    try {
      const added = await owner.estimatePresets.saveCategory({
        value: { name: "TEST-定型追加", sortOrder: 99 },
      });
      categoryId = added.id;
      const changed = await owner.estimatePresets.saveCategory({
        id: added.id,
        expectedUpdatedAt: added.updatedAt,
        value: { name: "TEST-変更済み定型", sortOrder: 98 },
      });
      await expect(
        owner.estimatePresets.saveCategory({
          id: added.id,
          expectedUpdatedAt: added.updatedAt,
          value: { name: "TEST-古い更新", sortOrder: 97 },
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const value = {
        categoryId: added.id,
        name: "TEST-自由な項目",
        specification: "",
        unit: "式",
        unitPrice: null,
        note: "要確認",
        sortOrder: 1,
      };
      const item = await owner.estimatePresets.saveItem({ value });
      itemId = item.id;
      expect(
        (await owner.estimatePresets.list()).find(x => x.id === added.id)
          ?.items[0].unitPrice
      ).toBeNull();
      const priced = await owner.estimatePresets.saveItem({
        id: item.id,
        expectedUpdatedAt: item.updatedAt,
        value: { ...value, unitPrice: 13500, name: "TEST-変更済み項目" },
      });
      await expect(
        owner.estimatePresets.saveItem({
          id: item.id,
          expectedUpdatedAt: item.updatedAt,
          value: { ...value, unitPrice: 100 },
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await owner.estimatePresets.list()).find(x => x.id === added.id)
          ?.items[0].unitPrice
      ).toBe(13500);
      await owner.estimatePresets.hideItem({
        id: item.id,
        expectedUpdatedAt: priced.updatedAt,
      });
      expect(
        (await owner.estimatePresets.list()).find(x => x.id === added.id)?.items
      ).toHaveLength(0);
      await owner.estimatePresets.hideCategory({
        id: added.id,
        expectedUpdatedAt: changed.updatedAt,
      });
      expect(
        (await owner.estimatePresets.list()).some(x => x.id === added.id)
      ).toBe(false);
    } finally {
      const db = await getDb();
      if (db && itemId)
        await db
          .delete(estimatePresetItems)
          .where(eq(estimatePresetItems.id, itemId));
      if (db && categoryId)
        await db
          .delete(estimatePresetCategories)
          .where(eq(estimatePresetCategories.id, categoryId));
    }
  }, 30000);
});
