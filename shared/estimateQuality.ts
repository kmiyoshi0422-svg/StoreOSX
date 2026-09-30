export type EstimateQualityCandidate = {
  id: number;
  runId: number;
  decision: "pending" | "adopt" | "exclude";
};
export type EstimateQualityRun = {
  id: number;
  generatedAt: number;
  sourceKind: "case_pdf" | "case_text" | "uploaded_pdf";
};
export type EstimateQualityEdit = {
  candidateId: number;
  changedFields: string;
};

/** 人の判断の傾向であり、真のAI正答率ではない。未判定は判定率の分母から除く。 */
export function summarizeEstimateQuality(
  runs: EstimateQualityRun[],
  candidates: EstimateQualityCandidate[],
  edits: EstimateQualityEdit[]
) {
  const adopted = candidates.filter(x => x.decision === "adopt").length;
  const excluded = candidates.filter(x => x.decision === "exclude").length;
  const pending = candidates.filter(x => x.decision === "pending").length;
  const decided = adopted + excluded;
  const editedIds = new Set(edits.map(x => x.candidateId));
  const editedAdopted = candidates.filter(
    x => x.decision === "adopt" && editedIds.has(x.id)
  ).length;
  const corrections: Record<string, number> = {};
  for (const edit of edits) {
    for (const field of edit.changedFields.split(",").filter(Boolean)) {
      corrections[field] = (corrections[field] ?? 0) + 1;
    }
  }
  const sourceCounts = { case_pdf: 0, case_text: 0, uploaded_pdf: 0 };
  for (const run of runs) sourceCounts[run.sourceKind]++;
  const trendMap = new Map<
    string,
    { date: string; generated: number; adopted: number; excluded: number }
  >();
  const dateByRun = new Map(
    runs.map(run => [
      run.id,
      new Date(run.generatedAt).toISOString().slice(0, 10),
    ])
  );
  for (const run of runs) {
    const date = dateByRun.get(run.id)!;
    const row = trendMap.get(date) ?? {
      date,
      generated: 0,
      adopted: 0,
      excluded: 0,
    };
    row.generated++;
    trendMap.set(date, row);
  }
  for (const candidate of candidates) {
    const date = dateByRun.get(candidate.runId);
    if (!date) continue;
    const row = trendMap.get(date)!;
    if (candidate.decision === "adopt") row.adopted++;
    if (candidate.decision === "exclude") row.excluded++;
  }
  return {
    generated: candidates.length,
    runs: runs.length,
    adopted,
    excluded,
    pending,
    editedAdopted,
    acceptanceRate: decided
      ? Math.round((adopted / decided) * 1000) / 10
      : null,
    exclusionRate: decided
      ? Math.round((excluded / decided) * 1000) / 10
      : null,
    editRate: adopted
      ? Math.round((editedAdopted / adopted) * 1000) / 10
      : null,
    corrections,
    sourceCounts,
    trend: Array.from(trendMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
  };
}

export const ESTIMATE_AUDIT_FIELDS = [
  "name",
  "specification",
  "quantity",
  "unit",
  "unitPrice",
  "evidence",
  "pageNumber",
  "note",
] as const;

export function changedEstimateFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): string[] {
  if (!before || !after) return ["removed"];
  return ESTIMATE_AUDIT_FIELDS.filter(
    field => (before[field] ?? null) !== (after[field] ?? null)
  );
}
