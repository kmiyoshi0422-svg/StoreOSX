export type PairableReportPhoto = {
  id: number;
  workItem: string | null;
};

export type BeforeAfterPair<T extends PairableReportPhoto> = {
  before: T | null;
  after: T | null;
  workItem: string;
};

export type ManualPhotoPair = {
  beforePhotoId: number | null;
  afterPhotoId: number | null;
};

const normalizeWorkItem = (value: string | null | undefined) => value?.trim().toLocaleLowerCase("ja-JP") ?? "";

/**
 * 既存写真だけを使い、同じ工事項目を優先して施工前／施工後を対応付ける。
 * 対応写真がない場合は null のまま残し、存在しない写真を補完・捏造しない。
 */
function pairRemainingPhotos<T extends PairableReportPhoto>(
  beforePhotos: T[],
  afterPhotos: T[],
): BeforeAfterPair<T>[] {
  const unusedAfter = new Set(afterPhotos.map((photo) => photo.id));
  const pairs: BeforeAfterPair<T>[] = [];

  for (const before of beforePhotos) {
    const beforeKey = normalizeWorkItem(before.workItem);
    const matched = beforeKey
      ? afterPhotos.find(
          (after) => unusedAfter.has(after.id) && normalizeWorkItem(after.workItem) === beforeKey,
        )
      : undefined;
    const fallback = matched ?? afterPhotos.find((after) => unusedAfter.has(after.id));

    if (fallback) unusedAfter.delete(fallback.id);
    pairs.push({
      before,
      after: fallback ?? null,
      workItem: before.workItem?.trim() || fallback?.workItem?.trim() || "施工箇所",
    });
  }

  for (const after of afterPhotos) {
    if (!unusedAfter.has(after.id)) continue;
    pairs.push({
      before: null,
      after,
      workItem: after.workItem?.trim() || "施工箇所",
    });
  }

  return pairs;
}

/**
 * 手動組み合わせを、対象案件に存在する施工前／施工後写真IDだけに正規化する。
 * 同じ写真は最初の1回だけ採用し、両側未選択の行は除外する。
 */
export function sanitizeManualPhotoPairs(
  pairs: ManualPhotoPair[] | null | undefined,
  validBeforeIds: Iterable<number>,
  validAfterIds: Iterable<number>,
): ManualPhotoPair[] {
  if (!pairs?.length) return [];
  const beforeIds = new Set(validBeforeIds);
  const afterIds = new Set(validAfterIds);
  const usedBefore = new Set<number>();
  const usedAfter = new Set<number>();
  const result: ManualPhotoPair[] = [];

  for (const pair of pairs) {
    const beforePhotoId =
      pair.beforePhotoId != null && beforeIds.has(pair.beforePhotoId) && !usedBefore.has(pair.beforePhotoId)
        ? pair.beforePhotoId
        : null;
    const afterPhotoId =
      pair.afterPhotoId != null && afterIds.has(pair.afterPhotoId) && !usedAfter.has(pair.afterPhotoId)
        ? pair.afterPhotoId
        : null;
    if (beforePhotoId == null && afterPhotoId == null) continue;
    if (beforePhotoId != null) usedBefore.add(beforePhotoId);
    if (afterPhotoId != null) usedAfter.add(afterPhotoId);
    result.push({ beforePhotoId, afterPhotoId });
  }
  return result;
}

/**
 * 手動組み合わせを優先し、未使用写真だけを従来の自動規則で補完する。
 */
export function pairBeforeAfterPhotos<T extends PairableReportPhoto>(
  beforePhotos: T[],
  afterPhotos: T[],
  manualPairs: ManualPhotoPair[] = [],
): BeforeAfterPair<T>[] {
  if (manualPairs.length === 0) return pairRemainingPhotos(beforePhotos, afterPhotos);

  const beforeById = new Map(beforePhotos.map((photo) => [photo.id, photo]));
  const afterById = new Map(afterPhotos.map((photo) => [photo.id, photo]));
  const normalized = sanitizeManualPhotoPairs(manualPairs, beforeById.keys(), afterById.keys());
  const usedBefore = new Set(normalized.flatMap((pair) => pair.beforePhotoId == null ? [] : [pair.beforePhotoId]));
  const usedAfter = new Set(normalized.flatMap((pair) => pair.afterPhotoId == null ? [] : [pair.afterPhotoId]));
  const resolved = normalized.map((pair) => {
    const before = pair.beforePhotoId == null ? null : beforeById.get(pair.beforePhotoId) ?? null;
    const after = pair.afterPhotoId == null ? null : afterById.get(pair.afterPhotoId) ?? null;
    return {
      before,
      after,
      workItem: before?.workItem?.trim() || after?.workItem?.trim() || "施工箇所",
    };
  });
  const automatic = pairRemainingPhotos(
    beforePhotos.filter((photo) => !usedBefore.has(photo.id)),
    afterPhotos.filter((photo) => !usedAfter.has(photo.id)),
  );
  return [...resolved, ...automatic];
}
