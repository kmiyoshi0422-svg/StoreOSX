export const PHOTO_CLASSIFICATION_CATEGORIES = [
  "現調",
  "施工前",
  "施工中",
  "施工後",
] as const;

export type PhotoClassificationCategory =
  (typeof PHOTO_CLASSIFICATION_CATEGORIES)[number];

export const PHOTO_CLASSIFICATION_LOW_CONFIDENCE = 80;

export const PHOTO_CLASSIFICATION_ALLOWED_ROLES = [
  "owner",
  "admin",
  "user",
  "partner",
] as const;

export type PhotoClassificationSuggestion = {
  photoId: number;
  category: PhotoClassificationCategory;
  confidence: number;
  reason: string;
};

export type PersistedPhotoType =
  | "施工前A"
  | "施工前B"
  | "施工中"
  | "施工後A"
  | "施工後B"
  | "設置状況"
  | "メーカー型番"
  | "現調"
  | "その他";

export function isLowPhotoClassificationConfidence(confidence: number) {
  return confidence < PHOTO_CLASSIFICATION_LOW_CONFIDENCE;
}

export function canUsePhotoClassification(role: string) {
  return PHOTO_CLASSIFICATION_ALLOWED_ROLES.includes(
    role as (typeof PHOTO_CLASSIFICATION_ALLOWED_ROLES)[number],
  );
}

export function toPhotoClassificationCategory(
  photoType: string,
): PhotoClassificationCategory {
  if (photoType.startsWith("施工前")) return "施工前";
  if (photoType === "施工中") return "施工中";
  if (photoType.startsWith("施工後")) return "施工後";
  return "現調";
}

export function resolvePersistedPhotoType(
  category: PhotoClassificationCategory,
  currentType: string,
): PersistedPhotoType {
  if (category === "施工前") {
    return currentType === "施工前B" ? "施工前B" : "施工前A";
  }
  if (category === "施工後") {
    return currentType === "施工後B" ? "施工後B" : "施工後A";
  }
  if (category === "施工中") return "施工中";
  return "現調";
}

export function normalizePhotoClassificationSuggestions({
  requestedPhotos,
  suggestions,
}: {
  requestedPhotos: Array<{ id: number; photoType: string }>;
  suggestions: PhotoClassificationSuggestion[];
}): PhotoClassificationSuggestion[] {
  const allowedIds = new Set(requestedPhotos.map((photo) => photo.id));
  const bestByPhotoId = new Map<number, PhotoClassificationSuggestion>();

  for (const suggestion of suggestions) {
    if (!allowedIds.has(suggestion.photoId)) continue;
    const normalized: PhotoClassificationSuggestion = {
      ...suggestion,
      confidence: Math.min(100, Math.max(0, Math.round(suggestion.confidence))),
      reason: suggestion.reason.trim().slice(0, 160),
    };
    const existing = bestByPhotoId.get(suggestion.photoId);
    if (!existing || normalized.confidence > existing.confidence) {
      bestByPhotoId.set(suggestion.photoId, normalized);
    }
  }

  return requestedPhotos.map((photo) => {
    const suggestion = bestByPhotoId.get(photo.id);
    if (suggestion) return suggestion;
    return {
      photoId: photo.id,
      category: toPhotoClassificationCategory(photo.photoType),
      confidence: 0,
      reason: "AI判定結果を取得できなかったため、現在の区分を維持しています。",
    };
  });
}
