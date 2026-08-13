import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Download,
  ExternalLink,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  Undo2,
  MessageSquare,
} from "lucide-react";

export default function CompletedReports() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: reports = [], isLoading } = trpc.cases.listCompletedReports.useQuery();
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"completedAt" | "storeName">("completedAt");
  const [rejectTarget, setRejectTarget] = useState<{ id: number; storeName: string | null } | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const rejectMut = trpc.cases.rejectReport.useMutation({
    onSuccess: () => {
      toast.success("報告書を差し戻しました");
      setRejectTarget(null);
      setRejectComment("");
      utils.cases.listCompletedReports.invalidate();
    },
    onError: (e: any) => toast.error(e.message || "差し戻しに失敗しました"),
  });

  // ブランド一覧を抽出
  const brands = useMemo(() => {
    const set = new Set(reports.map((r) => r.brand).filter(Boolean));
    return Array.from(set).sort();
  }, [reports]);

  // フィルター・ソート適用
  const filtered = useMemo(() => {
    let result = [...reports];
    if (filterBrand !== "all") {
      result = result.filter((r) => r.brand === filterBrand);
    }
    result.sort((a, b) => {
      if (sortBy === "completedAt") {
        const da = a.reportCompletedAt ? new Date(a.reportCompletedAt).getTime() : 0;
        const db = b.reportCompletedAt ? new Date(b.reportCompletedAt).getTime() : 0;
        return db - da; // 新しい順
      }
      return (a.storeName ?? "").localeCompare(b.storeName ?? "");
    });
    return result;
  }, [reports, filterBrand, sortBy]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">完了済み報告書一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">
            作成完了した報告書を一覧で確認し、PDFをダウンロードできます
          </p>
        </div>
        <Badge variant="outline" className="text-base px-3 py-1">
          {filtered.length} 件
        </Badge>
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
          >
            <option value="all">全ブランド</option>
            {brands.map((b) => (
              <option key={b} value={b!}>{b}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">並び替え:</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="completedAt">完了日（新しい順）</option>
            <option value="storeName">店舗名</option>
          </select>
        </div>
      </div>

      {/* 一覧テーブル */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>完了済みの報告書はまだありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">店舗名</th>
                <th className="text-left px-4 py-3 font-medium">依頼番号</th>
                <th className="text-left px-4 py-3 font-medium">ブランド</th>
                <th className="text-left px-4 py-3 font-medium">完了者</th>
                <th className="text-left px-4 py-3 font-medium">完了日時</th>
                <th className="text-left px-4 py-3 font-medium">通知</th>
                <th className="text-center px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((report) => {
                const completedDate = report.reportCompletedAt
                  ? new Date(report.reportCompletedAt).toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—";
                const notified = !!report.reportPdfGeneratedAt;

                return (
                  <tr key={report.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{report.storeName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{report.requestNumber}</td>
                    <td className="px-4 py-3">
                      {report.brand && (
                        <Badge variant="secondary" className="text-xs">{report.brand}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">{report.reportCompletedBy ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{completedDate}</td>
                    <td className="px-4 py-3">
                      {notified ? (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          通知済み
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          待機中
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/cases/${report.id}/survey-report`)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          開く
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setLocation(`/cases/${report.id}/survey-report`)}
                          title="報告書を開いてPDFダウンロードボタンを使用"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setRejectTarget({ id: report.id, storeName: report.storeName })}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          差し戻し
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">完了済み合計</div>
            <div className="text-2xl font-bold mt-1">{reports.length} 件</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">通知済み</div>
            <div className="text-2xl font-bold mt-1 text-emerald-600">
              {reports.filter((r) => r.reportPdfGeneratedAt).length} 件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">通知待ち</div>
            <div className="text-2xl font-bold mt-1 text-amber-600">
              {reports.filter((r) => !r.reportPdfGeneratedAt).length} 件
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 差し戻しダイアログ */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl w-full">
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-destructive" />
              報告書を差し戻す
            </h3>
            <p className="text-sm text-muted-foreground mb-1">
              <span className="font-medium text-foreground">{rejectTarget.storeName}</span> の報告書を差し戻します。
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              修正依頼のコメントを入力してください。
            </p>
            <Textarea
              placeholder="例：写真の順番を修正してください / 所感の内容を追記してください"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectComment(""); }}>
                キャンセル
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectMut.mutate({ caseId: rejectTarget.id, comment: rejectComment })}
                disabled={!rejectComment.trim() || rejectMut.isPending}
              >
                {rejectMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                差し戻す
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
