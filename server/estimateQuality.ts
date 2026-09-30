import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  cases,
  estimateAiCandidateEdits,
  estimateAiCandidates,
  estimateAiRuns,
} from "../drizzle/schema";
import {
  hasAllAreaAccess,
  parseAllowedPrefectures,
  canAccessPrefecture,
} from "../shared/accessPolicy";
import type { EstimateLine } from "../shared/estimateAssistant";
import {
  changedEstimateFields,
  summarizeEstimateQuality,
} from "../shared/estimateQuality";
import { getDb } from "./db";

type CaseUser = {
  role: string;
  areaAccessMode?: "all" | "selected" | null;
  allowedPrefectures?: string | null;
};
function requiredDb() {
  return getDb().then(db => {
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db;
  });
}

/** LLM失敗時には呼ばず、生成結果が揃ったときだけ原子的に確定する。 */
export async function recordEstimateAiRun(input: {
  caseId: number;
  sourceKind: "case_pdf" | "case_text" | "uploaded_pdf";
  modelId: string;
  generatedBy: number;
  discrepancy: string[];
  items: EstimateLine[];
}) {
  if (!input.items.length) return { runId: null, items: [] as EstimateLine[] };
  const db = await requiredDb();
  return db.transaction(async tx => {
    const [{ id: runId }] = await tx
      .insert(estimateAiRuns)
      .values({
        caseId: input.caseId,
        sourceKind: input.sourceKind,
        modelId: input.modelId,
        generatedBy: input.generatedBy,
        generatedAt: Date.now(),
        discrepancyJson: JSON.stringify(input.discrepancy),
      })
      .$returningId();
    const inserted = await tx
      .insert(estimateAiCandidates)
      .values(
        input.items.map((line, ordinal) => ({
          runId,
          caseId: input.caseId,
          ordinal,
          originalJson: JSON.stringify(line),
          decision: "pending" as const,
        }))
      )
      .$returningId();
    return {
      runId,
      items: input.items.map((line, index) => ({
        ...line,
        candidateId: inserted[index].id,
      })),
    };
  });
}

/** 判定は一回限り。全IDが同じ実行・案件・未判定でない限り1件も変えない。 */
export async function decideEstimateCandidates(input: {
  caseId: number;
  runId: number;
  ids: number[];
  decision: "adopt" | "exclude";
  userId: number;
}) {
  if (
    !input.ids.length ||
    input.ids.length > 30 ||
    new Set(input.ids).size !== input.ids.length
  )
    throw new TRPCError({ code: "BAD_REQUEST", message: "候補IDが不正です" });
  const db = await requiredDb();
  return db.transaction(async tx => {
    const [run] = await tx
      .select()
      .from(estimateAiRuns)
      .where(eq(estimateAiRuns.id, input.runId))
      .limit(1);
    if (!run || run.caseId !== input.caseId)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "案件と実行履歴が一致しません",
      });
    const rows = await tx
      .select()
      .from(estimateAiCandidates)
      .where(inArray(estimateAiCandidates.id, input.ids));
    if (
      rows.length !== input.ids.length ||
      rows.some(
        row =>
          row.runId !== input.runId ||
          row.caseId !== input.caseId ||
          row.decision !== "pending"
      )
    )
      throw new TRPCError({
        code: "CONFLICT",
        message: "候補が別の画面で判定済みです。再生成してください",
      });
    const changed = await tx
      .update(estimateAiCandidates)
      .set({
        decision: input.decision,
        decidedBy: input.userId,
        decidedAt: Date.now(),
      })
      .where(
        and(
          inArray(estimateAiCandidates.id, input.ids),
          eq(estimateAiCandidates.runId, input.runId),
          eq(estimateAiCandidates.decision, "pending")
        )
      );
    if (Number(changed[0]?.affectedRows ?? 0) !== input.ids.length)
      throw new TRPCError({
        code: "CONFLICT",
        message: "候補が別の画面で更新されました",
      });
    return { decided: input.ids.length };
  });
}

/** 下書きのトランザクション内から呼ぶ。監査に失敗した保存は全体を巻き戻す。 */
export async function auditSavedEstimateLines(
  tx: Parameters<
    Parameters<NonNullable<Awaited<ReturnType<typeof getDb>>>["transaction"]>[0]
  >[0],
  input: {
    caseId: number;
    draftId: number;
    userId: number;
    lines: EstimateLine[];
  }
) {
  const ids = input.lines.flatMap(line =>
    line.candidateId ? [line.candidateId] : []
  );
  if (new Set(ids).size !== ids.length)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "同じAI候補を複数行に使えません",
    });
  const existing = await tx
    .select()
    .from(estimateAiCandidates)
    .where(eq(estimateAiCandidates.draftId, input.draftId));
  const rows = ids.length
    ? await tx
        .select()
        .from(estimateAiCandidates)
        .where(inArray(estimateAiCandidates.id, ids))
    : [];
  if (
    rows.length !== ids.length ||
    rows.some(
      row =>
        row.caseId !== input.caseId ||
        row.decision !== "adopt" ||
        (row.draftId !== null && row.draftId !== input.draftId)
    )
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "採用済み候補の案件・見積案が一致しません",
    });
  const previous = new Map(existing.map(row => [row.id, row]));
  const now = Date.now();
  for (const line of input.lines) {
    if (!line.candidateId) continue;
    const row = rows.find(candidate => candidate.id === line.candidateId)!;
    const before = row.latestSavedJson
      ? (JSON.parse(row.latestSavedJson) as EstimateLine)
      : (JSON.parse(row.originalJson) as EstimateLine);
    const fields = changedEstimateFields(before, line);
    if (fields.length)
      await tx.insert(estimateAiCandidateEdits).values({
        candidateId: row.id,
        caseId: input.caseId,
        draftId: input.draftId,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(line),
        changedFields: fields.join(","),
        changedBy: input.userId,
        changedAt: now,
      });
    await tx
      .update(estimateAiCandidates)
      .set({ draftId: input.draftId, latestSavedJson: JSON.stringify(line) })
      .where(eq(estimateAiCandidates.id, row.id));
    previous.delete(row.id);
  }
  for (const row of Array.from(previous.values())) {
    await tx.insert(estimateAiCandidateEdits).values({
      candidateId: row.id,
      caseId: input.caseId,
      draftId: input.draftId,
      beforeJson: row.latestSavedJson,
      afterJson: null,
      changedFields: "removed",
      changedBy: input.userId,
      changedAt: now,
    });
    await tx
      .update(estimateAiCandidates)
      .set({ latestSavedJson: null })
      .where(eq(estimateAiCandidates.id, row.id));
  }
}

/** 生成日を基準に集計。件数上限を越えたときは部分結果を精度値と呼ばない。 */
export async function getEstimateQualityReport(
  user: CaseUser,
  days: number,
  caseId?: number
) {
  const db = await requiredDb();
  const min = Date.now() - days * 86_400_000;
  const prefectures = parseAllowedPrefectures(user.allowedPrefectures);
  const areaCondition = hasAllAreaAccess(user)
    ? undefined
    : prefectures.length
      ? inArray(cases.prefecture, prefectures)
      : sql`1 = 0`;
  const runRows = await db
    .select({
      run: estimateAiRuns,
      prefecture: cases.prefecture,
      requestNumber: cases.requestNumber,
      storeName: cases.storeName,
    })
    .from(estimateAiRuns)
    .innerJoin(cases, eq(estimateAiRuns.caseId, cases.id))
    .where(
      and(
        gte(estimateAiRuns.generatedAt, min),
        areaCondition,
        caseId ? eq(estimateAiRuns.caseId, caseId) : undefined
      )
    )
    .orderBy(desc(estimateAiRuns.generatedAt))
    .limit(5001);
  const truncated = runRows.length > 5000;
  const visible = runRows
    .slice(0, 5000)
    .filter(x => canAccessPrefecture(user, x.prefecture));
  const runs = visible.map(x => x.run);
  const candidates = [] as (typeof estimateAiCandidates.$inferSelect)[];
  const edits = [] as (typeof estimateAiCandidateEdits.$inferSelect)[];
  for (let offset = 0; offset < runs.length; offset += 300) {
    candidates.push(
      ...(await db
        .select()
        .from(estimateAiCandidates)
        .where(
          inArray(
            estimateAiCandidates.runId,
            runs.slice(offset, offset + 300).map(r => r.id)
          )
        ))
    );
  }
  for (let offset = 0; offset < candidates.length; offset += 300) {
    edits.push(
      ...(await db
        .select()
        .from(estimateAiCandidateEdits)
        .where(
          inArray(
            estimateAiCandidateEdits.candidateId,
            candidates.slice(offset, offset + 300).map(c => c.id)
          )
        ))
    );
  }
  const summary = summarizeEstimateQuality(runs, candidates, edits);
  const runById = new Map(visible.map(x => [x.run.id, x]));
  const editByCandidate = new Map<number, typeof edits>();
  for (const edit of edits)
    editByCandidate.set(edit.candidateId, [
      ...(editByCandidate.get(edit.candidateId) ?? []),
      edit,
    ]);
  const history = candidates
    .flatMap(candidate => {
      const run = runById.get(candidate.runId)!;
      const original = JSON.parse(candidate.originalJson) as EstimateLine;
      const base = {
        candidateId: candidate.id,
        caseId: candidate.caseId,
        requestNumber: run.requestNumber,
        storeName: run.storeName,
        sourceKind: run.run.sourceKind,
        itemName: original.name,
      };
      return [
        ...(candidate.decision === "pending"
          ? []
          : [
              {
                ...base,
                kind: candidate.decision,
                at: candidate.decidedAt ?? 0,
                actorId: candidate.decidedBy,
                before: original,
                after: candidate.decision === "adopt" ? original : null,
                fields: [] as string[],
              },
            ]),
        ...(editByCandidate.get(candidate.id) ?? []).map(edit => ({
          ...base,
          kind: "edit" as const,
          at: edit.changedAt,
          actorId: edit.changedBy,
          before: edit.beforeJson
            ? (JSON.parse(edit.beforeJson) as EstimateLine)
            : null,
          after: edit.afterJson
            ? (JSON.parse(edit.afterJson) as EstimateLine)
            : null,
          fields: edit.changedFields.split(","),
        })),
      ];
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 100);
  return {
    ...summary,
    history,
    truncated,
    since: min,
    until: Date.now(),
    days,
  };
}
