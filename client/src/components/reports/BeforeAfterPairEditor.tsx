import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Link2, Loader2, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import type { Photo } from "../../../../drizzle/schema";
import { pairBeforeAfterPhotos, type ManualPhotoPair } from "../../../../shared/reportPhotoPairs";

type Props = {
  beforePhotos: Photo[];
  afterPhotos: Photo[];
  manualPairs: ManualPhotoPair[];
  saving: boolean;
  onChange: (pairs: ManualPhotoPair[]) => void;
};

const photoLabel = (photo: Photo) =>
  [photo.photoType, photo.workItem?.trim(), `写真ID ${photo.id}`].filter(Boolean).join("｜");

export function BeforeAfterPairEditor({
  beforePhotos,
  afterPhotos,
  manualPairs,
  saving,
  onChange,
}: Props) {
  const automaticByBefore = useMemo(() => {
    const pairs = pairBeforeAfterPhotos(beforePhotos, afterPhotos);
    return new Map(pairs.flatMap((pair) => pair.before ? [[pair.before.id, pair.after ?? null] as const] : []));
  }, [afterPhotos, beforePhotos]);
  const overrideByBefore = useMemo(
    () => new Map(manualPairs.flatMap((pair) => pair.beforePhotoId == null ? [] : [[pair.beforePhotoId, pair] as const])),
    [manualPairs],
  );
  const usedAfterIds = useMemo(
    () => new Set(manualPairs.flatMap((pair) => pair.afterPhotoId == null ? [] : [pair.afterPhotoId])),
    [manualPairs],
  );

  const updatePair = (beforePhotoId: number, value: string) => {
    const selectedAfterId = value.startsWith("after:") ? Number(value.slice(6)) : null;
    const next = manualPairs.filter((pair) =>
      pair.beforePhotoId !== beforePhotoId &&
      (selectedAfterId == null || pair.afterPhotoId !== selectedAfterId),
    );
    if (value === "single") next.push({ beforePhotoId, afterPhotoId: null });
    if (selectedAfterId != null) next.push({ beforePhotoId, afterPhotoId: selectedAfterId });
    onChange(next);
  };

  if (beforePhotos.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
        施工前写真がありません。写真区分を施工前へ変更すると組み合わせを編集できます。
      </div>
    );
  }

  return (
    <div id="before-after-pairs" className="space-y-3" data-manual-photo-pair-editor="true">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            Before／After写真の組み合わせ
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            「自動」の結果が違う場合だけ施工後写真を選択してください。使用中の写真を選ぶと、元の組み合わせから外して入れ替えます。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 bg-background"
          disabled={saving || manualPairs.length === 0}
          onClick={() => onChange([])}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />自動に戻す
        </Button>
      </div>

      <div className="space-y-2">
        {beforePhotos.map((before) => {
          const override = overrideByBefore.get(before.id);
          const automaticAfter = automaticByBefore.get(before.id) ?? null;
          const selectedAfter = override?.afterPhotoId == null
            ? null
            : afterPhotos.find((photo) => photo.id === override.afterPhotoId) ?? null;
          const value = override
            ? override.afterPhotoId == null ? "single" : `after:${override.afterPhotoId}`
            : "auto";
          return (
            <div key={before.id} className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[1fr_auto_1.15fr] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <img src={before.fileUrl} alt="施工前" className="h-16 w-20 shrink-0 rounded border border-border object-cover" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#b42318]">Before</p>
                  <p className="truncate text-xs font-medium">{photoLabel(before)}</p>
                </div>
              </div>
              <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
              <div className="space-y-2">
                <Select value={value} onValueChange={(next) => updatePair(before.id, next)} disabled={saving}>
                  <SelectTrigger className="h-9 bg-background text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自動で組み合わせ</SelectItem>
                    <SelectItem value="single">施工後なし・単独表示</SelectItem>
                    {afterPhotos.map((after) => (
                      <SelectItem key={after.id} value={`after:${after.id}`}>
                        {photoLabel(after)}{usedAfterIds.has(after.id) && override?.afterPhotoId !== after.id ? "・使用中" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  {(selectedAfter ?? (!override ? automaticAfter : null)) ? (
                    <>
                      <img src={(selectedAfter ?? automaticAfter)!.fileUrl} alt="施工後" className="h-10 w-12 rounded border border-border object-cover" />
                      <span className="truncate">{override ? "手動" : "自動"}：{photoLabel((selectedAfter ?? automaticAfter)!)}</span>
                    </>
                  ) : (
                    <span>{override ? "手動：施工後写真なし" : "自動候補なし"}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
