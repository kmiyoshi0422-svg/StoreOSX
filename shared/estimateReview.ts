import type { EstimateLine } from "./estimateAssistant";

export type ReviewCandidate = { id: number; line: EstimateLine };

/** 選択した候補だけ処理し、未選択の候補と既存明細には触れない。 */
export function resolveEstimateCandidates(
  candidates: ReviewCandidate[],
  selectedIds: readonly number[],
  action: "adopt" | "exclude"
) {
  const selected = new Set(selectedIds);
  return {
    remaining: candidates.filter(candidate => !selected.has(candidate.id)),
    adopted:
      action === "adopt"
        ? candidates
            .filter(candidate => selected.has(candidate.id))
            .map(candidate => candidate.line)
        : ([] as EstimateLine[]),
  };
}

/** 0円単価は有効。数量・単位・単価の不正値と未入力のみ警告する。 */
export function missingEstimateFields(line: EstimateLine): string[] {
  const fields: string[] = [];
  if (
    line.quantity == null ||
    !Number.isFinite(line.quantity) ||
    line.quantity <= 0
  )
    fields.push("数量");
  if (!line.unit.trim()) fields.push("単位");
  if (
    line.unitPrice == null ||
    !Number.isInteger(line.unitPrice) ||
    line.unitPrice < 0
  )
    fields.push("単価");
  return fields;
}
