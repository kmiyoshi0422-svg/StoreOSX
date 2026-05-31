// 見積書 → 既存案件 マッチングロジック（純粋関数）
// LLMが抽出した requestNumber / caseTitle / storeName を、
// 既存案件のフィールドと照合してスコアリングし、候補を返す。

export type MatcherCase = {
  id: number;
  requestNumber: string | null;
  storeName: string | null;
  requestContent?: string | null;
  categoryLarge?: string | null;
  categoryMedium?: string | null;
  categorySmall?: string | null;
};

export type MatcherInput = {
  requestNumber: string | null;
  caseTitle: string | null;
  storeName: string | null;
};

export type MatchCandidate = {
  caseId: number;
  requestNumber: string | null;
  storeName: string | null;
  score: number;
};

/**
 * 比較しやすい形に正規化する（空白・記号を除去し小文字化）
 */
export function normalizeKey(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[\s\u3000ー\-_/\.]+/g, "");
}

/**
 * 抽出値と既存案件群からスコア付き候補を返す。
 *
 * スコア配分:
 *  - 依頼番号一致（完全/部分）: +100
 *  - 店舗名一致（完全/部分）: +30
 *  - 件名/案件名のキーワードが説明文/カテゴリに含まれる: +15
 *
 * 戻り値はスコア降順（同スコアはcaseId昇順で安定）。
 */
export function scoreCandidates(
  input: MatcherInput,
  cases: MatcherCase[]
): MatchCandidate[] {
  const reqN = normalizeKey(input.requestNumber);
  const titleN = normalizeKey(input.caseTitle);
  const storeN = normalizeKey(input.storeName);

  const scored: MatchCandidate[] = cases.map((c) => {
    let score = 0;
    const cReq = normalizeKey(c.requestNumber);
    const cStore = normalizeKey(c.storeName);
    const cDesc = normalizeKey(
      (c.requestContent ?? "") +
        (c.categoryLarge ?? "") +
        (c.categoryMedium ?? "") +
        (c.categorySmall ?? "")
    );
    if (
      reqN &&
      cReq &&
      (cReq === reqN || cReq.includes(reqN) || reqN.includes(cReq))
    ) {
      score += 100;
    }
    if (
      storeN &&
      cStore &&
      (cStore === storeN || cStore.includes(storeN) || storeN.includes(cStore))
    ) {
      score += 30;
    }
    if (
      titleN &&
      (cDesc.includes(titleN) ||
        (titleN.length >= 3 && cDesc.includes(titleN.slice(0, 3))))
    ) {
      score += 15;
    }
    return {
      caseId: c.id,
      requestNumber: c.requestNumber,
      storeName: c.storeName,
      score,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.caseId - b.caseId;
  });
  return scored;
}

/**
 * スコア付き候補から「マッチあり」と見なせるTOP-N（既定5件）を返す。
 */
export function topMatches(
  candidates: MatchCandidate[],
  limit = 5
): MatchCandidate[] {
  return candidates.filter((s) => s.score > 0).slice(0, limit);
}

/**
 * 自動確定して良いベストマッチ（依頼番号一致レベル: score >= 100）を返す。
 */
export function pickBestMatch(
  candidates: MatchCandidate[]
): MatchCandidate | null {
  const top = candidates[0];
  if (top && top.score >= 100) return top;
  return null;
}
