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
import { fileToUprightDataUrl } from "@/lib/imageOrientation";
import { Lightbox, useLightbox } from "@/components/Lightbox";
import {
  syncStatusFromStage,
  syncStageFromStatus,
  type ProgressStage,
  type CaseStatus,
} from "@shared/stageStatus";
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
  Briefcase,
  Smartphone,
  Receipt,
  Link2,
  Copy,
  Sparkles,
  PenLine,
  Wand2,
  RotateCw,
  RotateCcw,
} from "lucide-react";
import { generateQuotePDF, generateCompletionReportPDF } from "@/lib/documentPdf";
import {
  CATEGORY_LARGE_OPTIONS,
  CATEGORY_MEDIUM_OPTIONS,
  recommendPartnerCategories,
} from "../../../shared/checklist-template";
import type { Case, ChecklistItem, Photo } from "../../../drizzle/schema";
import { PREFECTURES, detectPrefecture } from "@shared/prefecture";

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
  "施工中",
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
  const { data: exclusionRows = [] } = trpc.fullwidthExclusions.list.useQuery();
  const exclusionTerms = exclusionRows.map((r) => r.term);

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
              {caseData.prefecture && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {caseData.prefecture}
                </span>
              )}
              {caseData.address && (
                <span className="flex items-center gap-1">
                  {!caseData.prefecture && <MapPin className="h-3 w-3" />}
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
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateQuotePDF(caseData, exclusionTerms)}
            >
              <Download className="h-4 w-4" />
              見積書
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/cases/${id}/survey-report`)}
            >
              <PenLine className="h-4 w-4" />
              現場調査報告書
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/cases/${id}/completion-report`)}
            >
              <PenLine className="h-4 w-4" />
              施工完了報告書
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
        <TabsList className="grid grid-cols-6 w-full md:w-auto md:inline-grid">
          <TabsTrigger value="info">
            <Info className="h-3.5 w-3.5" />
            基本情報
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ListChecks className="h-3.5 w-3.5" />
            チェック
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
          <TabsTrigger value="estimates">
            <Receipt className="h-3.5 w-3.5" />
            見積書
          </TabsTrigger>
          <TabsTrigger value="profit">
            <Wallet className="h-3.5 w-3.5" />
            収支
          </TabsTrigger>
          <TabsTrigger value="expenses">
            <Receipt className="h-3.5 w-3.5" />
            経費
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

        <TabsContent value="estimates">
          <EstimatesTab caseId={id} partnerToken={caseData.partnerToken} />
        </TabsContent>

        <TabsContent value="profit">
          <ProfitTab caseData={caseData} onUpdated={() => utils.cases.get.invalidate({ id })} />
        </TabsContent>

        <TabsContent value="expenses">
          <ExpensesTab caseId={id} />
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
    prefecture: caseData.prefecture ?? "",
    address: caseData.address ?? "",
    progressStage: (caseData.progressStage as "未対応" | "現調済" | "見積提出済" | "承認済") ?? "未対応",
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
          prefecture: form.prefecture || null,
          address: form.address || null,
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
              <div>
                <Label className="text-xs text-muted-foreground">進捗ステージ・フォルダ</Label>
                <Select
                  value={form.progressStage}
                  onValueChange={(v) =>
                    setForm((p) => {
                      const stage = v as ProgressStage;
                      const status = syncStatusFromStage(stage, p.status as CaseStatus);
                      return { ...p, progressStage: stage as never, status: status as never };
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="未対応">未対応</SelectItem>
                    <SelectItem value="現調済">現調済</SelectItem>
                    <SelectItem value="見積提出済">見積提出済</SelectItem>
                    <SelectItem value="承認済">承認済</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">ステータス</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((p) => {
                        const status = v as CaseStatus;
                        const stage = syncStageFromStatus(
                          status,
                          p.progressStage as ProgressStage,
                        );
                        return { ...p, status: status as never, progressStage: stage as never };
                      })
                    }
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
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">都道府県</Label>
                  <div className="flex gap-2 mt-1">
                    <Select
                      value={form.prefecture || "__none__"}
                      onValueChange={(v) =>
                        setForm((p) => ({ ...p, prefecture: v === "__none__" ? "" : v }))
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="選択..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">未選択</SelectItem>
                        {PREFECTURES.map((pr) => (
                          <SelectItem key={pr} value={pr}>
                            {pr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="bg-background shrink-0"
                      title="住所から都道府県を推定"
                      onClick={() => {
                        const detected = detectPrefecture(form.address);
                        if (detected) {
                          setForm((p) => ({ ...p, prefecture: detected }));
                          toast.success(`「${detected}」を設定しました`);
                        } else {
                          toast.error("住所から都道府県を判定できませんでした");
                        }
                      }}
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">住所</Label>
                  <Input
                    className="mt-1"
                    value={form.address}
                    onChange={(e) =>
                      setForm((p) => {
                        const next = { ...p, address: e.target.value };
                        if (!p.prefecture) {
                          const d = detectPrefecture(e.target.value);
                          if (d) next.prefecture = d;
                        }
                        return next;
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">見積金額・円</Label>
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
              <Row label="都道府県" value={caseData.prefecture || "—"} />
              <Row label="住所" value={caseData.address || "—"} />
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
          <h3 className="font-serif-jp font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            協力会社・マスタ連携
          </h3>
          <PartnerSelect
            caseId={caseData.id}
            currentPartnerId={caseData.partnerId ?? null}
            categoryLarge={caseData.categoryLarge ?? null}
            categoryMedium={caseData.categoryMedium ?? null}
            onUpdated={onUpdated}
          />
          <div className="border-t pt-4" />
          <h3 className="font-serif-jp font-semibold">システム記載の取引先</h3>
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

// 協力会社選択コンポーネント・業種推薦付き
function PartnerSelect({
  caseId,
  currentPartnerId,
  categoryLarge,
  categoryMedium,
  onUpdated,
}: {
  caseId: number;
  currentPartnerId: number | null;
  categoryLarge: string | null;
  categoryMedium: string | null;
  onUpdated: () => void;
}) {
  const { data: partners = [] } = trpc.partners.list.useQuery();
  const [onlyRecommended, setOnlyRecommended] = useState(true);
  const recommendedCategories = useMemo(
    () => recommendPartnerCategories(categoryLarge, categoryMedium),
    [categoryLarge, categoryMedium]
  );
  const hasRecommendation = recommendedCategories.length > 0;
  const visiblePartners = useMemo(() => {
    const active = partners.filter((p) => p.isActive);
    if (!hasRecommendation || !onlyRecommended) return active;
    return active.filter((p) => recommendedCategories.includes(p.category));
  }, [partners, hasRecommendation, onlyRecommended, recommendedCategories]);
  const current = currentPartnerId
    ? partners.find((p) => p.id === currentPartnerId)
    : undefined;
  const updateMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("協力会社を更新しました");
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  const telHref = (phone: string | null | undefined): string | null => {
    if (!phone) return null;
    const trimmed = phone.replace(/[^\d+]/g, "");
    return trimmed.length > 0 ? `tel:${trimmed}` : null;
  };

  return (
    <div className="space-y-3">
      <Select
        value={currentPartnerId ? String(currentPartnerId) : "__none__"}
        onValueChange={(v) => {
          updateMutation.mutate({
            id: caseId,
            data: { partnerId: v === "__none__" ? null : Number(v) },
          });
        }}
        disabled={updateMutation.isPending}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="協力会社を選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">未選択</SelectItem>
          {visiblePartners.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              [{p.category}] {p.name}
            </SelectItem>
          ))}
          {visiblePartners.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              推薦業種の業者がありません。「推薦だけ表示」をオフにすると全業者を選べます。
            </div>
          )}
        </SelectContent>
      </Select>
      {hasRecommendation && (
        <div className="flex items-center justify-between gap-2 text-xs bg-amber-50/50 border border-amber-200 rounded px-2 py-1.5">
          <span className="text-amber-900">
            推薦業種：
            <span className="font-medium">{recommendedCategories.join("・")}</span>
          </span>
          <button
            type="button"
            onClick={() => setOnlyRecommended((v) => !v)}
            className="text-amber-700 underline underline-offset-2 hover:text-amber-900 whitespace-nowrap"
          >
            {onlyRecommended ? "全業者表示" : "推薦だけ表示"}
          </button>
        </div>
      )}
      {current ? (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{current.category}</Badge>
            <span className="font-medium text-sm">{current.name}</span>
          </div>
          {current.pic && (
            <p className="text-xs text-muted-foreground">
              担当：{current.pic}
            </p>
          )}
          <div className="grid gap-1.5">
            {telHref(current.phone) && (
              <a href={telHref(current.phone)!}>
                <Button variant="outline" size="sm" className="w-full justify-start bg-background">
                  <Phone className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs">{current.phone}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">代表</span>
                </Button>
              </a>
            )}
            {telHref(current.picPhone) && (
              <a href={telHref(current.picPhone)!}>
                <Button variant="outline" size="sm" className="w-full justify-start bg-background">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs">{current.picPhone}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">担当者</span>
                </Button>
              </a>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          協力会社マスタから選択するとワンタップで電話発信できます。
        </p>
      )}
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
  type CamTag = "現調" | "施工前A" | "施工前B" | "施工中" | "施工後A" | "施工後B" | "設置状況" | "メーカー型番";
  const [cameraPhotoType, setCameraPhotoType] = useState<CamTag>("施工前A");

  const uploadMutation = trpc.photos.upload.useMutation();
  const updateMutation = trpc.photos.update.useMutation({ onSuccess: onUpdated });
  const deleteMutation = trpc.photos.delete.useMutation({ onSuccess: onUpdated });

  const lightbox = useLightbox();
  const lightboxItems = useMemo(
    () =>
      photos.map((p) => ({
        url: p.fileUrl,
        title: [p.photoType, p.workItem].filter(Boolean).join(" / "),
        subtitle: p.memo ?? undefined,
        rotation: p.rotation ?? 0,
      })),
    [photos]
  );

  const handleFiles = async (files: FileList | null, photoType: CamTag = "現調") => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // EXIF Orientation を読み取り、正立化した画像で保存する
        const { dataUrl, mimeType } = await fileToUprightDataUrl(file);
        await uploadMutation.mutateAsync({
          caseId,
          fileName: file.name,
          fileBase64: dataUrl,
          mimeType,
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
            <p className="font-medium text-sm">現場直撮りモード・スマホ推奨</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              撮影タグを選んでカメラを起動 → 撮影した写真は自動でタグ付けされて保存されます
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(["現調", "施工前A", "施工前B", "施工中", "施工後A", "施工後B", "設置状況", "メーカー型番"] as const).map((t) => (
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
          <CardContent className="py-14 text-center flex flex-col items-center gap-3">
            <ImageIcon className="h-10 w-10 text-muted-foreground/70" />
            <p className="font-medium">まだ写真がありません</p>
            <p className="text-sm text-muted-foreground max-w-sm">現地写真をアップロードすると、現調・施工写真として台帳に反映されます。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p, i) => (
            <PhotoCard
              key={p.id}
              photo={p}
              onOpen={() => lightbox.open(i)}
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
      <Lightbox
        items={lightboxItems}
        index={lightbox.index}
        onClose={lightbox.close}
        onIndexChange={lightbox.setIndex}
      />
    </div>
  );
}

function PhotoCard({
  photo,
  onUpdate,
  onDelete,
  onOpen,
}: {
  photo: {
    id: number;
    fileUrl: string;
    photoType: string;
    workCategory: string | null;
    workItem: string | null;
    memo: string | null;
    rotation?: number;
  };
  onUpdate: (data: {
    photoType?: typeof PHOTO_TYPES[number];
    workCategory?: string | null;
    workItem?: string | null;
    memo?: string | null;
    rotation?: number;
  }) => void;
  onDelete: () => void;
  onOpen?: () => void;
}) {
  const rotation = photo.rotation ?? 0;
  const [workItem, setWorkItem] = useState(photo.workItem ?? "");
  const [memo, setMemo] = useState(photo.memo ?? "");

  return (
    <Card className="overflow-hidden">
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        <img
          src={photo.fileUrl}
          alt=""
          className="w-full h-full object-cover cursor-zoom-in transition-transform duration-200"
          style={{
            imageOrientation: "from-image",
            transform: rotation ? `rotate(${rotation}deg)` : undefined,
          }}
          onClick={onOpen}
        />
        <div className="absolute top-2 left-2">
          <Badge className="bg-black/70 text-white text-[10px] border-0 backdrop-blur-sm">
            {photo.photoType}
          </Badge>
        </div>
        <div className="absolute top-2 right-2 flex gap-1.5">
          <div className="flex items-center rounded-full bg-black/70 backdrop-blur-sm overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ rotation: (rotation + 270) % 360 });
              }}
              title="左に90°回転"
              className="h-7 w-7 flex items-center justify-center text-white hover:bg-white/20 transition-colors active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <span className="w-px h-4 bg-white/30" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ rotation: (rotation + 90) % 360 });
              }}
              title="右に90°回転"
              className="h-7 w-7 flex items-center justify-center text-white hover:bg-white/20 transition-colors active:scale-95"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={onDelete}
            title="削除"
            className="h-7 w-7 flex items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
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


// ============================================================
// 見積書タブ
// ============================================================
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function EstimatesTab({ caseId, partnerToken }: { caseId: number; partnerToken: string | null }) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: estimates = [], isLoading } = trpc.estimates.listByCase.useQuery({ caseId });
  const [uploading, setUploading] = useState(false);

  const uploadMutation = trpc.estimates.uploadFile.useMutation();
  const extractMutation = trpc.estimates.extractAndCreate.useMutation({
    onSuccess: () => {
      utils.estimates.listByCase.invalidate({ caseId });
      utils.cases.get.invalidate({ id: caseId });
    },
  });
  const updateMutation = trpc.estimates.update.useMutation({
    onSuccess: () => {
      utils.estimates.listByCase.invalidate({ caseId });
      utils.cases.get.invalidate({ id: caseId });
      toast.success("見積書を更新しました");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.estimates.delete.useMutation({
    onSuccess: () => {
      utils.estimates.listByCase.invalidate({ caseId });
      toast.success("削除しました");
    },
  });
  const tokenMutation = trpc.estimates.issuePartnerToken.useMutation({
    onSuccess: ({ token }) => {
      const url = `${window.location.origin}/partner-view/${token}`;
      navigator.clipboard.writeText(url).then(
        () => toast.success("共有リンクをコピーしました"),
        () => toast.success(`共有リンク: ${url}`)
      );
      utils.cases.get.invalidate({ id: caseId });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) {
        toast.error("PDFまたは画像を選択してください");
        return;
      }
      const base64 = await fileToBase64(file);
      const mime = file.type || (isPdf ? "application/pdf" : "image/jpeg");
      toast.info("アップロード中...");
      const up = await uploadMutation.mutateAsync({
        caseId,
        fileName: file.name,
        fileBase64: base64,
        mimeType: mime,
      });
      toast.info("AIが見積金額を読み取り中...");
      const res = await extractMutation.mutateAsync({
        caseId,
        fileKey: up.fileKey,
        fileUrl: up.url,
        fileName: file.name,
        mimeType: mime,
      });
      if (res.totalAmount != null) {
        toast.success(`見積金額 ¥${res.totalAmount.toLocaleString()} を抽出しました`);
      } else {
        toast.warning("金額の自動抽出に失敗しました。手動で入力してください。");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "処理に失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const partnerUrl = partnerToken ? `${window.location.origin}/partner-view/${partnerToken}` : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif-jp text-lg font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-amber-700" />
                プレナス向け見積書
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                PDF・画像をアップロードするとAIが合計金額・材料費・作業費を自動抽出します
              </p>
            </div>
            <input
              type="file"
              accept="application/pdf,.pdf,image/*"
              hidden
              ref={fileRef}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleFile(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              見積書をアップロード
            </Button>
          </div>

          <div className="border-t border-border/60 pt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">協力業者向け共有リンク・見積75%金額のみ表示</span>
            </div>
            {partnerUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="flex-1 min-w-0 truncate text-xs bg-muted/40 border rounded px-2 py-1.5 font-mono">
                  {partnerUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(partnerUrl).then(
                      () => toast.success("コピーしました"),
                      () => toast.error("コピーに失敗しました")
                    );
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  コピー
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(partnerUrl, "_blank")}
                >
                  プレビュー
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => tokenMutation.mutate({ caseId })}
                disabled={tokenMutation.isPending}
              >
                {tokenMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                共有リンクを発行
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">
              ※ 協力業者には75%の金額のみ表示され、原価であるプレナス向け金額は非表示です。
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-8">読み込み中...</div>
      ) : estimates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            まだ見積書がアップロードされていません
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {estimates.map((e) => (
            <EstimateCard
              key={e.id}
              estimate={e}
              onUpdate={(patch) => updateMutation.mutate({ id: e.id, ...patch })}
              onDelete={() => {
                if (confirm("この見積書を削除しますか？")) deleteMutation.mutate({ id: e.id });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EstimateCard({
  estimate,
  onUpdate,
  onDelete,
}: {
  estimate: {
    id: number;
    fileName: string | null;
    fileUrl: string;
    mimeType: string | null;
    totalAmount: number | null;
    materialAmount: number | null;
    laborAmount: number | null;
    vendorName: string | null;
    estimateDate: Date | string | null;
    note: string | null;
    createdAt: Date | string;
  };
  onUpdate: (patch: {
    totalAmount?: number | null;
    materialAmount?: number | null;
    laborAmount?: number | null;
    vendorName?: string | null;
    note?: string | null;
  }) => void;
  onDelete: () => void;
}) {
  const [total, setTotal] = useState(estimate.totalAmount?.toString() ?? "");
  const [material, setMaterial] = useState(estimate.materialAmount?.toString() ?? "");
  const [labor, setLabor] = useState(estimate.laborAmount?.toString() ?? "");
  const [vendor, setVendor] = useState(estimate.vendorName ?? "");
  const [note, setNote] = useState(estimate.note ?? "");
  const isImage = (estimate.mimeType ?? "").startsWith("image/");
  const partnerAmount = estimate.totalAmount != null ? Math.round(estimate.totalAmount * 0.75) : null;

  return (
    <Card>
      <CardContent className="p-4 grid md:grid-cols-[160px_1fr] gap-4">
        <a
          href={estimate.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="border rounded overflow-hidden bg-muted/30 h-32 md:h-full flex items-center justify-center"
        >
          {isImage ? (
            <img src={estimate.fileUrl} alt={estimate.fileName ?? ""} className="object-cover w-full h-full" />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground">
              <FileText className="h-8 w-8" />
              <span className="text-[10px] mt-1">PDF</span>
            </div>
          )}
        </a>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{estimate.fileName ?? "見積書"}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(estimate.createdAt).toLocaleString("ja-JP")}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">合計・円</Label>
              <Input
                inputMode="numeric"
                value={total}
                onChange={(e) => setTotal(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={() => {
                  const n = total ? Number(total) : null;
                  if (n !== estimate.totalAmount) onUpdate({ totalAmount: n });
                }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">材料費</Label>
              <Input
                inputMode="numeric"
                value={material}
                onChange={(e) => setMaterial(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={() => {
                  const n = material ? Number(material) : null;
                  if (n !== estimate.materialAmount) onUpdate({ materialAmount: n });
                }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">作業費</Label>
              <Input
                inputMode="numeric"
                value={labor}
                onChange={(e) => setLabor(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={() => {
                  const n = labor ? Number(labor) : null;
                  if (n !== estimate.laborAmount) onUpdate({ laborAmount: n });
                }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">業者名</Label>
              <Input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                onBlur={() => {
                  if (vendor !== (estimate.vendorName ?? "")) onUpdate({ vendorName: vendor || null });
                }}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">メモ</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if (note !== (estimate.note ?? "")) onUpdate({ note: note || null });
              }}
              rows={2}
              className="text-sm"
            />
          </div>
          {partnerAmount != null && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                協力業者向け 75%
              </Badge>
              <span className="font-serif-jp text-lg font-semibold tracking-tight">
                ¥{partnerAmount.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                プレナス向け原価 ¥{estimate.totalAmount?.toLocaleString()} × 75%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProfitTab({ caseData, onUpdated }: { caseData: Case; onUpdated: () => void }) {
  const { data: estimates = [] } = trpc.estimates.listByCase.useQuery({ caseId: caseData.id });
  const { data: expenses = [] } = trpc.expenses.listByCase.useQuery({ caseId: caseData.id });

  const yen = (n: number | null | undefined) =>
    n != null ? `¥${Math.round(n).toLocaleString()}` : "—";

  // 入力フォーム state（プレナス提出見積額＝売上／協力業者見積額＝原価）
  const [plenusInput, setPlenusInput] = useState<string>(
    caseData.plenusQuoteAmount != null ? String(caseData.plenusQuoteAmount) : ""
  );
  const [vendorInput, setVendorInput] = useState<string>(
    caseData.estimatedCost != null ? String(caseData.estimatedCost) : ""
  );

  const saveMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("金額を保存しました");
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const plenus = plenusInput.trim() === "" ? null : Number(plenusInput);
    const vendor = vendorInput.trim() === "" ? null : Number(vendorInput);
    if (plenus != null && (!Number.isFinite(plenus) || plenus < 0)) {
      toast.error("プレナス提出額が不正です");
      return;
    }
    if (vendor != null && (!Number.isFinite(vendor) || vendor < 0)) {
      toast.error("協力業者額が不正です");
      return;
    }
    saveMutation.mutate({
      id: caseData.id,
      data: {
        plenusQuoteAmount: plenus,
        estimatedCost: vendor,
        is10mYen: (plenus ?? 0) >= 100000,
      },
    });
  };

  // 見積一覧合計（協力業者見積の参考値）
  const estimatesTotal = estimates.reduce((s, e) => s + (e.totalAmount ?? 0), 0);
  // 経費合計（領収書取込分）
  const expensesTotal = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  // 売上 = プレナス提出見積額。未入力なら協力業者見積額からの想定（÷0.75）でフォールバック表示
  const vendorAmount = caseData.estimatedCost ?? null;
  const plenusAmount = caseData.plenusQuoteAmount ?? null;
  const sales =
    plenusAmount != null
      ? plenusAmount
      : vendorAmount != null && vendorAmount > 0
        ? Math.round(vendorAmount / 0.75)
        : 0;
  const salesIsEstimated = plenusAmount == null && sales > 0;

  // 原価 = 協力業者見積額 + 経費合計
  const cost = (vendorAmount ?? 0) + expensesTotal;
  const grossProfit = sales - cost;
  const grossMargin = sales > 0 ? grossProfit / sales : 0;

  const dirty =
    plenusInput !== (caseData.plenusQuoteAmount != null ? String(caseData.plenusQuoteAmount) : "") ||
    vendorInput !== (caseData.estimatedCost != null ? String(caseData.estimatedCost) : "");

  return (
    <div className="space-y-4">
      {/* 金額入力カード */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">金額入力</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              依頼番号: {caseData.requestNumber}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">プレナスへ提出した見積金額・売上</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="pl-7 tabular-nums"
                  placeholder="例: 320000"
                  value={plenusInput}
                  onChange={(e) => setPlenusInput(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">プレナスへ請求・提出した金額。これが売上になります。</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">協力業者の見積金額・原価</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="pl-7 tabular-nums"
                  placeholder="例: 240000"
                  value={vendorInput}
                  onChange={(e) => setVendorInput(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                協力業者へ支払う金額。領収書取込分の経費と合わせて原価になります。
                {estimatesTotal > 0 && (
                  <>
                    {" "}見積書合計: <span className="font-medium">{yen(estimatesTotal)}</span>
                    {estimatesTotal !== (caseData.estimatedCost ?? estimatesTotal) && (
                      <button
                        type="button"
                        className="ml-1 text-primary underline"
                        onClick={() => setVendorInput(String(estimatesTotal))}
                      >
                        反映
                      </button>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending} className="active:scale-[0.97] transition-transform">
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              金額を保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 収支サマリーカード */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">個別案件 収支</h3>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-md border p-3 bg-blue-50 border-blue-200">
              <div className="text-xs text-blue-700 mb-1">売上・プレナス提出額</div>
              <div className="text-xl font-semibold tracking-tight">{yen(sales)}</div>
              {salesIsEstimated && (
                <div className="text-[11px] text-blue-700/80 mt-1">未入力のため協力業者額から想定 ÷0.75</div>
              )}
            </div>
            <div className="rounded-md border p-3 bg-emerald-50 border-emerald-200">
              <div className="text-xs text-emerald-700 mb-1">協力業者見積額</div>
              <div className="text-xl font-semibold tracking-tight">{yen(vendorAmount)}</div>
            </div>
            <div className="rounded-md border p-3 bg-amber-50 border-amber-200">
              <div className="text-xs text-amber-700 mb-1">経費・領収書</div>
              <div className="text-xl font-semibold tracking-tight">{yen(expensesTotal)}</div>
              <div className="text-[11px] text-amber-700/80 mt-1">原価計: {yen(cost)}</div>
            </div>
            <div className={`rounded-md border p-3 ${grossProfit >= 0 ? "bg-violet-50 border-violet-200" : "bg-red-50 border-red-200"}`}>
              <div className="text-xs mb-1 text-muted-foreground">粗利・売上−原価</div>
              <div className={`text-xl font-semibold tracking-tight ${grossProfit >= 0 ? "text-violet-700" : "text-red-700"}`}>
                {yen(grossProfit)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                粗利率 {(grossMargin * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 leading-relaxed pt-2 border-t">
            <div>・売上：プレナスへ提出した見積金額。未入力時は協力業者額から想定表示</div>
            <div>・原価：協力業者見積額 ＋ 領収書取込分の経費合計</div>
            <div>・粗利・粗利率は金額を保存すると即時に反映されます</div>
          </div>
        </CardContent>
      </Card>

      {estimates.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-2">見積書内訳・{estimates.length}件</div>
            <div className="text-xs text-muted-foreground mb-3">合計: {yen(estimatesTotal)}</div>
            <div className="space-y-1">
              {estimates.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                  <div className="truncate">
                    <span className="text-muted-foreground mr-2">{e.vendorName || "—"}</span>
                    <span>{e.fileName ?? "見積書"}</span>
                  </div>
                  <div className="font-medium tabular-nums">{yen(e.totalAmount)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ExpensesTab({ caseId }: { caseId: number }) {
  const utils = trpc.useUtils();
  const { data: expenses = [] } = trpc.expenses.listByCase.useQuery({ caseId });
  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      utils.expenses.listByCase.invalidate({ caseId });
      utils.cases.get.invalidate({ id: caseId });
      toast.success("経費を削除しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const yen = (n: number | null | undefined) =>
    n != null ? `¥${Math.round(n).toLocaleString()}` : "—";

  const total = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">経費一覧</h3>
              <Badge variant="outline">{expenses.length}件</Badge>
            </div>
            <div className="text-sm">
              合計:{" "}
              <span className="font-semibold tabular-nums text-base">
                {yen(total)}
              </span>
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-md flex flex-col items-center gap-3">
              <Receipt className="h-9 w-9 text-muted-foreground/70" />
              <p className="font-medium">この案件の経費はまだありません</p>
              <p className="text-sm text-muted-foreground max-w-md">
                <a href="/expenses/import" className="text-primary underline underline-offset-4">
                  経費取込ページ
                </a>
                から領収書・請求書をアップロードすると、依頼番号や店舗名から自動でこの案件に振り分けられます。
              </p>
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/60 text-foreground/80">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">日付</th>
                    <th className="text-left px-3 py-2 font-medium">業者</th>
                    <th className="text-left px-3 py-2 font-medium">区分</th>
                    <th className="text-right px-3 py-2 font-medium">金額・税込</th>
                    <th className="text-left px-3 py-2 font-medium">摘要</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 tabular-nums">
                        {e.expenseDate
                          ? new Date(e.expenseDate as any).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{e.vendorName ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{e.category}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {yen(e.amount)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[260px]">
                        {e.note ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("この経費を削除しますか？")) {
                              deleteMutation.mutate({ id: e.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
