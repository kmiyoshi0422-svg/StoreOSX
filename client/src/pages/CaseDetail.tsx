import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Trash2,
  FileText,
  ImageIcon,
  ListChecks,
  Info,
  Loader2,
  Phone,
  MapPin,
  Save,
  Download,
  Wallet,
  Users,
  Camera,
} from "lucide-react";
import { generateQuotePDF, generateCompletionReportPDF } from "@/lib/documentPdf";
import {
  CATEGORY_LARGE_OPTIONS,
  CATEGORY_MEDIUM_OPTIONS,
} from "../../../shared/checklist-template";
import type { Case, ChecklistItem, Photo } from "../../../drizzle/schema";

const STATUS_COLORS: Record<string, string> = {
  受付: "bg-slate-100 text-slate-700 border-slate-200",
  現調中: "bg-amber-50 text-amber-700 border-amber-200",
  見積中: "bg-blue-50 text-blue-700 border-blue-200",
  施工待ち: "bg-purple-50 text-purple-700 border-purple-200",
  施工中: "bg-orange-50 text-orange-700 border-orange-200",
  完了: "bg-emerald-50 text-emerald-700 border-emerald-200",
  クローズ: "bg-zinc-100 text-zinc-600 border-zinc-200",
};
const URGENCY_COLORS: Record<string, string> = {
  S: "bg-red-600 text-white",
  A: "bg-orange-500 text-white",
  B: "bg-yellow-500 text-white",
  C: "bg-emerald-500 text-white",
};
const URGENCY_LABEL: Record<string, string> = { S: "緊急", A: "高", B: "中", C: "低" };

const PHOTO_TYPES = [
  "施工前A",
  "施工前B",
  "施工後A",
  "施工後B",
  "設置状況",
  "メーカー型番",
  "現調",
  "その他",
] as const;

export default function CaseDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: caseData, isLoading } = trpc.cases.get.useQuery({ id });
  const { data: checklist = [] } = trpc.checklist.listByCase.useQuery({ caseId: id });
  const { data: photos = [] } = trpc.photos.listByCase.useQuery({ caseId: id });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!caseData) {
    return <div className="text-center py-12 text-muted-foreground">案件が見つかりません</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border/60 pb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/cases")}
          className="-ml-2 mb-3 h-7 text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          案件一覧へ
        </Button>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded text-[10px] font-bold ${URGENCY_COLORS[caseData.urgency]}`}
              >
                {URGENCY_LABEL[caseData.urgency]}
              </span>
              <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[caseData.status]}`}>
                {caseData.status}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {caseData.brand}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                {caseData.requestNumber}
              </span>
            </div>
            <h1 className="font-serif-jp text-2xl md:text-3xl font-semibold tracking-tight">
              {caseData.storeName}
            </h1>
            <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {caseData.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {caseData.address}
                </span>
              )}
              {caseData.storePhone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {caseData.storePhone}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateQuotePDF(caseData)}
            >
              <Download className="h-4 w-4" />
              見積書
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateCompletionReportPDF(caseData)}
              disabled={caseData.status !== "完了"}
            >
              <Download className="h-4 w-4" />
              完了報告書
            </Button>
            <Button onClick={() => setLocation(`/cases/${id}/ledger`)} size="sm">
              <FileText className="h-4 w-4" />
              写真台帳
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full md:w-auto md:inline-grid">
          <TabsTrigger value="info">
            <Info className="h-3.5 w-3.5" />
            基本情報
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ListChecks className="h-3.5 w-3.5" />
            チェックリスト
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-4">
              {checklist.filter((i) => i.checked).length}/{checklist.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="photos">
            <ImageIcon className="h-3.5 w-3.5" />
            写真
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-4">
              {photos.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <InfoTab caseData={caseData} onUpdated={() => utils.cases.get.invalidate({ id })} />
        </TabsContent>

        <TabsContent value="checklist">
          <ChecklistTab
            caseId={id}
            items={checklist}
            onUpdated={() => utils.checklist.listByCase.invalidate({ caseId: id })}
          />
        </TabsContent>

        <TabsContent value="photos">
          <PhotosTab
            caseId={id}
            photos={photos}
            onUpdated={() => utils.photos.listByCase.invalidate({ caseId: id })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Info Tab
// ============================================================
function InfoTab({
  caseData,
  onUpdated,
}: {
  caseData: Case;
  onUpdated: () => void;
}) {
  const updateMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("更新しました");
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.cases.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      window.location.href = "/cases";
    },
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status: caseData.status,
    urgency: caseData.urgency,
    requestContent: caseData.requestContent ?? "",
    categoryLarge: caseData.categoryLarge ?? "",
    categoryMedium: caseData.categoryMedium ?? "",
    categorySmall: caseData.categorySmall ?? "",
    contractorName: caseData.contractorName ?? "",
    contractorPic: caseData.contractorPic ?? "",
    contractorPhone: caseData.contractorPhone ?? "",
    estimatedCost: caseData.estimatedCost ?? 0,
    notes: caseData.notes ?? "",
  });

  const mediumOptions =
    form.categoryLarge && CATEGORY_MEDIUM_OPTIONS[form.categoryLarge]
      ? CATEGORY_MEDIUM_OPTIONS[form.categoryLarge]
      : [];

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: caseData.id,
        data: {
          ...form,
          categoryLarge: form.categoryLarge || null,
          categoryMedium: form.categoryMedium || null,
          categorySmall: form.categorySmall || null,
          estimatedCost: form.estimatedCost || null,
          is10mYen: form.estimatedCost >= 100000,
        },
      },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-jp font-semibold">案件情報</h3>
            {!editing ? (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                編集
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="h-3.5 w-3.5" />
                  保存
                </Button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">ステータス</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((p) => ({ ...p, status: v as never }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="受付">受付</SelectItem>
                      <SelectItem value="現調中">現調中</SelectItem>
                      <SelectItem value="見積中">見積中</SelectItem>
                      <SelectItem value="施工待ち">施工待ち</SelectItem>
                      <SelectItem value="施工中">施工中</SelectItem>
                      <SelectItem value="完了">完了</SelectItem>
                      <SelectItem value="クローズ">クローズ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">緊急度</Label>
                  <Select
                    value={form.urgency}
                    onValueChange={(v) => setForm((p) => ({ ...p, urgency: v as never }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S">S 緊急</SelectItem>
                      <SelectItem value="A">A 高</SelectItem>
                      <SelectItem value="B">B 中</SelectItem>
                      <SelectItem value="C">C 低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">依頼内容</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={form.requestContent}
                  onChange={(e) => setForm((p) => ({ ...p, requestContent: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">大項目</Label>
                  <Select
                    value={form.categoryLarge || "__none__"}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        categoryLarge: v === "__none__" ? "" : v,
                        categoryMedium: "",
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">未選択</SelectItem>
                      {CATEGORY_LARGE_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">中項目</Label>
                  <Select
                    value={form.categoryMedium || "__none__"}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        categoryMedium: v === "__none__" ? "" : v,
                      }))
                    }
                    disabled={!form.categoryLarge}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">未選択</SelectItem>
                      {mediumOptions.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">小項目</Label>
                  <Input
                    className="mt-1"
                    value={form.categorySmall}
                    onChange={(e) => setForm((p) => ({ ...p, categorySmall: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">見積金額（円）</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={form.estimatedCost}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, estimatedCost: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">備考</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <Row label="作業区分" value={caseData.workType ?? "—"} />
              <Row label="費用負担" value={caseData.costBearer ?? "—"} />
              <Row
                label="工事種別"
                value={`${caseData.categoryLarge || "—"} / ${caseData.categoryMedium || "—"} / ${caseData.categorySmall || "—"}`}
              />
              <Row label="依頼者" value={caseData.requesterName || "—"} />
              <Row label="依頼者連絡先" value={caseData.requesterPhone || "—"} />
              <Row
                label="見積金額"
                value={
                  caseData.estimatedCost
                    ? `¥${caseData.estimatedCost.toLocaleString()}`
                    : "—"
                }
              />
              <Row label="依頼内容" value={caseData.requestContent || "—"} multiline />
              <Row label="備考" value={caseData.notes || "—"} multiline />
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-jp font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              社内担当者
            </h3>
          </div>
          <AssigneeSelect
            caseId={caseData.id}
            currentAssigneeId={caseData.assigneeId ?? null}
            onUpdated={onUpdated}
          />
          <div className="border-t pt-4" />
          <h3 className="font-serif-jp font-semibold">取引先・店舗</h3>
          <dl className="space-y-2 text-sm">
            <Row label="協力会社" value={caseData.contractorName || "—"} />
            <Row label="担当者" value={caseData.contractorPic || "—"} />
            <Row label="連絡先" value={caseData.contractorPhone || "—"} />
            <Row label="店舗コード" value={caseData.storeCode || "—"} />
            <Row label="SHOP-ID" value={caseData.shopId || "—"} />
            <Row label="営業時間" value={caseData.businessHours || "—"} />
            <Row
              label="作成日時"
              value={new Date(caseData.createdAt).toLocaleString("ja-JP")}
            />
          </dl>
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("この案件を削除します。よろしいですか？")) {
                  deleteMutation.mutate({ id: caseData.id });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              案件を削除
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 社内担当者選択コンポーネント
function AssigneeSelect({
  caseId,
  currentAssigneeId,
  onUpdated,
}: {
  caseId: number;
  currentAssigneeId: number | null;
  onUpdated: () => void;
}) {
  const { data: users = [] } = trpc.users.list.useQuery();
  const updateMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("担当者を更新しました");
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentAssigneeId ? String(currentAssigneeId) : "__none__"}
        onValueChange={(v) => {
          updateMutation.mutate({
            id: caseId,
            data: { assigneeId: v === "__none__" ? null : Number(v) },
          });
        }}
        disabled={updateMutation.isPending}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="担当者を選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">未割当</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={String(u.id)}>
              {u.name || u.email || `User #${u.id}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "" : "flex justify-between gap-3"}>
      <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
      <dd
        className={`text-sm ${multiline ? "mt-1 whitespace-pre-wrap" : "text-right truncate"}`}
      >
        {value}
      </dd>
    </div>
  );
}

// ============================================================
// Checklist Tab
// ============================================================
function ChecklistTab({
  caseId: _caseId,
  items,
  onUpdated,
}: {
  caseId: number;
  items: ChecklistItem[];
  onUpdated: () => void;
}) {
  const toggleMutation = trpc.checklist.toggle.useMutation({
    onSuccess: (res) => {
      if (res?.autoAdvanced) {
        toast.success(`ステータスを「${res.autoAdvanced.from}」→「${res.autoAdvanced.to}」に自動更新しました`);
      }
      onUpdated();
    },
  });
  const memoMutation = trpc.checklist.updateMemo.useMutation({ onSuccess: onUpdated });

  const phases = ["受付", "現調", "施工", "完了"] as const;

  const grouped = useMemo(() => {
    return phases.map((phase) => ({
      phase,
      items: items.filter((i) => i.phase === phase),
    }));
  }, [items]);

  return (
    <div className="space-y-4">
      {grouped.map(({ phase, items: phaseItems }) => {
        const done = phaseItems.filter((i) => i.checked).length;
        const total = phaseItems.length;
        const pct = total > 0 ? (done / total) * 100 : 0;
        return (
          <Card key={phase}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-serif-jp font-semibold text-lg">{phase}</h3>
                  <span className="text-xs text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>
                <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                {phaseItems.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    onToggle={(checked) =>
                      toggleMutation.mutate({ id: item.id, checked })
                    }
                    onMemo={(memo) => memoMutation.mutate({ id: item.id, memo })}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ChecklistRow({
  item,
  onToggle,
  onMemo,
}: {
  item: {
    id: number;
    title: string;
    description: string | null;
    checked: boolean;
    memo: string | null;
  };
  onToggle: (checked: boolean) => void;
  onMemo: (memo: string) => void;
}) {
  const [memo, setMemo] = useState(item.memo ?? "");
  const [showMemo, setShowMemo] = useState(false);

  return (
    <div
      className={`rounded-md border border-transparent hover:border-border/60 hover:bg-muted/30 transition-colors p-2 -mx-2 ${item.checked ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={item.checked}
          onCheckedChange={(v) => onToggle(Boolean(v))}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${item.checked ? "line-through text-muted-foreground" : ""}`}
          >
            {item.title}
          </p>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => setShowMemo((v) => !v)}
        >
          {showMemo ? "閉じる" : "メモ"}
        </Button>
      </div>
      {showMemo && (
        <div className="mt-2 ml-7">
          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={() => {
              if (memo !== (item.memo ?? "")) onMemo(memo);
            }}
            rows={2}
            placeholder="メモを入力..."
            className="text-xs"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Photos Tab
// ============================================================
function PhotosTab({
  caseId,
  photos,
  onUpdated,
}: {
  caseId: number;
  photos: Photo[];
  onUpdated: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  type CamTag = "現調" | "施工前A" | "施工前B" | "施工後A" | "施工後B" | "設置状況" | "メーカー型番";
  const [cameraPhotoType, setCameraPhotoType] = useState<CamTag>("施工前A");

  const uploadMutation = trpc.photos.upload.useMutation();
  const updateMutation = trpc.photos.update.useMutation({ onSuccess: onUpdated });
  const deleteMutation = trpc.photos.delete.useMutation({ onSuccess: onUpdated });

  const handleFiles = async (files: FileList | null, photoType: CamTag = "現調") => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await uploadMutation.mutateAsync({
          caseId,
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type || "image/jpeg",
          photoType,
        });
      }
      toast.success(`${files.length}枚を「${photoType}」としてアップロードしました`);
      onUpdated();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "アップロード失敗";
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Camera + Upload */}
      <Card className="border-dashed">
        <CardContent className="p-5 space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files, "現調")}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => handleFiles(e.target.files, cameraPhotoType)}
          />
          <div>
            <p className="font-medium text-sm">現場直撮りモード（スマホ推奨）</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              撮影タグを選んでカメラを起動 → 撮影した写真は自動でタグ付けされて保存されます
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(["現調", "施工前A", "施工前B", "施工後A", "施工後B", "設置状況", "メーカー型番"] as const).map((t) => (
              <Button
                key={t}
                variant={cameraPhotoType === t ? "default" : "outline"}
                size="sm"
                onClick={() => setCameraPhotoType(t)}
                className={cameraPhotoType === t ? "" : "bg-background"}
                disabled={uploading}
              >
                {t}
              </Button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              variant="default"
              className="flex-1"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {uploading ? "アップロード中..." : `「${cameraPhotoType}」をカメラで撮影`}
            </Button>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              variant="outline"
              className="bg-background sm:w-40"
            >
              <Upload className="h-4 w-4" />
              アルバムから選択
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      {photos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">まだ写真がありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              onUpdate={(data) => updateMutation.mutate({ id: p.id, ...data })}
              onDelete={() => {
                if (confirm("この写真を削除します。よろしいですか？")) {
                  deleteMutation.mutate({ id: p.id });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoCard({
  photo,
  onUpdate,
  onDelete,
}: {
  photo: {
    id: number;
    fileUrl: string;
    photoType: string;
    workCategory: string | null;
    workItem: string | null;
    memo: string | null;
  };
  onUpdate: (data: {
    photoType?: typeof PHOTO_TYPES[number];
    workCategory?: string | null;
    workItem?: string | null;
    memo?: string | null;
  }) => void;
  onDelete: () => void;
}) {
  const [workItem, setWorkItem] = useState(photo.workItem ?? "");
  const [memo, setMemo] = useState(photo.memo ?? "");

  return (
    <Card className="overflow-hidden">
      <div className="aspect-[4/3] bg-muted relative">
        <img src={photo.fileUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute top-2 left-2">
          <Badge className="bg-black/70 text-white text-[10px] border-0 backdrop-blur-sm">
            {photo.photoType}
          </Badge>
        </div>
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">写真種別</Label>
          <Select
            value={photo.photoType}
            onValueChange={(v) => onUpdate({ photoType: v as typeof PHOTO_TYPES[number] })}
          >
            <SelectTrigger className="h-8 mt-0.5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHOTO_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">工事項目</Label>
          <Select
            value={photo.workCategory || "__none__"}
            onValueChange={(v) =>
              onUpdate({ workCategory: v === "__none__" ? null : v })
            }
          >
            <SelectTrigger className="h-8 mt-0.5 text-xs">
              <SelectValue placeholder="選択..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">
                未選択
              </SelectItem>
              {CATEGORY_LARGE_OPTIONS.map((o) => (
                <SelectItem key={o} value={o} className="text-xs">
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">作業内容</Label>
          <Input
            value={workItem}
            onChange={(e) => setWorkItem(e.target.value)}
            onBlur={() => {
              if (workItem !== (photo.workItem ?? "")) onUpdate({ workItem: workItem || null });
            }}
            className="h-8 mt-0.5 text-xs"
            placeholder="例: 自動ドアセンサー交換"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">メモ</Label>
          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={() => {
              if (memo !== (photo.memo ?? "")) onUpdate({ memo: memo || null });
            }}
            rows={2}
            className="mt-0.5 text-xs"
            placeholder="現場メモ"
          />
        </div>
      </CardContent>
    </Card>
  );
}
