import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calculator, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { EstimateLine } from "../../../../shared/estimateAssistant";
import { presetToEstimateLine } from "../../../../shared/estimatePresets";

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt: number;
};
type Item = {
  id: string;
  categoryId: string;
  name: string;
  specification: string;
  unit: string;
  unitPrice: number | null;
  note: string | null;
  sortOrder: number;
  updatedAt: number;
};
type CategoryForm = {
  id?: string;
  expectedUpdatedAt?: number;
  name: string;
  sortOrder: number;
};
type ItemForm = {
  id?: string;
  expectedUpdatedAt?: number;
  categoryId: string;
  name: string;
  specification: string;
  unit: string;
  unitPrice: string;
  note: string;
  sortOrder: number;
};

export default function EstimatePresetMenu({
  canModify,
  canAdd,
  onAdd,
  onForetia,
}: {
  canModify: boolean;
  canAdd: boolean;
  onAdd: (line: EstimateLine) => void;
  onForetia: () => void;
}) {
  const catalog = trpc.estimatePresets.list.useQuery();
  const utils = trpc.useUtils();
  const saveCategory = trpc.estimatePresets.saveCategory.useMutation();
  const hideCategory = trpc.estimatePresets.hideCategory.useMutation();
  const saveItem = trpc.estimatePresets.saveItem.useMutation();
  const hideItem = trpc.estimatePresets.hideItem.useMutation();
  const [categoryId, setCategoryId] = useState<string>("blind");
  const [categoryForm, setCategoryForm] = useState<CategoryForm | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm | null>(null);
  const selected =
    catalog.data?.find(row => row.id === categoryId) ?? catalog.data?.[0];
  const busy =
    saveCategory.isPending ||
    hideCategory.isPending ||
    saveItem.isPending ||
    hideItem.isPending;
  const refresh = () => utils.estimatePresets.list.invalidate();

  const addPreset = (item: Item) => {
    if (!canModify || !canAdd) return;
    onAdd(presetToEstimateLine(item, selected?.name ?? "定型"));
    toast.success("明細へ追加しました。数量と金額を確認してください");
  };
  const submitCategory = async () => {
    if (!categoryForm) return;
    try {
      const result = await saveCategory.mutateAsync({
        id: categoryForm.id,
        expectedUpdatedAt: categoryForm.expectedUpdatedAt,
        value: {
          name: categoryForm.name.trim(),
          sortOrder: categoryForm.sortOrder,
        },
      });
      setCategoryId(result.id);
      setCategoryForm(null);
      await refresh();
      toast.success("分類を保存しました");
    } catch (e: any) {
      toast.error(e?.message ?? "分類を保存できませんでした");
    }
  };
  const submitItem = async () => {
    if (!itemForm) return;
    const price =
      itemForm.unitPrice.trim() === "" ? null : Number(itemForm.unitPrice);
    if (
      price !== null &&
      (!Number.isInteger(price) || price < 0 || price > 100_000_000)
    )
      return toast.error("単価は空欄か0円以上の整数で入力してください");
    try {
      await saveItem.mutateAsync({
        id: itemForm.id,
        expectedUpdatedAt: itemForm.expectedUpdatedAt,
        value: {
          categoryId: itemForm.categoryId,
          name: itemForm.name.trim(),
          specification: itemForm.specification.trim(),
          unit: itemForm.unit.trim(),
          unitPrice: price,
          note: itemForm.note,
          sortOrder: itemForm.sortOrder,
        },
      });
      setItemForm(null);
      await refresh();
      toast.success("項目を保存しました");
    } catch (e: any) {
      toast.error(e?.message ?? "項目を保存できませんでした");
    }
  };
  const hideSelectedCategory = async (row: Category) => {
    if (
      !window.confirm(
        `「${row.name}」を非表示にしますか？中の項目は削除されず、既存の見積も変わりません。`
      )
    )
      return;
    try {
      await hideCategory.mutateAsync({
        id: row.id,
        expectedUpdatedAt: row.updatedAt,
      });
      await refresh();
      toast.success("分類を非表示にしました");
    } catch (e: any) {
      toast.error(e?.message ?? "分類を非表示にできませんでした");
    }
  };
  const hideSelectedItem = async (row: Item) => {
    if (
      !window.confirm(
        `「${row.name}」をメニューから非表示にしますか？既存の見積明細は変わりません。`
      )
    )
      return;
    try {
      await hideItem.mutateAsync({
        id: row.id,
        expectedUpdatedAt: row.updatedAt,
      });
      await refresh();
      toast.success("項目を非表示にしました");
    } catch (e: any) {
      toast.error(e?.message ?? "項目を非表示にできませんでした");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>定型メニューから選ぶ</CardTitle>
          <p className="text-sm text-slate-600">
            ブラインド・GT関連・捕虫器・はいはい店番を分類別に表示。単価は任意登録で、標準施工単価とは連動しません。追加時の数量は空欄です。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {catalog.isLoading ? (
            <p className="text-sm">定型メニューを読み込み中...</p>
          ) : catalog.error ? (
            <p className="text-sm text-red-700">
              メニューを読み込めません: {catalog.error.message}
            </p>
          ) : (
            <>
              <div
                className="grid gap-2 sm:grid-cols-2"
                aria-label="定型見積の分類"
              >
                {catalog.data?.map(row => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setCategoryId(row.id)}
                    className={`min-h-16 rounded-lg border p-3 text-left text-sm font-semibold transition-colors ${selected?.id === row.id ? "border-[#17304c] bg-slate-100 text-[#17304c]" : "border-slate-200 bg-white hover:border-slate-400"}`}
                  >
                    {row.name}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {row.items.length}項目
                    </span>
                  </button>
                ))}
              </div>
              {canModify && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCategoryForm({
                      name: "",
                      sortOrder: (catalog.data?.length ?? 0) + 1,
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  分類を追加
                </Button>
              )}
              {selected && (
                <section
                  className="space-y-3 rounded-lg border bg-slate-50/50 p-4"
                  aria-label={`${selected.name}の項目`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="mr-auto font-semibold">{selected.name}</h3>
                    {canModify && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCategoryForm({
                              id: selected.id,
                              expectedUpdatedAt: selected.updatedAt,
                              name: selected.name,
                              sortOrder: selected.sortOrder,
                            })
                          }
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          分類を編集
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void hideSelectedCategory(selected)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          非表示
                        </Button>
                      </>
                    )}
                  </div>
                  {selected.id === "blind" && (
                    <Button variant="outline" size="sm" onClick={onForetia}>
                      <Calculator className="mr-1 h-4 w-4" />
                      フォレティア50の寸法別参考価格を計算
                    </Button>
                  )}
                  {!selected.items.length && (
                    <p className="text-sm text-slate-500">
                      この分類にはまだ項目がありません。
                    </p>
                  )}
                  {selected.items.map(item => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3 text-sm"
                    >
                      <div className="min-w-[170px] flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-slate-600">
                          {item.specification || "規格未登録"}／{item.unit}／
                          {item.unitPrice === null
                            ? "単価は自由入力"
                            : `設定単価 ¥${item.unitPrice.toLocaleString("ja-JP")}`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={!canModify || !canAdd}
                        onClick={() => addPreset(item)}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        明細に追加
                      </Button>
                      {canModify && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setItemForm({
                                id: item.id,
                                expectedUpdatedAt: item.updatedAt,
                                categoryId: item.categoryId,
                                name: item.name,
                                specification: item.specification,
                                unit: item.unit,
                                unitPrice: item.unitPrice?.toString() ?? "",
                                note: item.note ?? "",
                                sortOrder: item.sortOrder,
                              })
                            }
                          >
                            編集
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`${item.name}を非表示`}
                            disabled={busy}
                            onClick={() => void hideSelectedItem(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                  {canModify && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setItemForm({
                          categoryId: selected.id,
                          name: "",
                          specification: "",
                          unit: "式",
                          unitPrice: "",
                          note: "",
                          sortOrder: selected.items.length + 1,
                        })
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      この分類に項目を追加
                    </Button>
                  )}
                </section>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={categoryForm !== null}
        onOpenChange={open => {
          if (!open) setCategoryForm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>定型メニューの分類</DialogTitle>
          </DialogHeader>
          {categoryForm && (
            <div className="space-y-3">
              <label className="block text-sm">
                分類名
                <Input
                  className="mt-1"
                  value={categoryForm.name}
                  maxLength={120}
                  onChange={e =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                表示順
                <Input
                  className="mt-1"
                  type="number"
                  min="0"
                  value={categoryForm.sortOrder}
                  onChange={e =>
                    setCategoryForm({
                      ...categoryForm,
                      sortOrder: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryForm(null)}>
              キャンセル
            </Button>
            <Button
              disabled={busy || !categoryForm?.name.trim()}
              onClick={() => void submitCategory()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={itemForm !== null}
        onOpenChange={open => {
          if (!open) setItemForm(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>定型メニューの項目</DialogTitle>
          </DialogHeader>
          {itemForm && (
            <div className="space-y-3 text-sm">
              <label className="block">
                分類
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-white px-2"
                  value={itemForm.categoryId}
                  onChange={e =>
                    setItemForm({ ...itemForm, categoryId: e.target.value })
                  }
                >
                  {catalog.data?.map(row => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                項目名
                <Input
                  className="mt-1"
                  value={itemForm.name}
                  maxLength={255}
                  onChange={e =>
                    setItemForm({ ...itemForm, name: e.target.value })
                  }
                />
              </label>
              <label className="block">
                規格・型番（任意）
                <Input
                  className="mt-1"
                  value={itemForm.specification}
                  maxLength={255}
                  onChange={e =>
                    setItemForm({ ...itemForm, specification: e.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  単位
                  <Input
                    className="mt-1"
                    value={itemForm.unit}
                    maxLength={30}
                    onChange={e =>
                      setItemForm({ ...itemForm, unit: e.target.value })
                    }
                  />
                </label>
                <label>
                  税抜単価（任意）
                  <Input
                    className="mt-1"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="未設定"
                    value={itemForm.unitPrice}
                    onChange={e =>
                      setItemForm({ ...itemForm, unitPrice: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="block">
                補足・現場条件（任意）
                <Input
                  className="mt-1"
                  value={itemForm.note}
                  maxLength={1200}
                  onChange={e =>
                    setItemForm({ ...itemForm, note: e.target.value })
                  }
                />
              </label>
              <label className="block">
                表示順
                <Input
                  className="mt-1"
                  type="number"
                  min="0"
                  value={itemForm.sortOrder}
                  onChange={e =>
                    setItemForm({
                      ...itemForm,
                      sortOrder: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemForm(null)}>
              キャンセル
            </Button>
            <Button
              disabled={
                busy || !itemForm?.name.trim() || !itemForm?.unit.trim()
              }
              onClick={() => void submitItem()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
