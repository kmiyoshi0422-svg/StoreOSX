import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ArrowLeft,
  History,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type Price = {
  majorCategory: string;
  category: string;
  name: string;
  specification: string;
  unit: string;
  low: number;
  standard: number;
  high: number;
  note: string;
  sourceRef: string;
};
const blank: Price = {
  majorCategory: "",
  category: "",
  name: "",
  specification: "",
  unit: "式",
  low: 0,
  standard: 0,
  high: 0,
  note: "",
  sourceRef: "現場確認／手入力",
};
const fields = [
  ["majorCategory", "大分類"],
  ["category", "分類"],
  ["name", "工事項目"],
  ["specification", "規格・条件"],
  ["unit", "単位"],
  ["sourceRef", "価格の根拠・版"],
] as const;
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
export default function UnitPriceMaster() {
  const [, go] = useLocation();
  const utils = trpc.useUtils();
  const list = trpc.estimateAssistant.masterList.useQuery();
  const save = trpc.estimateAssistant.masterSave.useMutation();
  const remove = trpc.estimateAssistant.masterDelete.useMutation();
  const [query, setQuery] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<{
    id?: string;
    updatedAt?: number;
  } | null>(null);
  const [form, setForm] = useState<Price>(blank);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const history = trpc.estimateAssistant.masterHistory.useQuery(
    { id: historyId ?? "" },
    { enabled: !!historyId }
  );
  const filtered = useMemo(() => {
    const q = query.trim().normalize("NFKC").toLowerCase();
    return (list.data ?? []).filter(
      item =>
        (showDeleted || item.isActive) &&
        (!q ||
          `${item.name} ${item.specification} ${item.category} ${item.sourceRef}`
            .normalize("NFKC")
            .toLowerCase()
            .includes(q))
    );
  }, [list.data, query, showDeleted]);
  const openEdit = (row?: NonNullable<typeof list.data>[number]) => {
    setEditing(row ? { id: row.id, updatedAt: row.updatedAt } : {});
    setForm(
      row
        ? {
            majorCategory: row.majorCategory,
            category: row.category,
            name: row.name,
            specification: row.specification,
            unit: row.unit,
            low: row.low,
            standard: row.standard,
            high: row.high,
            note: row.note ?? "",
            sourceRef: row.sourceRef,
          }
        : { ...blank }
    );
  };
  const saveForm = async () => {
    if (
      !form.name.trim() ||
      !form.majorCategory.trim() ||
      !form.category.trim() ||
      !form.unit.trim() ||
      !form.sourceRef.trim()
    )
      return toast.error("分類・工事項目・単位・根拠を入力してください");
    if (
      !Number.isInteger(form.low) ||
      !Number.isInteger(form.standard) ||
      !Number.isInteger(form.high) ||
      form.low < 1 ||
      form.low > form.standard ||
      form.standard > form.high
    )
      return toast.error("価格は1円以上、下限 ≤ 標準 ≤ 上限で入力してください");
    try {
      await save.mutateAsync({
        id: editing?.id,
        expectedUpdatedAt: editing?.updatedAt,
        price: form,
      });
      await Promise.all([
        utils.estimateAssistant.masterList.invalidate(),
        utils.estimateAssistant.catalog.invalidate(),
      ]);
      setEditing(null);
      toast.success(
        editing?.id ? "単価を更新し履歴に記録しました" : "単価を追加しました"
      );
    } catch (error: any) {
      toast.error(error?.message ?? "保存できませんでした");
    }
  };
  const deleteRow = async (id: string, updatedAt: number) => {
    try {
      await remove.mutateAsync({ id, expectedUpdatedAt: updatedAt });
      await Promise.all([
        utils.estimateAssistant.masterList.invalidate(),
        utils.estimateAssistant.catalog.invalidate(),
      ]);
      toast.success("単価を非表示にしました。既存見積と変更履歴は残ります");
    } catch (error: any) {
      toast.error(error?.message ?? "削除できませんでした");
    }
  };
  return (
    <div className="mx-auto max-w-[1480px] space-y-5 px-4 py-6 md:px-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[.18em] text-slate-500">
            STORE OSX / ESTIMATE STUDIO
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#17304c]">
            標準施工単価マスタ
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            元Excelの117件を初期登録。更新値は以降の見積案に反映し、承認済み見積は変更しません。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => go("/estimates/assistant")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            見積支援へ戻る
          </Button>
          <Button onClick={() => openEdit()}>
            <Plus className="mr-2 h-4 w-4" />
            単価を追加
          </Button>
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">単価の一覧と変更履歴</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-64 flex-1 items-center gap-2 rounded-md border px-3">
              <Search className="h-4 w-4 text-slate-500" />
              <Input
                className="border-0 shadow-none"
                aria-label="単価を検索"
                placeholder="工事項目・規格・分類・根拠で検索"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={e => setShowDeleted(e.target.checked)}
              />
              削除済みも表示
            </label>
          </div>
          <p className="text-xs text-slate-500">
            {filtered.length}
            件表示。原本の税区分は明記されていないため、見積上は税抜試算として要確認です。
          </p>
          {list.isLoading ? (
            <p className="text-sm">読み込み中...</p>
          ) : list.error ? (
            <p className="text-sm text-red-700">
              単価マスタを読み込めません: {list.error.message}
            </p>
          ) : (
            <div className="max-h-[70vh] space-y-2 overflow-auto">
              {filtered.map(row => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{row.name}</strong>
                      {!row.isActive && (
                        <Badge variant="outline">削除済み</Badge>
                      )}
                      <span className="text-xs text-slate-500">
                        {row.specification}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {row.majorCategory} ／ {row.unit}　下限 {yen(row.low)}
                      　標準 {yen(row.standard)}　上限 {yen(row.high)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      根拠：{row.sourceRef} {row.note ? `／ ${row.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHistoryId(row.id)}
                    >
                      <History className="mr-1 h-4 w-4" />
                      履歴
                    </Button>
                    {row.isActive && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          編集
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700"
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              削除
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                この単価を非表示にしますか？
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                「{row.name}
                                」を今後の検索・PDF自動提案から外します。保存済み・承認済みの見積明細と変更履歴は残ります。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  void deleteRow(row.id, row.updatedAt)
                                }
                              >
                                非表示にする
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={editing !== null}
        onOpenChange={open => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "標準施工単価を編集" : "標準施工単価を追加"}
            </DialogTitle>
            <DialogDescription>
              金額は円単位。編集前の値は変更履歴に記録します。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([field, label]) => (
              <label key={field} className="text-sm font-medium">
                {label}
                <Input
                  className="mt-1"
                  value={form[field]}
                  onChange={e =>
                    setForm(f => ({ ...f, [field]: e.target.value }))
                  }
                />
              </label>
            ))}
            {(["low", "standard", "high"] as const).map((field, i) => (
              <label key={field} className="text-sm font-medium">
                {["下限", "標準", "上限"][i]}（円）
                <Input
                  className="mt-1"
                  type="number"
                  min="1"
                  step="1"
                  value={form[field] || ""}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      [field]: e.target.value ? Number(e.target.value) : 0,
                    }))
                  }
                />
              </label>
            ))}
            <label className="sm:col-span-2 text-sm font-medium">
              備考
              <Input
                className="mt-1"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              キャンセル
            </Button>
            <Button disabled={save.isPending} onClick={() => void saveForm()}>
              {save.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!historyId}
        onOpenChange={open => {
          if (!open) setHistoryId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>単価の変更履歴</DialogTitle>
          </DialogHeader>
          {history.isLoading ? (
            <p>読み込み中...</p>
          ) : history.error ? (
            <p className="text-red-700">{history.error.message}</p>
          ) : history.data?.length ? (
            history.data.map(item => {
              const before = item.beforeJson
                ? (JSON.parse(item.beforeJson) as Partial<Price>)
                : null;
              const after = item.afterJson
                ? (JSON.parse(item.afterJson) as Partial<Price>)
                : null;
              return (
                <div key={item.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-semibold">
                    {item.operation === "create"
                      ? "追加"
                      : item.operation === "update"
                        ? "編集"
                        : "削除"}
                    　{new Date(item.changedAt).toLocaleString("ja-JP")}
                    　操作ID: {item.changedBy}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {before
                      ? `変更前: ${before.name}／標準 ${yen(before.standard ?? 0)}`
                      : "新規登録"}{" "}
                    →{" "}
                    {after
                      ? `変更後: ${after.name}／標準 ${yen(after.standard ?? 0)}`
                      : "削除"}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">
              変更履歴はありません（元Excelからの初期登録を除く）
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
