import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  List,
  Loader2,
  Filter,
  X,
  Pencil,
  Trash2,
  Check,
  Download,
  ImageIcon,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

type FilterState = {
  dateFrom: string;
  dateTo: string;
  createdByName: string;
  category: string;
  scope: string;
  keyword: string;
};

const ALL_CATEGORIES = ["材料費", "外注費", "交通費", "消耗品", "車両費", "宿泊費", "接待交際費", "人件費", "現調費", "その他"];

function yen(n: number | null | undefined) {
  return n != null ? `¥${Math.round(n).toLocaleString()}` : "—";
}

export default function ExpenseList() {
  const utils = trpc.useUtils();
  const { data: allExpenses = [], isLoading } = trpc.expenses.exportAll.useQuery({});
  const updateMutation = trpc.expenses.update.useMutation({
    onSuccess: () => {
      utils.expenses.exportAll.invalidate();
      toast.success("経費を更新しました");
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      utils.expenses.exportAll.invalidate();
      toast.success("経費を削除しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    createdByName: "",
    category: "",
    scope: "",
    keyword: "",
  });

  // レシートプレビュー
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // インライン編集
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPatch, setEditPatch] = useState<{
    vendorName: string;
    amount: string;
    category: string;
    expenseDate: string;
    note: string;
  }>({ vendorName: "", amount: "", category: "", expenseDate: "", note: "" });

  // フィルター適用
  const filtered = useMemo(() => {
    return allExpenses.filter((e: any) => {
      if (filters.dateFrom) {
        const d = e.expenseDate ? new Date(e.expenseDate).toISOString().slice(0, 10) : "";
        if (d < filters.dateFrom) return false;
      }
      if (filters.dateTo) {
        const d = e.expenseDate ? new Date(e.expenseDate).toISOString().slice(0, 10) : "";
        if (d > filters.dateTo) return false;
      }
      if (filters.createdByName && (e.createdByName ?? "") !== filters.createdByName) return false;
      if (filters.category && e.category !== filters.category) return false;
      if (filters.scope && e.scope !== filters.scope) return false;
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        const searchable = [e.vendorName, e.note, e.createdByName, String(e.caseId)].join(" ").toLowerCase();
        if (!searchable.includes(kw)) return false;
      }
      return true;
    });
  }, [allExpenses, filters]);

  // 入力者名の一覧（ユニーク）
  const createdByNames = useMemo(() => {
    const names = new Set<string>();
    allExpenses.forEach((e: any) => { if (e.createdByName) names.add(e.createdByName); });
    return Array.from(names).sort();
  }, [allExpenses]);

  const filteredTotal = filtered.reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  const clearFilters = () => setFilters({ dateFrom: "", dateTo: "", createdByName: "", category: "", scope: "", keyword: "" });

  const startEdit = (e: any) => {
    setEditingId(e.id);
    setEditPatch({
      vendorName: e.vendorName ?? "",
      amount: String(e.amount ?? 0),
      category: e.category ?? "その他",
      expenseDate: e.expenseDate ? new Date(e.expenseDate).toISOString().slice(0, 10) : "",
      note: e.note ?? "",
    });
  };

  const saveEdit = () => {
    if (editingId == null) return;
    const amt = Number(editPatch.amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("金額を正しく入力してください"); return; }
    updateMutation.mutate({
      id: editingId,
      patch: {
        vendorName: editPatch.vendorName || null,
        amount: amt,
        category: editPatch.category as any,
        expenseDate: editPatch.expenseDate || null,
        note: editPatch.note || null,
      },
    });
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const BOM = "\uFEFF";
    const headers = ["ID", "日付", "業者名", "区分", "金額(税込)", "消費税", "摘要", "スコープ", "案件ID", "入力者", "入力日時", "更新者", "更新日時"];
    const rows = filtered.map((e: any) => [
      e.id,
      e.expenseDate ? new Date(e.expenseDate).toLocaleDateString("ja-JP") : "",
      e.vendorName ?? "",
      e.category ?? "",
      e.amount ?? 0,
      e.taxAmount ?? "",
      (e.note ?? "").replace(/[\r\n]+/g, " "),
      e.scope ?? "",
      e.caseId ?? "",
      e.createdByName ?? "",
      e.createdAt ? new Date(e.createdAt).toLocaleString("ja-JP") : "",
      e.updatedByName ?? "",
      e.updatedAt ? new Date(e.updatedAt).toLocaleString("ja-JP") : "",
    ]);
    const csv = BOM + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `経費明細_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Expense Detail"
        title="経費明細一覧"
        icon={<List className="h-7 w-7 text-primary" />}
        description="全経費を1件ずつ確認・編集・削除できます。フィルターで絞り込み、CSVエクスポートも可能です。"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              フィルター
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">ON</Badge>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </div>
        }
      />

      {/* フィルターパネル */}
      {showFilters && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-primary" />
                絞り込み条件
              </h3>
              {hasActiveFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters} className="text-xs h-7">
                  <X className="h-3 w-3 mr-1" />クリア
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">開始日</Label>
                <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">終了日</Label>
                <Input type="date" value={filters.dateTo} onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">入力者</Label>
                <select className="w-full border rounded-md px-2 py-1.5 text-xs bg-background h-8" value={filters.createdByName} onChange={(e) => setFilters(f => ({ ...f, createdByName: e.target.value }))}>
                  <option value="">全員</option>
                  {createdByNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">区分</Label>
                <select className="w-full border rounded-md px-2 py-1.5 text-xs bg-background h-8" value={filters.category} onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}>
                  <option value="">全区分</option>
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">スコープ</Label>
                <select className="w-full border rounded-md px-2 py-1.5 text-xs bg-background h-8" value={filters.scope} onChange={(e) => setFilters(f => ({ ...f, scope: e.target.value }))}>
                  <option value="">全て</option>
                  <option value="案件">案件</option>
                  <option value="全体">全体</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">キーワード</Label>
                <Input placeholder="業者名・摘要等" value={filters.keyword} onChange={(e) => setFilters(f => ({ ...f, keyword: e.target.value }))} className="h-8 text-xs" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* サマリー */}
      <div className="flex items-center gap-4 text-sm">
        <Badge variant="outline" className="font-mono">{filtered.length}件</Badge>
        <span className="text-muted-foreground">合計:</span>
        <span className="font-bold font-mono text-base">{yen(filteredTotal)}</span>
        {hasActiveFilters && (
          <span className="text-xs text-muted-foreground">（全{allExpenses.length}件中）</span>
        )}
      </div>

      {/* テーブル */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> 読み込み中…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center flex flex-col items-center gap-3">
            <List className="h-10 w-10 opacity-60 text-muted-foreground" />
            <div className="font-medium">該当する経費がありません</div>
            <div className="text-sm text-muted-foreground">
              フィルター条件を変更してください。
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-muted/60 text-foreground/80 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium w-[80px]">日付</th>
                    <th className="text-left px-3 py-2.5 font-medium">業者名</th>
                    <th className="text-left px-3 py-2.5 font-medium w-[80px]">区分</th>
                    <th className="text-right px-3 py-2.5 font-medium w-[100px]">金額</th>
                    <th className="text-left px-3 py-2.5 font-medium">摘要</th>
                    <th className="text-left px-3 py-2.5 font-medium w-[60px]">範囲</th>
                    <th className="text-left px-3 py-2.5 font-medium w-[70px]">案件ID</th>
                    <th className="text-left px-3 py-2.5 font-medium w-[50px]">レシート</th>
                    <th className="text-left px-3 py-2.5 font-medium w-[60px]">承認</th>
                    <th className="text-left px-3 py-2.5 font-medium w-[80px]">入力者</th>
                    <th className="text-left px-3 py-2.5 font-medium w-[100px]">入力日時</th>
                    <th className="px-3 py-2.5 w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e: any) => {
                    const isEditing = editingId === e.id;
                    return (
                      <tr key={e.id} className="border-t hover:bg-muted/30 transition-colors">
                        {isEditing ? (
                          <>
                            <td className="px-2 py-1.5">
                              <Input type="date" value={editPatch.expenseDate} onChange={(ev) => setEditPatch(p => ({ ...p, expenseDate: ev.target.value }))} className="h-7 text-xs" />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input value={editPatch.vendorName} onChange={(ev) => setEditPatch(p => ({ ...p, vendorName: ev.target.value }))} className="h-7 text-xs" placeholder="業者名" />
                            </td>
                            <td className="px-2 py-1.5">
                              <select className="w-full border rounded px-1 py-1 text-xs bg-background h-7" value={editPatch.category} onChange={(ev) => setEditPatch(p => ({ ...p, category: ev.target.value }))}>
                                {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <Input type="number" value={editPatch.amount} onChange={(ev) => setEditPatch(p => ({ ...p, amount: ev.target.value }))} className="h-7 text-xs text-right" />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input value={editPatch.note} onChange={(ev) => setEditPatch(p => ({ ...p, note: ev.target.value }))} className="h-7 text-xs" placeholder="摘要" />
                            </td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground">{e.scope ?? "—"}</td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground tabular-nums">{e.caseId ?? "—"}</td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground">{e.createdByName ?? "—"}</td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
                              {e.createdAt ? new Date(e.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={saveEdit} disabled={updateMutation.isPending} className="h-7 w-7 p-0">
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 w-7 p-0">
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 tabular-nums text-xs">
                              {e.expenseDate ? new Date(e.expenseDate).toLocaleDateString("ja-JP") : "—"}
                            </td>
                            <td className="px-3 py-2 text-xs">{e.vendorName ?? "—"}</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{e.category}</Badge>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-xs">{yen(e.amount)}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{e.note ?? "—"}</td>
                            <td className="px-3 py-2">
                              <Badge variant={e.scope === "全体" ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                                {e.scope ?? "—"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{e.caseId ?? "—"}</td>
                            <td className="px-3 py-2">
                              {e.fileUrl ? (
                                <button className="text-primary hover:underline flex items-center gap-0.5 text-xs" onClick={() => setPreviewImage(e.fileUrl)}>
                                  <ImageIcon className="h-3 w-3" />
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {e.approvalStatus === "approved" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              ) : e.approvalStatus === "rejected" ? (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{e.createdByName ?? "—"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                              {e.createdAt ? new Date(e.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex gap-0.5">
                                <Button size="sm" variant="ghost" onClick={() => startEdit(e)} className="h-7 w-7 p-0">
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { if (confirm("この経費を削除しますか？")) deleteMutation.mutate({ id: e.id }); }}
                                  disabled={deleteMutation.isPending}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* レシート画像プレビュー */}
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
