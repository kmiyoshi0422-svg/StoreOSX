import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, Loader2, ImageIcon, Eye } from "lucide-react";
import { toast } from "sonner";

function yen(n: number) {
  return `¥${n.toLocaleString()}`;
}

export default function ExpenseApprove() {
  const { data: pending, isLoading } = trpc.expenses.listPending.useQuery();
  const utils = trpc.useUtils();

  const approveMutation = trpc.expenses.approve.useMutation({
    onSuccess: () => {
      toast.success("承認しました");
      utils.expenses.listPending.invalidate();
    },
    onError: (err) => toast.error(`承認失敗: ${err.message}`),
  });

  const rejectMutation = trpc.expenses.reject.useMutation({
    onSuccess: () => {
      toast.success("却下しました");
      utils.expenses.listPending.invalidate();
    },
    onError: (err) => toast.error(`却下失敗: ${err.message}`),
  });

  const [rejectDialog, setRejectDialog] = useState<{ id: number; vendor: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  function handleReject() {
    if (!rejectDialog || !rejectReason.trim()) {
      toast.error("却下理由を入力してください");
      return;
    }
    rejectMutation.mutate({ id: rejectDialog.id, reason: rejectReason.trim() });
    setRejectDialog(null);
    setRejectReason("");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="経費承認" icon={<CheckCircle2 className="h-5 w-5" />} description="未承認の経費を確認し、承認または却下してください。" />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            未承認経費
            {pending && <Badge variant="secondary">{pending.length}件</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> 読み込み中…
            </div>
          ) : !pending || pending.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <div className="font-medium">未承認の経費はありません</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日付</TableHead>
                    <TableHead>申請者</TableHead>
                    <TableHead>支払先</TableHead>
                    <TableHead>費目</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead>レシート</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((exp: any) => (
                    <TableRow key={exp.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString("ja-JP") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{exp.createdByName ?? "—"}</TableCell>
                      <TableCell className="text-sm">{exp.vendorName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{exp.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{yen(exp.amount)}</TableCell>
                      <TableCell>
                        {exp.fileUrl ? (
                          <button
                            className="text-primary hover:underline flex items-center gap-1 text-xs"
                            onClick={() => setPreviewImage(exp.fileUrl)}
                          >
                            <ImageIcon className="h-3.5 w-3.5" /> 表示
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">なし</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {exp.note ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2 text-xs"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate({ id: exp.id })}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> 承認
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            onClick={() => setRejectDialog({ id: exp.id, vendor: exp.vendorName ?? "" })}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> 却下
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 却下理由ダイアログ */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) setRejectDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>却下理由を入力</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              経費「{rejectDialog?.vendor || "不明"}」を却下します。理由を入力してください。
            </p>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="却下理由を入力…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              却下する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* レシート画像プレビューダイアログ */}
      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-4 w-4" /> レシート画像</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex justify-center">
              <img src={previewImage} alt="レシート" className="max-h-[60vh] rounded-md" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
