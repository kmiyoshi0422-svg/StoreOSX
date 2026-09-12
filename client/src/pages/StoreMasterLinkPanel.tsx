import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import type { Case } from "../../../drizzle/schema";
import { Building2, Link2, Loader2, Plus, Search, Unlink } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function StoreMasterLinkPanel({
  caseId,
  currentStoreId,
  caseStoreName,
  caseStoreCode,
  caseBrand,
  casePrefecture,
  caseAddress,
  casePhone,
  caseBusinessHours,
  onUpdated,
  onOpenHistory,
  onUnlinked,
}: {
  caseId: number;
  currentStoreId: number | null;
  caseStoreName: string;
  caseStoreCode: string | null;
  caseBrand: Case["brand"];
  casePrefecture: string | null;
  caseAddress: string | null;
  casePhone: string | null;
  caseBusinessHours: string | null;
  onUpdated: () => void | Promise<unknown>;
  onOpenHistory: () => void;
  onUnlinked: () => void;
}) {
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(caseStoreCode || caseStoreName);
  const { data: stores = [], isLoading, error } = trpc.storeMaster.list.useQuery(undefined, {
    enabled: dialogOpen || currentStoreId != null,
  });

  const currentStore = useMemo(
    () => stores.find((store) => store.id === currentStoreId),
    [stores, currentStoreId]
  );

  const filteredStores = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ja");
    const candidates = query
      ? stores.filter((store) =>
          [store.storeCode, store.storeName, store.brand, store.prefecture, store.address]
            .filter(Boolean)
            .some((value) => String(value).toLocaleLowerCase("ja").includes(query))
        )
      : stores;

    return [...candidates]
      .sort((a, b) => {
        const score = (store: (typeof stores)[number]) => {
          if (caseStoreCode && store.storeCode === caseStoreCode) return 0;
          if (store.storeName === caseStoreName) return 1;
          if (store.brand === caseBrand) return 2;
          return 3;
        };
        return score(a) - score(b) || a.storeName.localeCompare(b.storeName, "ja");
      })
      .slice(0, 30);
  }, [caseBrand, caseStoreCode, caseStoreName, searchQuery, stores]);

  const linkMutation = trpc.cases.update.useMutation({
    onSuccess: async (_result, variables) => {
      await Promise.resolve(onUpdated());
      const linkedStoreId = variables.data.storeId;
      if (typeof linkedStoreId === "number") {
        await Promise.all([
          utils.storeMaster.get.invalidate({ id: linkedStoreId }),
          utils.storeMaster.pastCases.invalidate({ storeId: linkedStoreId }),
          utils.storeMaster.pastPhotos.invalidate({ storeId: linkedStoreId }),
        ]);
        toast.success("案件を店舗マスタに紐付けました");
        onOpenHistory();
      } else {
        toast.success("店舗マスタとの紐付けを解除しました");
        onUnlinked();
      }
      setDialogOpen(false);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const exactMatchExists = stores.some(
    (store) =>
      (!!caseStoreCode && store.storeCode === caseStoreCode) ||
      (store.storeName === caseStoreName && store.brand === caseBrand)
  );

  const createStoreMutation = trpc.storeMaster.create.useMutation({
    onSuccess: async ({ id: createdStoreId }) => {
      await utils.storeMaster.list.invalidate();
      linkMutation.mutate({ id: caseId, data: { storeId: createdStoreId } });
    },
    onError: (mutationError) => toast.error(`店舗マスタを作成できませんでした: ${mutationError.message}`),
  });

  const isSaving = linkMutation.isPending || createStoreMutation.isPending;

  const createStoreFromCase = () => {
    createStoreMutation.mutate({
      storeCode: caseStoreCode,
      storeName: caseStoreName,
      brand: caseBrand,
      prefecture: casePrefecture,
      address: caseAddress,
      phone: casePhone,
      businessHours: caseBusinessHours,
    });
  };

  return (
    <Card className={currentStoreId ? "border-emerald-200 bg-emerald-50/30" : "border-amber-300 bg-amber-50/50"}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`mt-0.5 rounded-lg p-2 ${currentStoreId ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">
                  {currentStoreId ? "店舗マスタ連携済み" : "店舗マスタが未設定です"}
                </h2>
                {currentStore?.storeCode && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {currentStore.storeCode}
                  </Badge>
                )}
              </div>
              {currentStoreId ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {isLoading ? "店舗情報を確認中…" : currentStore ? `${currentStore.brand} / ${currentStore.storeName}` : `店舗ID: ${currentStoreId}`}
                </p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  店舗を紐付けると、過去案件・写真・設備台帳を店舗単位で確認できます。
                </p>
              )}
              {error && <p className="mt-1 text-xs text-destructive">店舗マスタを取得できませんでした: {error.message}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {currentStoreId && (
              <Button size="sm" variant="outline" onClick={onOpenHistory}>
                <Building2 className="h-3.5 w-3.5" />
                店舗履歴を開く
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setSearchQuery(caseStoreCode || caseStoreName);
                setDialogOpen(true);
              }}
            >
              <Link2 className="h-3.5 w-3.5" />
              {currentStoreId ? "店舗を変更" : "店舗を紐付け"}
            </Button>
            {currentStoreId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-muted-foreground">
                    <Unlink className="h-3.5 w-3.5" />
                    解除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>店舗マスタとの紐付けを解除しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      案件自体は削除されません。解除後は店舗履歴と設備台帳が表示されなくなります。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => linkMutation.mutate({ id: caseId, data: { storeId: null } })}
                      disabled={isSaving}
                    >
                      解除する
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>店舗マスタを選択</DialogTitle>
            <DialogDescription>
              店舗コード、店舗名、ブランド、住所で検索できます。案件の店舗名に近い候補を優先表示します。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="店舗コード・店舗名・住所を入力"
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  店舗マスタを読み込み中…
                </div>
              ) : filteredStores.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm font-medium">一致する店舗がありません</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    検索条件を変更するか、下のボタンから新規登録してください。
                  </p>
                </div>
              ) : (
                filteredStores.map((store) => {
                  const isCurrent = store.id === currentStoreId;
                  const isExactMatch =
                    (!!caseStoreCode && store.storeCode === caseStoreCode) || store.storeName === caseStoreName;
                  return (
                    <button
                      key={store.id}
                      type="button"
                      className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => linkMutation.mutate({ id: caseId, data: { storeId: store.id } })}
                      disabled={isSaving || isCurrent}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold">{store.storeName}</span>
                            <Badge variant="secondary" className="text-[10px]">{store.brand}</Badge>
                            {isExactMatch && <Badge className="text-[10px]">候補</Badge>}
                            {isCurrent && <Badge variant="outline" className="text-[10px]">現在の店舗</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {store.storeCode ? `店舗コード: ${store.storeCode}` : "店舗コード未設定"}
                            {store.prefecture ? ` / ${store.prefecture}` : ""}
                          </p>
                          {store.address && <p className="mt-1 truncate text-xs text-muted-foreground">{store.address}</p>}
                        </div>
                        {isSaving && !isCurrent && <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {!isLoading && !error && !exactMatchExists && (
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">この案件の店舗をマスタへ新規登録</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {caseBrand} / {caseStoreName}
                      {caseStoreCode ? ` / 店舗コード: ${caseStoreCode}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      案件に登録済みの住所・電話番号・営業時間も引き継ぎます。
                    </p>
                  </div>
                  <Button onClick={createStoreFromCase} disabled={isSaving} className="shrink-0">
                    {createStoreMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    新規登録して紐付け
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              キャンセル
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
