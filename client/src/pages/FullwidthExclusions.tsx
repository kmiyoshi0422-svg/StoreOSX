import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { Loader2, Plus, Trash2, BookMarked, ShieldCheck } from "lucide-react";
import { reportLabel } from "../../../shared/reportText";

export default function FullwidthExclusions() {
  const utils = trpc.useUtils();
  const listQuery = trpc.fullwidthExclusions.list.useQuery();
  const [term, setTerm] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState("現場番号 100 の型番 ABC-123X");

  const addMutation = trpc.fullwidthExclusions.add.useMutation({
    onSuccess: () => {
      setTerm("");
      setNote("");
      utils.fullwidthExclusions.list.invalidate();
      toast.success("除外語を登録しました");
    },
    onError: (e) => toast.error(e.message || "登録に失敗しました"),
  });

  const deleteMutation = trpc.fullwidthExclusions.delete.useMutation({
    onSuccess: () => {
      utils.fullwidthExclusions.list.invalidate();
      toast.success("除外語を削除しました");
    },
    onError: (e) => toast.error(e.message || "削除に失敗しました"),
  });

  const terms = (listQuery.data ?? []).map((r) => r.term);

  const handleAdd = () => {
    const t = term.trim();
    if (!t) {
      toast.error("除外する語を入力してください");
      return;
    }
    addMutation.mutate({ term: t, note: note.trim() || undefined });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ヘッダー */}
      <div>
        <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-2">
          Settings
        </p>
        <h1 className="font-serif-jp text-3xl font-bold tracking-tight flex items-center gap-3">
          <BookMarked className="h-7 w-7" />
          全角化除外辞書
        </h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          報告書・見積書・写真台帳などのPDF出力では、数字を全角に統一しています。
          ここに登録した語は半角のまま保持され、意図しない全角化を防ぎます。
          メールアドレス・URL・英数字が混在する型番は自動で保護されるため、登録は不要です。
        </p>
      </div>

      {/* 自動保護の説明 */}
      <Card className="border-border/60 bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium">自動で保護される文字列</p>
              <p className="text-muted-foreground">
                メールアドレス、URL、英字と数字が混在する型番・品番
                （例 ABC-123X、iPhone15Pro）は登録しなくても半角のまま残ります。
                純粋な数字のみの語（例 現場番号、電話番号、ページ番号）は全角化されます。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 登録フォーム */}
      <Card className="border-border/60">
        <CardContent className="pt-6 space-y-4">
          <p className="font-medium text-sm">除外語を追加</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              placeholder="除外する語（例: A100 型番だけ半角のまま残す）"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <Input
              placeholder="メモ（任意）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              登録
            </Button>
          </div>

          {/* プレビュー */}
          <div className="rounded-lg border border-border/60 bg-background p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-2">プレビュー（現在の辞書を適用）</p>
            <Input
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              className="mb-2"
              placeholder="確認したいテキストを入力"
            />
            <p className="font-serif-jp">
              変換結果:{" "}
              <span className="font-semibold">{reportLabel(preview, terms) || "—"}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 一覧 */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <p className="font-medium text-sm mb-4">
            登録済みの除外語{" "}
            <span className="text-muted-foreground">
              {listQuery.data ? `（${listQuery.data.length}件）` : ""}
            </span>
          </p>

          {listQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (listQuery.data?.length ?? 0) === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              まだ除外語は登録されていません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>除外語</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead className="w-16 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data!.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.term}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.note || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>除外語を削除しますか？</AlertDialogTitle>
                            <AlertDialogDescription>
                              「{row.term}」を削除すると、以降のPDF出力でこの語も全角化の対象になります。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate({ id: row.id })}
                            >
                              削除する
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
