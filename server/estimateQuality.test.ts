import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb } from "./db";
import {
  estimateAiRuns,
  estimateAiCandidates,
  estimateAiCandidateEdits,
} from "../drizzle/schema";
import {
  summarizeEstimateQuality,
  changedEstimateFields,
} from "../shared/estimateQuality";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/llm", async original => ({
  ...(await original<typeof import("./_core/llm")>()),
  invokeLLM: vi.fn(async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            pdfRequestNumber: null,
            discrepancies: [],
            items: [
              {
                name: "TEST-建具調整",
                specification: null,
                quantity: null,
                unit: "式",
                widthMm: null,
                heightMm: null,
                evidence: "鍵が固い",
                pageNumber: null,
              },
              {
                name: "TEST-照明交換",
                specification: null,
                quantity: 1,
                unit: "箇所",
                widthMm: null,
                heightMm: null,
                evidence: "照明が点かない",
                pageNumber: null,
              },
            ],
          }),
        },
      },
    ],
  })),
}));

function person(
  role: NonNullable<TrpcContext["user"]>["role"],
  id = 1,
  prefecture?: string
) {
  const now = new Date();
  return appRouter.createCaller({
    user: {
      id,
      openId: `TEST-estimate-quality-${id}`,
      name: `TEST-${role}`,
      email: `TEST-${role}@example.invalid`,
      loginMethod: "manus",
      role,
      areaAccessMode: prefecture ? "selected" : "all",
      allowedPrefectures: prefecture ? JSON.stringify([prefecture]) : null,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}
const owner = person("owner");
const employee = person("user", 991021);

describe("見積AI監査と人の判定指標", () => {
  let caseId = 0;
  let otherCaseId = 0;
  beforeAll(async () => {
    const requestNumber = `TEST-QUALITY-${Date.now()}`;
    caseId = (
      await owner.cases.create({
        requestNumber,
        storeName: "TEST-候補照合",
        prefecture: "山口県",
        requestContent: "鍵が固い。照明が点かない。",
      })
    ).id;
    otherCaseId = (
      await owner.cases.create({
        requestNumber: `${requestNumber}-OTHER`,
        storeName: "TEST-別案件",
        prefecture: "東京都",
        requestContent: "照明が点かない。",
      })
    ).id;
  }, 30000);
  afterAll(async () => {
    if (caseId) await owner.cases.delete({ id: caseId });
    if (otherCaseId) await owner.cases.delete({ id: otherCaseId });
    const db = await getDb();
    if (db && caseId) {
      expect(
        await db
          .select()
          .from(estimateAiRuns)
          .where(eq(estimateAiRuns.caseId, caseId))
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(estimateAiCandidates)
          .where(eq(estimateAiCandidates.caseId, caseId))
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(estimateAiCandidateEdits)
          .where(eq(estimateAiCandidateEdits.caseId, caseId))
      ).toHaveLength(0);
    }
  }, 30000);

  it("未判定は率の分母に入れず、空なら率は未算定", () => {
    const empty = summarizeEstimateQuality([], [], []);
    expect(empty.acceptanceRate).toBeNull();
    expect(empty.editRate).toBeNull();
    expect(changedEstimateFields({ quantity: null }, { quantity: 2 })).toEqual([
      "quantity",
    ]);
    expect(changedEstimateFields({ quantity: 0 }, null)).toEqual(["removed"]);
  });

  it("生成→一括採用・除外→保存時修正を日時・実行者・前後値とともに記録する", async () => {
    const result = await employee.estimateAssistant.analyzeCase({ caseId });
    expect(result).toMatchObject({ pdfAnalyzed: false, sourcePdfKey: null });
    expect(result.runId).toBeGreaterThan(0);
    const [adopted, excluded] = result.items;
    expect(adopted.candidateId).toBeGreaterThan(0);
    const before = await employee.estimateAssistant.qualityReport({
      days: 7,
      caseId,
    });
    expect(before).toMatchObject({
      generated: 2,
      adopted: 0,
      excluded: 0,
      pending: 2,
      acceptanceRate: null,
    });
    await employee.estimateAssistant.decideCandidates({
      caseId,
      runId: result.runId!,
      ids: [adopted.candidateId!],
      decision: "adopt",
    });
    await employee.estimateAssistant.decideCandidates({
      caseId,
      runId: result.runId!,
      ids: [excluded.candidateId!],
      decision: "exclude",
    });
    const draft = await employee.estimateAssistant.saveDraft({
      caseId,
      title: "TEST-監査案",
      sourceKind: "manual",
      items: [{ ...adopted, quantity: 2, unitPrice: 8000 }],
    });
    const report = await employee.estimateAssistant.qualityReport({
      days: 7,
      caseId,
    });
    expect(report).toMatchObject({
      generated: 2,
      adopted: 1,
      excluded: 1,
      pending: 0,
      acceptanceRate: 50,
      exclusionRate: 50,
      editedAdopted: 1,
      editRate: 100,
    });
    expect(report.corrections).toMatchObject({ quantity: 1, unitPrice: 1 });
    expect(
      report.history.find(
        x => x.kind === "edit" && x.candidateId === adopted.candidateId
      )
    ).toMatchObject({
      actorId: 991021,
      before: { quantity: null, unitPrice: null },
      after: { quantity: 2, unitPrice: 8000 },
    });
    await expect(
      employee.estimateAssistant.decideCandidates({
        caseId,
        runId: result.runId!,
        ids: [adopted.candidateId!],
        decision: "exclude",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const saved2 = await employee.estimateAssistant.saveDraft({
      id: draft.id,
      expectedUpdatedAt: draft.updatedAt,
      caseId,
      title: "TEST-監査案",
      sourceKind: "manual",
      items: [{ ...adopted, quantity: 3, unitPrice: 8000 }],
    });
    expect(saved2.updatedAt).toBeGreaterThan(draft.updatedAt);
    const after = await employee.estimateAssistant.qualityReport({
      days: 7,
      caseId,
    });
    expect(after.corrections.quantity).toBe(2);
    expect(after.editedAdopted).toBe(1);
  }, 30000);

  it("別案件ID・他エリア・協力業者の履歴操作は拒否し、偽候補IDで下書きを残さない", async () => {
    const result = await employee.estimateAssistant.analyzeCase({ caseId });
    const id = result.items[0].candidateId!;
    await expect(
      employee.estimateAssistant.decideCandidates({
        caseId: otherCaseId,
        runId: result.runId!,
        ids: [id],
        decision: "exclude",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      employee.estimateAssistant.saveDraft({
        caseId: otherCaseId,
        title: "TEST-混入",
        sourceKind: "manual",
        items: [{ ...result.items[0], quantity: 1, unitPrice: 1 }],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (
        await employee.estimateAssistant.listDrafts({ caseId: otherCaseId })
      ).filter(d => d.title === "TEST-混入")
    ).toHaveLength(0);
    for (const role of ["partner", "customer"] as const) {
      await expect(
        person(role).estimateAssistant.qualityReport({ days: 7 })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        person(role).estimateAssistant.decideCandidates({
          caseId,
          runId: result.runId!,
          ids: [id],
          decision: "adopt",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(
      person("user", 991022, "大阪府").estimateAssistant.qualityReport({
        days: 7,
        caseId,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const areaReport = await person(
      "user",
      991022,
      "東京都"
    ).estimateAssistant.qualityReport({ days: 7 });
    expect(areaReport.history.some(x => x.caseId === caseId)).toBe(false);
  }, 30000);
});
