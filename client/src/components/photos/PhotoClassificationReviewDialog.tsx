import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  PHOTO_CLASSIFICATION_CATEGORIES,
  PHOTO_CLASSIFICATION_LOW_CONFIDENCE,
  type PhotoClassificationCategory,
} from "@shared/photoClassification";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ReviewPhoto = {
  id: number;
  fileUrl: string;
  photoType: string;
  rotation?: number | null;
};

type ReviewSuggestion = {
  photoId: number;
  category: PhotoClassificationCategory;
  confidence: number;
  reason: string;
  requiresReview: boolean;
  included: boolean;
};

function confidenceClasses(confidence: number) {
  if (confidence >= 90) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (confidence >= PHOTO_CLASSIFICATION_LOW_CONFIDENCE) {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  return "bg-amber-100 text-amber-800 border-amber-200";
}

export function PhotoClassificationReviewDialog({
  caseId,
  photos,
  selectedPhotoIds,
  onSaved,
}: {
  caseId: number;
  photos: ReviewPhoto[];
  selectedPhotoIds: number[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ReviewSuggestion[]>([]);
  const photosById = useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo] as const)),
    [photos],
  );

  const classifyMutation = trpc.photos.classify.useMutation({
    onSuccess: (rows) => {
      setSuggestions(rows.map((row) => ({ ...row, included: true })));
    },
    onError: (error) => toast.error(error.message),
  });
  const applyMutation = trpc.photos.applyClassifications.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count}枚の写真区分を更新しました`);
      setOpen(false);
      setSuggestions([]);
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });

  const startClassification = () => {
    const targetIds = selectedPhotoIds.length > 0
      ? selectedPhotoIds
      : photos.map((photo) => photo.id);
    if (targetIds.length === 0) {
      toast.error("分類する写真がありません");
      return;
    }
    if (targetIds.length > 20) {
      toast.error("AI分類は1回20枚までです。一括選択で対象写真を絞ってください");
      return;
    }
    setSuggestions([]);
    setOpen(true);
    classifyMutation.mutate({ caseId, photoIds: targetIds });
  };

  const includedSuggestions = suggestions.filter((row) => row.included);
  const lowConfidenceCount = suggestions.filter(
    (row) => row.included && row.confidence < PHOTO_CLASSIFICATION_LOW_CONFIDENCE,
  ).length;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="bg-background"
        onClick={startClassification}
        disabled={classifyMutation.isPending || photos.length === 0}
      >
        {classifyMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 mr-1" />
        )}
        AIで自動分類
      </Button>

      <Dialog open={open} onOpenChange={(next) => !applyMutation.isPending && setOpen(next)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>AI写真分類の確認</DialogTitle>
            <DialogDescription>
              AIの候補はまだ保存されていません。写真・確信度・理由を確認し、必要なら区分を修正または対象外にしてから保存してください。
            </DialogDescription>
          </DialogHeader>

          {classifyMutation.isPending ? (
            <div className="min-h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>画像と撮影情報を確認しています…</p>
              <p className="text-xs">写真枚数により数十秒かかる場合があります</p>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span>{suggestions.length}枚を判定</span>
                <span className="font-medium">保存対象 {includedSuggestions.length}枚</span>
                {lowConfidenceCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    要確認 {lowConfidenceCount}枚
                  </Badge>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 ml-auto"
                  onClick={() => setSuggestions((rows) => rows.map((row) => ({
                    ...row,
                    included: row.confidence >= PHOTO_CLASSIFICATION_LOW_CONFIDENCE,
                  })))}
                >
                  低確信度を対象外にする
                </Button>
              </div>

              {suggestions.map((suggestion) => {
                const photo = photosById.get(suggestion.photoId);
                if (!photo) return null;
                return (
                  <div
                    key={suggestion.photoId}
                    className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_112px_1fr] ${
                      suggestion.included ? "bg-background" : "bg-muted/40 opacity-70"
                    }`}
                  >
                    <Checkbox
                      aria-label={`写真${suggestion.photoId}を保存対象にする`}
                      checked={suggestion.included}
                      onCheckedChange={(checked) => setSuggestions((rows) => rows.map((row) => (
                        row.photoId === suggestion.photoId ? { ...row, included: checked === true } : row
                      )))}
                    />
                    <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
                      <img
                        src={photo.fileUrl}
                        alt={`分類対象写真 ${suggestion.photoId}`}
                        className="h-full w-full object-cover"
                        style={{ transform: photo.rotation ? `rotate(${photo.rotation}deg)` : undefined }}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">現在: {photo.photoType}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Select
                          value={suggestion.category}
                          onValueChange={(value) => setSuggestions((rows) => rows.map((row) => (
                            row.photoId === suggestion.photoId
                              ? { ...row, category: value as PhotoClassificationCategory }
                              : row
                          )))}
                          disabled={!suggestion.included}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PHOTO_CLASSIFICATION_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>{category}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Badge className={`border ${confidenceClasses(suggestion.confidence)}`}>
                          確信度 {suggestion.confidence}%
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{suggestion.reason}</p>
                      {suggestion.requiresReview && (
                        <p className="text-xs font-medium text-amber-700">
                          80%未満のため、必ず目視で確認してください。
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="min-h-48 flex items-center justify-center text-sm text-muted-foreground">
              分類候補を取得できませんでした。閉じて再試行してください。
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={applyMutation.isPending}>
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={() => applyMutation.mutate({
                caseId,
                updates: includedSuggestions.map((row) => ({ photoId: row.photoId, category: row.category })),
              })}
              disabled={classifyMutation.isPending || applyMutation.isPending || includedSuggestions.length === 0}
            >
              {applyMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              確認した{includedSuggestions.length}枚を保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

