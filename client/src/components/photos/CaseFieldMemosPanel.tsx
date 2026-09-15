import { useState } from "react";
import { AlertTriangle, Clock3, Loader2, MessageSquareText, Pencil, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FIELD_MEMO_CATEGORIES,
  FIELD_MEMO_MAX_LENGTH,
  canCreateFieldMemo,
  canModifyFieldMemo,
  canViewFieldMemos,
  type FieldMemoCategory,
} from "@shared/fieldMemos";

const ROLE_LABELS: Record<string, string> = {
  owner: "最高管理者",
  admin: "管理者",
  user: "社員",
  executive: "役員",
  partner: "協力業者",
};

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CaseFieldMemosPanel({ caseId }: { caseId: number }) {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const canView = canViewFieldMemos(role);
  const canCreate = canCreateFieldMemo(role);
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<FieldMemoCategory>("状況");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<FieldMemoCategory>("状況");
  const [editingBody, setEditingBody] = useState("");

  const memosQuery = trpc.fieldMemos.listByCase.useQuery(
    { caseId },
    { enabled: canView },
  );

  const invalidate = () => utils.fieldMemos.listByCase.invalidate({ caseId });
  const createMemo = trpc.fieldMemos.create.useMutation({
    onSuccess: async () => {
      setBody("");
      setCategory("状況");
      await invalidate();
      toast.success("現場メモを追加しました");
    },
    onError: (error) => toast.error(error.message || "現場メモの追加に失敗しました"),
  });
  const updateMemo = trpc.fieldMemos.update.useMutation({
    onSuccess: async () => {
      setEditingId(null);
      await invalidate();
      toast.success("現場メモを更新しました");
    },
    onError: (error) => toast.error(error.message || "現場メモの更新に失敗しました"),
  });
  const deleteMemo = trpc.fieldMemos.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("現場メモを削除しました");
    },
    onError: (error) => toast.error(error.message || "現場メモの削除に失敗しました"),
  });

  if (!canView) return null;

  const memos = memosQuery.data ?? [];
  const bodyLength = body.length;

  return (
    <Card id="case-field-memos" className="border-sky-200 bg-sky-50/40">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="h-4 w-4 text-sky-700" />
              現場メモ
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              案件全体の状況を時系列で記録します。写真固有の内容は各写真のメモ欄へ入力してください。
            </p>
          </div>
          <Badge variant="outline" className="w-fit bg-background">
            {memos.length}件
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canCreate && (
          <div className="rounded-lg border bg-background p-3">
            <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
              <Select value={category} onValueChange={(value) => setCategory(value as FieldMemoCategory)}>
                <SelectTrigger aria-label="現場メモ種別">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_MEMO_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={FIELD_MEMO_MAX_LENGTH}
                  rows={3}
                  placeholder="例：天井点検口付近に漏水跡あり。店舗責任者へ状況を説明済み。"
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">記入者と日時は自動記録されます</span>
                  <span className={bodyLength >= 450 ? "text-xs font-medium text-amber-700" : "text-xs text-muted-foreground"}>
                    {bodyLength}/{FIELD_MEMO_MAX_LENGTH}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                disabled={!body.trim() || createMemo.isPending}
                onClick={() => createMemo.mutate({ caseId, category, body })}
              >
                {createMemo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                現場メモを追加
              </Button>
            </div>
          </div>
        )}

        {memosQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中...
          </div>
        ) : memos.length === 0 ? (
          <div className="py-5 text-center text-sm text-muted-foreground">現場メモはまだありません。</div>
        ) : (
          <div className="space-y-2">
            {memos.map((memo) => {
              const editable = !!user && canModifyFieldMemo(role, user.id, memo.authorUserId);
              const editing = editingId === memo.id;
              return (
                <div key={memo.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{memo.category}</Badge>
                      <span className="text-sm font-medium">{memo.authorName}</span>
                      <span className="text-xs text-muted-foreground">{ROLE_LABELS[memo.authorRole] ?? memo.authorRole}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDate(memo.createdAt)}
                    </div>
                  </div>

                  {editing ? (
                    <div className="mt-3 space-y-2">
                      <Select value={editingCategory} onValueChange={(value) => setEditingCategory(value as FieldMemoCategory)}>
                        <SelectTrigger className="h-8 sm:w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FIELD_MEMO_CATEGORIES.map((item) => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        value={editingBody}
                        onChange={(event) => setEditingBody(event.target.value)}
                        maxLength={FIELD_MEMO_MAX_LENGTH}
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="bg-background" onClick={() => setEditingId(null)}>
                          キャンセル
                        </Button>
                        <Button
                          size="sm"
                          disabled={!editingBody.trim() || updateMemo.isPending}
                          onClick={() => updateMemo.mutate({ id: memo.id, category: editingCategory, body: editingBody })}
                        >
                          {updateMemo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{memo.body}</p>
                  )}

                  {editable && !editing && (
                    <div className="mt-2 flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(memo.id);
                          setEditingCategory(memo.category);
                          setEditingBody(memo.body);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> 編集
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" /> 削除
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>現場メモを削除しますか？</AlertDialogTitle>
                            <AlertDialogDescription>
                              削除したメモは元に戻せません。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMemo.mutate({ id: memo.id })}>
                              削除する
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!canCreate && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            この権限では現場メモを閲覧できますが、追加・編集はできません。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
