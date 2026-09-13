export type PairableReportPhoto = {
  id: number;
  workItem: string | null;
};

export type BeforeAfterPair<T extends PairableReportPhoto> = {
  before: T | null;
  after: T | null;
  workItem: string;
};

const normalizeWorkItem = (value: string | null | undefined) => value?.trim().toLocaleLowerCase("ja-JP") ?? "";

/**
 * 既存写真だけを使い、同じ工事項目を優先して施工前／施工後を対応付ける。
 * 対応写真がない場合は null のまま残し、存在しない写真を補完・捏造しない。
 */
export function pairBeforeAfterPhotos<T extends PairableReportPhoto>(
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
