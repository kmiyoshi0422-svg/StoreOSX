import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { photos } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
type Role = AuthenticatedUser["role"];

function createContext(
  role: Role,
  options: Partial<AuthenticatedUser> = {},
): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: options.id ?? 991001,
      openId: `photo-classification-${role}-${options.id ?? 991001}`,
      email: `${role}@photo-classification.example.com`,
      name: `写真分類 ${role}`,
      loginMethod: "manus",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      ...options,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("施工写真AI分類の確認済み保存", () => {
  const ownerCaller = appRouter.createCaller(createContext("owner", { id: 1 }));
  let caseId = 0;
  let photoIds: number[] = [];

  beforeAll(async () => {
    const created = await ownerCaller.cases.create({
      requestNumber: `TEST-PHOTO-CLASS-${Date.now()}`,
      brand: "その他",
      storeName: "写真AI分類テスト店",
      prefecture: "福岡県",
      workType: "修理",
      costBearer: "店舗",
      requestDate: new Date(),
    });
    caseId = created.id;
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(photos).values([
      {
        caseId,
        fileKey: `test/${caseId}/survey.jpg`,
        fileUrl: `/manus-storage/test/${caseId}/survey.jpg`,
        photoType: "現調",
        orderNo: 0,
      },
      {
        caseId,
        fileKey: `test/${caseId}/before-b.jpg`,
        fileUrl: `/manus-storage/test/${caseId}/before-b.jpg`,
        photoType: "施工前B",
        orderNo: 1,
      },
      {
        caseId,
        fileKey: `test/${caseId}/after-b.jpg`,
        fileUrl: `/manus-storage/test/${caseId}/after-b.jpg`,
        photoType: "施工後B",
        orderNo: 2,
      },
    ]);
    photoIds = (await db.select().from(photos).where(eq(photos.caseId, caseId)))
      .sort((a, b) => a.orderNo - b.orderNo)
      .map((photo) => photo.id);
  }, 30000);

  afterAll(async () => {
    if (!caseId) return;
    const db = await getDb();
    if (db) await db.delete(photos).where(eq(photos.caseId, caseId));
    await ownerCaller.cases.delete({ id: caseId });
  }, 30000);

  it("人が確認した候補だけを一括保存し、既存B区分を維持する", async () => {
    const result = await ownerCaller.photos.applyClassifications({
      caseId,
      updates: [
        { photoId: photoIds[0], category: "施工前" },
        { photoId: photoIds[1], category: "施工前" },
        { photoId: photoIds[2], category: "施工後" },
      ],
    });
    expect(result).toMatchObject({ success: true, count: 1 });
    expect(result.runId).toEqual(expect.any(Number));

    const db = await getDb();
    const rows = await db!.select().from(photos).where(eq(photos.caseId, caseId));
    const typesById = new Map(rows.map((photo) => [photo.id, photo.photoType] as const));
    expect(typesById.get(photoIds[0])).toBe("施工前A");
    expect(typesById.get(photoIds[1])).toBe("施工前B");
    expect(typesById.get(photoIds[2])).toBe("施工後B");
  });

  it("案件外IDを含む場合は全件拒否し、既存区分を変更しない", async () => {
    await expect(
      ownerCaller.photos.applyClassifications({
        caseId,
        updates: [
          { photoId: photoIds[0], category: "施工後" },
          { photoId: 2147483000, category: "施工中" },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const db = await getDb();
    const [photo] = await db!.select().from(photos).where(eq(photos.id, photoIds[0]));
    expect(photo.photoType).toBe("施工前A");
  });

  it("許可エリアのpartnerは確認済み分類を保存できる", async () => {
    const partnerCaller = appRouter.createCaller(createContext("partner", {
      id: 991002,
      areaAccessMode: "selected",
      allowedPrefectures: JSON.stringify(["福岡県"]),
    }));
    await expect(
      partnerCaller.photos.applyClassifications({
        caseId,
        updates: [{ photoId: photoIds[0], category: "現調" }],
      }),
    ).resolves.toMatchObject({ success: true, count: 1, runId: expect.any(Number) });
  });

  it("許可エリア外のpartnerは確認済み分類を保存できない", async () => {
    const partnerCaller = appRouter.createCaller(createContext("partner", {
      id: 991005,
      areaAccessMode: "selected",
      allowedPrefectures: JSON.stringify(["山口県"]),
    }));
    await expect(
      partnerCaller.photos.applyClassifications({
        caseId,
        updates: [{ photoId: photoIds[0], category: "施工中" }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(["executive", "customer"] as const)(
    "%s はAI分類も確認済み保存もできない",
    async (role) => {
      const caller = appRouter.createCaller(createContext(role, { id: role === "executive" ? 991003 : 991004 }));
      await expect(
        caller.photos.classify({ caseId, photoIds: [photoIds[0]] }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.photos.applyClassifications({
          caseId,
          updates: [{ photoId: photoIds[0], category: "施工中" }],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    },
  );
});
