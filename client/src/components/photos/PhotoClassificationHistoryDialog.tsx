import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, History, Loader2, RotateCcw, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PhotoClassificationHistoryDialog({
  caseId,
  onRestored,
}: {
  caseId: number;
  onRestored: () => void;
}) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const historyQuery = trpc.photos.classificationHistory.useQuery(
    { caseId },
    { enabled: open },
  );
  const undoMutation = trpc.photos.undoClassification.useMutation({
    onSuccess: async (result) => {
      toast.success(`${result.count}枚を分類前の区分へ戻しました`);
      await utils.photos.classificationHistory.invalidate({ caseId });
      onRestored();
    },
    onError: (error) => toast.error(error.message),
  });

  const runs = historyQuery.data ?? [];

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="bg-background"
        onClick={() => setOpen(true)}
      >
        <History className="h-3.5 w-3.5 mr-1" />
        AI分類履歴
      </Button>

      <Dialog open={open} onOpenChange={(next) => !undoMutation.isPending && setOpen(next)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>AI写真分類の履歴</DialogTitle>
            <DialogDescription>
              AI提案を確認して保存した履歴です。現在の区分が保存直後のままの場合だけ、安全に一括で元へ戻せます。
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-4">
            {historyQuery.isLoading ? (
              <div className="min-h-48 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                履歴を読み込んでいます…
              </div>
            ) : historyQuery.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {historyQuery.error.message}
              </div>
            ) : runs.length === 0 ? (
              <div className="min-h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <History className="h-8 w-8" />
                <p className="text-sm">AI分類の保存履歴はまだありません。</p>
              </div>
            ) : (
              runs.map((run) => (
                <section key={run.id} className="rounded-xl border bg-card">
                  <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{formatDate(run.createdAt)} のAI分類</p>
                        {run.undoneAt ? (
                          <Badge variant="secondary">復元済み</Badge>
                        ) : run.canUndo ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">
                            元に戻せます
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                            現在値が変更済み
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5" />
                          実行者: {run.performedByName}
                        </span>
                        <span>変更: {run.changeCount}枚</span>
                        {run.undoneAt && (
                          <span>復元: {formatDate(run.undoneAt)}／{run.undoneByName || "不明"}</span>
                        )}
                      </div>
                      {!run.undoneAt && run.conflictCount > 0 && (
                        <p className="flex items-center gap-1 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          分類後に変更または削除された写真が{run.conflictCount}枚あるため、一括復元できません。
                        </p>
                      )}
                    </div>

                    {!run.undoneAt && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="bg-background shrink-0"
                            disabled={!run.canUndo || undoMutation.isPending}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            この分類を元に戻す
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>AI分類を元に戻しますか？</AlertDialogTitle>
                            <AlertDialogDescription>
                              この実行で変更した{run.changeCount}枚を、記録済みの変更前区分へ一括復元します。1枚でも現在値が変わっている場合は、全件を変更せず停止します。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => undoMutation.mutate({ caseId, runId: run.id })}
                            >
                              元の区分へ戻す
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  <div className="divide-y">
                    {run.changes.map((change) => (
                      <div key={change.id} className="grid gap-3 p-4 sm:grid-cols-[88px_minmax(0,1fr)]">
                        <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
                          <img
                            src={change.photoFileUrl}
                            alt={`分類履歴 写真${change.photoId}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="outline">変更前: {change.beforePhotoType}</Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline">変更後: {change.afterPhotoType}</Badge>
                            <Badge variant="secondary">確信度 {change.confidence}%</Badge>
                            {change.suggestedCategory !== change.confirmedCategory && (
                              <Badge className="bg-blue-100 text-blue-800 border border-blue-200">
                                AI提案 {change.suggestedCategory} → 人が {change.confirmedCategory} に修正
                              </Badge>
                            )}
                            {!change.isCurrentMatch && !run.undoneAt && (
                              <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                                現在: {change.currentPhotoType ?? "写真削除済み"}
                              </Badge>
                            )}
                            {change.hasLaterActiveChange && !run.undoneAt && (
                              <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                                後続のAI分類あり
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground">{change.reason}</p>
                          {change.photoMemo && (
                            <p className="text-xs text-muted-foreground line-clamp-2">メモ: {change.photoMemo}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
