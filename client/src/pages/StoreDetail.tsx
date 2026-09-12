import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { StoreEquipmentPanel } from "./StoreEquipmentPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Camera,
  ExternalLink,
  FileText,
  FolderClock,
  KeyRound,
  Loader2,
  MapPin,
  NotebookTabs,
  Phone,
  Save,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

type StoreDetailProps = {
  id: number;
};

type StoreFormState = {
  storeCode: string;
  storeName: string;
  brand: "ほっともっと" | "やよい軒" | "その他";
  prefecture: string;
  address: string;
  phone: string;
  businessHours: string;
  floorPlanUrl: string;
  equipmentNotes: string;
  accessNotes: string;
  keyNotes: string;
};

const EMPTY_FORM: StoreFormState = {
  storeCode: "",
  storeName: "",
  brand: "ほっともっと",
  prefecture: "",
  address: "",
  phone: "",
  businessHours: "",
  floorPlanUrl: "",
  equipmentNotes: "",
  accessNotes: "",
  keyNotes: "",
};

function toForm(store: any): StoreFormState {
  return {
    storeCode: store?.storeCode ?? "",
    storeName: store?.storeName ?? "",
    brand: store?.brand ?? "ほっともっと",
    prefecture: store?.prefecture ?? "",
    address: store?.address ?? "",
    phone: store?.phone ?? "",
    businessHours: store?.businessHours ?? "",
    floorPlanUrl: store?.floorPlanUrl ?? "",
    equipmentNotes: store?.equipmentNotes ?? "",
    accessNotes: store?.accessNotes ?? "",
    keyNotes: store?.keyNotes ?? "",
  };
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function StoreDetail({ id }: StoreDetailProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("basic");
  const [form, setForm] = useState<StoreFormState>(EMPTY_FORM);
  const utils = trpc.useUtils();

  const {
    data: store,
    isLoading,
    error,
  } = trpc.storeMaster.get.useQuery({ id }, { enabled: Number.isFinite(id) && id > 0 });

  useEffect(() => {
    if (store) setForm(toForm(store));
  }, [store]);

  const updateMutation = trpc.storeMaster.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.storeMaster.get.invalidate({ id }),
        utils.storeMaster.list.invalidate(),
      ]);
      toast.success("店舗情報を保存しました");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const linkMatchingCasesMutation = trpc.storeMaster.linkMatchingCases.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.storeMaster.pastCases.invalidate({ storeId: id }),
        utils.storeMaster.pastDocuments.invalidate({ storeId: id }),
        utils.storeMaster.pastPhotos.invalidate(),
        utils.stores.list.invalidate(),
      ]);
      setActiveTab("history");
      toast.success("店舗コード・店舗名が一致する過去案件を再照合しました");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const historyEnabled = activeTab === "history";
  const { data: pastCases = [], isLoading: casesLoading } =
    trpc.storeMaster.pastCases.useQuery({ storeId: id }, { enabled: historyEnabled });
  const { data: pastDocuments = [], isLoading: documentsLoading } =
    trpc.storeMaster.pastDocuments.useQuery({ storeId: id }, { enabled: historyEnabled });
  const { data: pastPhotos = [], isLoading: photosLoading } =
    trpc.storeMaster.pastPhotos.useQuery(
      { storeId: id, limit: 30 },
      { enabled: historyEnabled },
    );

  const setField = <K extends keyof StoreFormState>(key: K, value: StoreFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveFields = (keys: Array<keyof StoreFormState>) => {
    if (!form.storeName.trim()) {
      toast.error("店舗名を入力してください");
      return;
    }

    const data: Record<string, string | null> = {};
    for (const key of keys) {
      const value = form[key];
      data[key] = typeof value === "string" && value.trim() === "" ? null : value;
    }

    updateMutation.mutate({
      id,
      ...(data as Partial<StoreFormState>),
      ...(keys.includes("storeName") ? { storeName: form.storeName.trim() } : {}),
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !store) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">店舗情報を読み込めませんでした</p>
          <p className="text-sm text-muted-foreground">
            {error?.message ?? "店舗マスタが存在しない可能性があります。"}
          </p>
          <Button variant="outline" onClick={() => setLocation("/stores")}>店舗一覧へ戻る</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={() => setLocation("/stores")}>
            <ArrowLeft className="mr-1 h-4 w-4" />店舗一覧へ
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">{store.storeName}</h1>
            {store.storeCode && <Badge variant="outline" className="font-mono">{store.storeCode}</Badge>}
            <Badge variant="secondary">{store.brand}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {store.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{store.address}</span>}
            {store.phone && <a className="flex items-center gap-1 hover:text-primary" href={`tel:${store.phone}`}><Phone className="h-3.5 w-3.5" />{store.phone}</a>}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button
            size="sm"
            variant="outline"
            disabled={linkMatchingCasesMutation.isPending}
            onClick={() => linkMatchingCasesMutation.mutate({ id })}
          >
            {linkMatchingCasesMutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FolderClock className="mr-1.5 h-4 w-4" />
            )}
            過去案件・資料を再照合
          </Button>
          <div className="grid grid-cols-3 gap-2 text-center">
            <SummaryStat label="案件" value={store.totalCaseCount ?? pastCases.length} />
            <SummaryStat label="現調" value={store.totalSurveyCount ?? 0} />
            <SummaryStat label="写真" value={store.totalPhotoCount ?? 0} />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4">
          <TabsTrigger value="basic" className="py-2">
            <Building2 className="mr-1.5 h-4 w-4" />基本情報
          </TabsTrigger>
          <TabsTrigger value="notes" className="py-2">
            <NotebookTabs className="mr-1.5 h-4 w-4" />店舗固有情報
          </TabsTrigger>
          <TabsTrigger value="history" className="py-2">
            <FolderClock className="mr-1.5 h-4 w-4" />過去案件・資料
          </TabsTrigger>
          <TabsTrigger value="equipment" className="py-2">
            <Settings2 className="mr-1.5 h-4 w-4" />設備台帳
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">店舗基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="店舗コード"><Input value={form.storeCode} onChange={(e) => setField("storeCode", e.target.value)} /></FormField>
                <FormField label="店舗名 *"><Input value={form.storeName} onChange={(e) => setField("storeName", e.target.value)} /></FormField>
                <FormField label="ブランド">
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.brand} onChange={(e) => setField("brand", e.target.value as StoreFormState["brand"])}>
                    <option value="ほっともっと">ほっともっと</option>
                    <option value="やよい軒">やよい軒</option>
                    <option value="その他">その他</option>
                  </select>
                </FormField>
                <FormField label="都道府県"><Input value={form.prefecture} onChange={(e) => setField("prefecture", e.target.value)} /></FormField>
                <FormField label="電話番号"><Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></FormField>
                <FormField label="営業時間"><Input value={form.businessHours} onChange={(e) => setField("businessHours", e.target.value)} placeholder="例：10:00〜22:00" /></FormField>
              </div>
              <FormField label="住所"><Input value={form.address} onChange={(e) => setField("address", e.target.value)} /></FormField>
              <div className="flex justify-end">
                <Button disabled={updateMutation.isPending} onClick={() => saveFields(["storeCode", "storeName", "brand", "prefecture", "address", "phone", "businessHours"])}>
                  {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  基本情報を保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">店舗固有情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="平面図・図面URL"><Input value={form.floorPlanUrl} onChange={(e) => setField("floorPlanUrl", e.target.value)} placeholder="https://..." /></FormField>
              <FormField label="設備メモ"><Textarea rows={4} value={form.equipmentNotes} onChange={(e) => setField("equipmentNotes", e.target.value)} placeholder="設備の仕様、型番、注意点など" /></FormField>
              <FormField label="搬入・アクセス情報"><Textarea rows={4} value={form.accessNotes} onChange={(e) => setField("accessNotes", e.target.value)} placeholder="駐車位置、搬入口、作業可能時間など" /></FormField>
              <FormField label="鍵・入館情報"><Textarea rows={4} value={form.keyNotes} onChange={(e) => setField("keyNotes", e.target.value)} placeholder="鍵の受け渡し、警備解除、入館手順など" /></FormField>
              <div className="flex justify-end">
                <Button disabled={updateMutation.isPending} onClick={() => saveFields(["floorPlanUrl", "equipmentNotes", "accessNotes", "keyNotes"])}>
                  {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  店舗固有情報を保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <HistorySection
            isLoading={casesLoading || documentsLoading || photosLoading}
            cases={pastCases}
            documents={pastDocuments}
            photos={pastPhotos}
            onOpenCase={(caseId) => setLocation(`/cases/${caseId}`)}
          />
        </TabsContent>

        <TabsContent value="equipment" className="mt-4">
          <StoreEquipmentPanel storeId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-lg border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-serif-jp text-xl font-semibold">{value}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function HistorySection({
  isLoading,
  cases,
  documents,
  photos,
  onOpenCase,
}: {
  isLoading: boolean;
  cases: any[];
  documents: any[];
  photos: any[];
  onOpenCase: (caseId: number) => void;
}) {
  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarClock className="h-5 w-5" />過去案件 <Badge variant="secondary">{cases.length}</Badge></CardTitle></CardHeader>
        <CardContent>
          {cases.length === 0 ? <EmptyState text="紐付け済みの過去案件はありません" /> : (
            <div className="space-y-2">
              {cases.map((item) => (
                <button key={item.id} type="button" className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50" onClick={() => onOpenCase(item.id)}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title || item.requestNumber || `案件 #${item.id}`}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.requestNumber ? `#${item.requestNumber} · ` : ""}{formatDate(item.requestDate ?? item.createdAt)}</p>
                  </div>
                  <Badge variant="outline">{item.status}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5" />過去資料 <Badge variant="secondary">{documents.length}</Badge></CardTitle></CardHeader>
        <CardContent>
          {documents.length === 0 ? <EmptyState text="この店舗の過去資料はありません" /> : (
            <div className="space-y-2">
              {documents.map((document) => (
                <div key={document.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{document.fileName}</p>
                    <p className="text-xs text-muted-foreground">{document.category} · {document.requestNumber || "案件番号なし"} · {formatDate(document.createdAt)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => window.open(document.fileUrl, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />開く
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Camera className="h-5 w-5" />過去写真 <Badge variant="secondary">{photos.length}</Badge></CardTitle></CardHeader>
        <CardContent>
          {photos.length === 0 ? <EmptyState text="この店舗の過去写真はありません" /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {photos.map((photo) => (
                <button key={photo.id} type="button" className="group overflow-hidden rounded-lg border bg-muted text-left" onClick={() => window.open(photo.fileUrl, "_blank", "noopener,noreferrer")}>
                  <img src={photo.fileUrl} alt={photo.memo || photo.photoType || "店舗の過去写真"} loading="lazy" className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]" />
                  <div className="p-2">
                    <p className="truncate text-[11px] font-medium">{photo.photoType || "写真"}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{formatDate(photo.takenAt ?? photo.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
      <KeyRound className="h-8 w-8 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
