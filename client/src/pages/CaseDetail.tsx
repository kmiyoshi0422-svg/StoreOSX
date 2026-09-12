import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
  Clock,
  CheckSquare,
  CalendarDays,
  Calendar,
  ExternalLink,
  X,
  FolderOpen,
  Plus,
  Folder,
  FileUp,
  Eye,
  Globe,
  Tag,
  Repeat,
  ShieldCheck,
  Minus as MinusIcon,
  Plus as PlusIcon,
  Building2,
  SkipForward,
} from "lucide-react";
import { generateQuotePDF, generateCompletionReportPDF } from "@/lib/documentPdf";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";
import html2canvas from "html2canvas-pro";
import {
  CATEGORY_LARGE_OPTIONS,
  CATEGORY_MEDIUM_OPTIONS,
  recommendPartnerCategories,
} from "../../../shared/checklist-template";
import type { Case, ChecklistItem, Photo } from "../../../drizzle/schema";
import { PREFECTURES, detectPrefecture } from "@shared/prefecture";
import { StoreEquipmentPanel } from "./StoreEquipmentPanel";
import { StoreMasterLinkPanel } from "./StoreMasterLinkPanel";


const PhotosTab = React.lazy(() => import("./CaseDetailPhotosTab"));
const EstimatesTab = React.lazy(() => import("./CaseDetailEstimatesTab"));
const ProfitTab = React.lazy(() => import("./CaseDetailProfitTab"));
const ExpensesTab = React.lazy(() => import("./CaseDetailExpensesTab"));
const ScheduleTab = React.lazy(() => import("./CaseDetailScheduleTab"));
const DocumentsTab = React.lazy(() => import("./CaseDetailDocumentsTab"));
const StatusHistoryTab = React.lazy(() => import("./CaseDetailStatusHistoryTab"));
const StoreHistoryTab = React.lazy(() => import("./CaseDetailStoreHistoryTab"));

function LazyTabFallback() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      タブを読み込んでいます
    </div>
  );
}

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
  const { user } = useAuth();
  const isPartner = user?.role === 'partner';
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';
  const canViewFinancials = isOwnerOrAdmin || user?.role === 'executive';
  const canManageCase = isOwnerOrAdmin || user?.role === 'executive' || user?.role === 'user';
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("info");
  const { data: caseData, isLoading } = trpc.cases.get.useQuery({ id });
  // タブ別遅延取得: チェックリストと写真はタブヘッダーのバッジ表示に使うため常時取得
  const { data: checklist = [] } = trpc.checklist.listByCase.useQuery({ caseId: id });
  const { data: photos = [] } = trpc.photos.listByCase.useQuery({ caseId: id });
  const { data: exclusionRows = [] } = trpc.fullwidthExclusions.list.useQuery(undefined, { enabled: activeTab === "info" });
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
            {canViewFinancials && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateQuotePDF(caseData, exclusionTerms)}
              >
                <Download className="h-4 w-4" />
                見積書
              </Button>
            )}
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

      {canManageCase && (
        <StoreMasterLinkPanel
          caseId={id}
          currentStoreId={(caseData as any).storeId ?? null}
          caseStoreName={caseData.storeName}
          caseStoreCode={(caseData as any).storeCode ?? null}
          caseBrand={caseData.brand}
          casePrefecture={caseData.prefecture ?? null}
          caseAddress={caseData.address ?? null}
          casePhone={caseData.storePhone ?? null}
          caseBusinessHours={(caseData as any).businessHours ?? null}
          onUpdated={() => utils.cases.get.invalidate({ id })}
          onOpenHistory={() => setActiveTab("storeHistory")}
          onUnlinked={() => setActiveTab("info")}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="info" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="relative w-full">
          {/* スクロールヒント（右側フェード） */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 md:hidden" />
          <TabsList className="flex h-auto gap-1 p-1 w-full overflow-x-auto scrollbar-hide [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="info" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
              <Info className="h-3.5 w-3.5" />
              基本情報
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
              <ListChecks className="h-3.5 w-3.5" />
              チェック
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-4">
                {checklist.filter((i) => i.checked).length}/{checklist.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="photos" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
              <ImageIcon className="h-3.5 w-3.5" />
              写真
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-4">
                {photos.length}
              </Badge>
            </TabsTrigger>
            {canViewFinancials && (
              <TabsTrigger value="estimates" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
                <Receipt className="h-3.5 w-3.5" />
                見積書
              </TabsTrigger>
            )}
            {canViewFinancials && (
              <TabsTrigger value="profit" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
                <Wallet className="h-3.5 w-3.5" />
                収支
              </TabsTrigger>
            )}
            {!isPartner && user?.role !== "customer" && (
              <TabsTrigger value="expenses" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
                <Receipt className="h-3.5 w-3.5" />
                経費
              </TabsTrigger>
            )}
            <TabsTrigger value="schedule" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
              <CalendarDays className="h-3.5 w-3.5" />
              工程
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
              <Folder className="h-3.5 w-3.5" />
              図面・資料
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
              <Clock className="h-3.5 w-3.5" />
              履歴
            </TabsTrigger>
            {canManageCase && (caseData as any).storeId && (
              <TabsTrigger value="storeHistory" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
                <Building2 className="h-3.5 w-3.5" />
                店舗履歴
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="info">
          <InfoTab
            caseData={caseData}
            onUpdated={() => utils.cases.get.invalidate({ id })}
            isPartner={isPartner}
            canManageCase={canManageCase}
            canViewFinancials={canViewFinancials}
            canDeleteCase={isOwnerOrAdmin}
          />
        </TabsContent>

        <TabsContent value="checklist">
          <ChecklistTab
            caseId={id}
            items={checklist}
            onUpdated={() => utils.checklist.listByCase.invalidate({ caseId: id })}
          />
        </TabsContent>

        <TabsContent value="photos">
          {activeTab === "photos" && (
            <React.Suspense fallback={<LazyTabFallback />}>
              <PhotosTab
                caseId={id}
                photos={photos}
                onUpdated={() => utils.photos.listByCase.invalidate({ caseId: id })}
              />
            </React.Suspense>
          )}
        </TabsContent>

        <TabsContent value="estimates">
          {activeTab === "estimates" && <React.Suspense fallback={<LazyTabFallback />}><EstimatesTab caseId={id} partnerToken={caseData.partnerToken} /></React.Suspense>}
        </TabsContent>

        <TabsContent value="profit">
          {activeTab === "profit" && <React.Suspense fallback={<LazyTabFallback />}><ProfitTab caseData={caseData} onUpdated={() => utils.cases.get.invalidate({ id })} isPartner={isPartner} /></React.Suspense>}
        </TabsContent>

        <TabsContent value="expenses">
          {activeTab === "expenses" && <React.Suspense fallback={<LazyTabFallback />}><ExpensesTab caseId={id} /></React.Suspense>}
        </TabsContent>

        <TabsContent value="schedule">
          {activeTab === "schedule" && <React.Suspense fallback={<LazyTabFallback />}><ScheduleTab caseId={id} caseData={caseData} /></React.Suspense>}
        </TabsContent>

        <TabsContent value="documents">
          {activeTab === "documents" && <React.Suspense fallback={<LazyTabFallback />}><DocumentsTab caseId={id} caseData={caseData} /></React.Suspense>}
        </TabsContent>

        <TabsContent value="history">
          {activeTab === "history" && <React.Suspense fallback={<LazyTabFallback />}><StatusHistoryTab caseId={id} /></React.Suspense>}
        </TabsContent>

        {canManageCase && (caseData as any).storeId && (
          <TabsContent value="storeHistory">
            {activeTab === "storeHistory" && <React.Suspense fallback={<LazyTabFallback />}><StoreHistoryTab storeId={(caseData as any).storeId} currentCaseId={id} /></React.Suspense>}
          </TabsContent>
        )}
      </Tabs>

    </div>
  );
}

// ============================================================
// Amount Approval Card (owner/admin only)
// ============================================================
function AmountApprovalCard({ caseId, approved, onUpdated }: { caseId: number; approved: boolean; onUpdated: () => void }) {
  const approveAmount = trpc.cases.approveAmount.useMutation({
    onSuccess: () => {
      toast.success(approved ? "金額公開を取り消しました" : "協力業者に金額を公開しました");
      onUpdated();
    },
    onError: () => toast.error("操作に失敗しました"),
  });

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">協力業者への金額公開</span>
            {approved ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">公開中</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">非公開</Badge>
            )}
          </div>
          <Button
            size="sm"
            variant={approved ? "outline" : "default"}
            onClick={() => approveAmount.mutate({ id: caseId, approved: !approved })}
            disabled={approveAmount.isPending}
          >
            {approved ? "公開を取り消す" : "金額を公開する"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          公開すると、この案件に紐付いた協力業者が見積金額・実績金額を閲覧できるようになります。粗利・利益率は常に非表示です。
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Info Tab
// ============================================================
function InfoTab({
  caseData,
  onUpdated,
  isPartner = false,
  canManageCase = false,
  canViewFinancials = false,
  canDeleteCase = false,
}: {
  caseData: Case;
  onUpdated: () => void;
  isPartner?: boolean;
  canManageCase?: boolean;
  canViewFinancials?: boolean;
  canDeleteCase?: boolean;
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
    const { estimatedCost, ...nonFinancialForm } = form;
    updateMutation.mutate(
      {
        id: caseData.id,
        data: {
          ...nonFinancialForm,
          prefecture: form.prefecture || null,
          address: form.address || null,
          categoryLarge: form.categoryLarge || null,
          categoryMedium: form.categoryMedium || null,
          categorySmall: form.categorySmall || null,
          ...(canViewFinancials ? {
            estimatedCost: estimatedCost || null,
            is10mYen: estimatedCost >= 100000,
          } : {}),
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
            {canManageCase && (
              !editing ? (
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
              )
            )}
          </div>

          {/* Partner向けステータス変更UI */}
          {isPartner && (
            <PartnerStatusChanger caseId={caseData.id} currentStatus={caseData.status} currentUrgency={caseData.urgency} onUpdated={onUpdated} />
          )}

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
              {canViewFinancials && (
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
              )}
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
              {canViewFinancials && (
                <Row
                  label="見積金額"
                  value={
                    caseData.estimatedCost
                      ? `¥${caseData.estimatedCost.toLocaleString()}`
                      : "—"
                  }
                />
              )}
              <Row label="依頼内容" value={caseData.requestContent || "—"} multiline />
              <Row label="備考" value={caseData.notes || "—"} multiline />
            </dl>
          )}
        </CardContent>
      </Card>

      {/* 協力業者作業メモ欄 */}
      <PartnerNotesCard caseId={caseData.id} partnerNotes={(caseData as any).partnerNotes ?? ""} partnerNotesUpdatedAt={(caseData as any).partnerNotesUpdatedAt ?? null} partnerNotesUpdatedBy={(caseData as any).partnerNotesUpdatedBy ?? null} isPartner={isPartner} onUpdated={onUpdated} />

      {canManageCase && <Card>
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
          {canDeleteCase && <div className="pt-4 border-t">
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
          </div>}
        </CardContent>
      </Card>}
      {/* 再訪記録カード */}
      <RevisitCard caseId={caseData.id} revisitCount={(caseData as any).revisitCount ?? 0} onUpdated={onUpdated} />
      {/* 現調スキップカード */}
      {canManageCase && (
        <SurveySkipCard caseId={caseData.id} storeId={(caseData as any).storeId ?? null} progressStage={(caseData as any).progressStage ?? '未対応'} />
      )}
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
  const bulkToggleMutation = trpc.checklist.bulkToggle.useMutation({
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
                <div className="flex items-center gap-2">
                  {done < total && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          disabled={bulkToggleMutation.isPending}
                        >
                          一括チェック
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>一括チェックの確認</AlertDialogTitle>
                          <AlertDialogDescription>
                            「{phase}」の未チェック項目 {total - done}件 を全てチェックします。よろしいですか？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              const uncheckedIds = phaseItems.filter((i) => !i.checked).map((i) => i.id);
                              if (uncheckedIds.length > 0) {
                                bulkToggleMutation.mutate({ ids: uncheckedIds, checked: true });
                              }
                            }}
                          >
                            実行
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {done > 0 && done === total && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2 text-muted-foreground"
                          disabled={bulkToggleMutation.isPending}
                        >
                          解除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>一括解除の確認</AlertDialogTitle>
                          <AlertDialogDescription>
                            「{phase}」のチェック {total}件 を全て解除します。よろしいですか？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              const allIds = phaseItems.map((i) => i.id);
                              bulkToggleMutation.mutate({ ids: allIds, checked: false });
                            }}
                          >
                            解除する
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
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
// 再訪記録カード
// ============================================================
const REVISIT_REASONS = [
  { value: "部材不足", label: "部材不足", color: "bg-orange-100 text-orange-800" },
  { value: "追加依頼", label: "追加依頼", color: "bg-blue-100 text-blue-800" },
  { value: "手直し", label: "手直し", color: "bg-red-100 text-red-800" },
  { value: "確認不足", label: "確認不足", color: "bg-yellow-100 text-yellow-800" },
  { value: "天候不良", label: "天候不良", color: "bg-gray-100 text-gray-800" },
  { value: "その他", label: "その他", color: "bg-slate-100 text-slate-800" },
] as const;

function RevisitCard({
  caseId,
  revisitCount,
  onUpdated,
}: {
  caseId: number;
  revisitCount: number;
  onUpdated: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [note, setNote] = useState("");

  const addRevisit = trpc.cases.addRevisit.useMutation({
    onSuccess: () => {
      toast.success("再訪を記録しました");
      setDialogOpen(false);
      setSelectedReason("");
      setNote("");
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  const markRevisit = trpc.cases.markRevisit.useMutation({
    onSuccess: () => {
      toast.success("再訪記録を更新しました");
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: revisitLogs } = trpc.cases.listRevisitLogs.useQuery({ caseId });

  const handleSubmit = () => {
    if (!selectedReason) {
      toast.error("再訪理由を選択してください");
      return;
    }
    addRevisit.mutate({
      caseId,
      reason: selectedReason as any,
      note: note || undefined,
    });
  };

  return (
    <>
      <Card className="col-span-full lg:col-span-2">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-jp font-semibold flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              現場再訪記録
            </h3>
            {revisitCount === 0 && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
                <ShieldCheck className="h-3 w-3 mr-1" />
                再訪なし
              </Badge>
            )}
            {revisitCount > 0 && (
              <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                <Repeat className="h-3 w-3 mr-1" />
                再訪 {revisitCount}回
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            プレナス目標: 現場再訪ゼロ。一度の訪問で全作業を完了させることが求められます。
          </p>

          {/* 再訪記録ボタン */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => setDialogOpen(true)}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              再訪を記録
            </Button>
            {revisitCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={() => markRevisit.mutate({ id: caseId, revisitCount: 0 })}
                disabled={markRevisit.isPending}
              >
                リセット
              </Button>
            )}
            <span className="text-sm text-muted-foreground ml-auto">
              現在 <span className="font-bold text-foreground">{revisitCount}</span> 回
            </span>
          </div>

          {/* 再訪履歴タイムライン */}
          {revisitLogs && revisitLogs.length > 0 && (
            <div className="border-t pt-3 mt-3 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">再訪履歴</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {revisitLogs.map((log) => {
                  const reasonDef = REVISIT_REASONS.find(r => r.value === log.reason);
                  return (
                    <div key={log.id} className="flex items-start gap-2 text-sm border-l-2 border-muted pl-3 py-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${reasonDef?.color ?? "bg-gray-100 text-gray-800"}`}>
                            {log.reason}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleDateString("ja-JP")}
                          </span>
                        </div>
                        {log.note && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.note}</p>
                        )}
                      </div>
                      {log.createdBy && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{log.createdBy}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 再訪理由選択ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>再訪理由の記録</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">再訪理由 *</Label>
              <div className="grid grid-cols-2 gap-2">
                {REVISIT_REASONS.map((reason) => (
                  <Button
                    key={reason.value}
                    type="button"
                    variant={selectedReason === reason.value ? "default" : "outline"}
                    size="sm"
                    className="justify-start text-xs"
                    onClick={() => setSelectedReason(reason.value)}
                  >
                    {reason.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">メモ（任意）</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="詳細や補足情報を入力..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={!selectedReason || addRevisit.isPending}
            >
              {addRevisit.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              再訪を記録
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


// ============================================================
// Status History Tab (ステータス変更履歴タイムライン)
// ============================================================
function PartnerStatusChanger({ caseId, currentStatus, currentUrgency, onUpdated }: { caseId: number; currentStatus: string; currentUrgency: string; onUpdated: () => void }) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();
  const updateMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("ステータスを変更しました");
      onUpdated();
      utils.statusLogs.listByCase.invalidate({ caseId });
    },
    onError: () => toast.error("ステータス変更に失敗しました"),
  });

  const completeWithReport = trpc.statusLogs.completeWithReport.useMutation({
    onSuccess: () => {
      toast.success("完了報告を送信しました");
      setShowCompleteDialog(false);
      setComment("");
      setPhotos([]);
      onUpdated();
      utils.statusLogs.listByCase.invalidate({ caseId });
    },
    onError: () => toast.error("完了報告の送信に失敗しました"),
  });

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "完了") {
      setShowCompleteDialog(true);
    } else {
      updateMutation.mutate({ id: caseId, data: { status: newStatus as any } });
    }
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = "";
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[idx].preview);
      updated.splice(idx, 1);
      return updated;
    });
  };

  const handleSubmitComplete = async () => {
    setUploading(true);
    try {
      // Convert files to base64
      const photoData = await Promise.all(
        photos.map(async (p) => {
          const arrayBuffer = await p.file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          return {
            fileName: p.file.name,
            fileBase64: base64,
            mimeType: p.file.type || "image/jpeg",
          };
        })
      );
      completeWithReport.mutate({
        caseId,
        comment,
        photos: photoData,
      });
    } catch {
      toast.error("写真の処理に失敗しました");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">ステータス</Label>
          <Select value={currentStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[130px]">
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
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">緊急度</Label>
          <Select value={currentUrgency} onValueChange={(v) => updateMutation.mutate({ id: caseId, data: { urgency: v as any } })}>
            <SelectTrigger className="w-[110px]">
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

      {/* 完了報告ダイアログ */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-600" />
              完了報告
            </DialogTitle>
            <DialogDescription>
              現場の完了写真と報告コメントを入力してください
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 写真アップロード */}
            <div>
              <Label className="text-sm font-medium mb-2 block">完了写真</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {photos.map((p, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={p.preview}
                      alt={`写真 ${idx + 1}`}
                      className="h-20 w-20 object-cover rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="h-20 w-20 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoAdd}
                  />
                  <Camera className="h-6 w-6 text-muted-foreground" />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">タップして写真を追加（複数選択可）</p>
            </div>

            {/* コメント */}
            <div>
              <Label className="text-sm font-medium mb-2 block">報告コメント</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="施工完了の報告内容を入力してください..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleSubmitComplete}
              disabled={uploading || completeWithReport.isPending || !comment.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {(uploading || completeWithReport.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              完了報告を送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


// ============================================================
// 現調スキップ判断カード
// ============================================================
const SKIP_REASONS = [
  { value: "過去写真で判断可能", label: "過去写真で判断可能", color: "bg-blue-100 text-blue-800" },
  { value: "図面あり", label: "図面あり", color: "bg-green-100 text-green-800" },
  { value: "軽微な修理", label: "軽微な修理", color: "bg-yellow-100 text-yellow-800" },
  { value: "リピート案件", label: "リピート案件", color: "bg-purple-100 text-purple-800" },
  { value: "電話ヒアリング済", label: "電話ヒアリング済", color: "bg-orange-100 text-orange-800" },
  { value: "その他", label: "その他", color: "bg-slate-100 text-slate-800" },
] as const;

function SurveySkipCard({
  caseId,
  storeId,
  progressStage,
}: {
  caseId: number;
  storeId: number | null;
  progressStage: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [reasonDetail, setReasonDetail] = useState("");
  const utils = trpc.useUtils();

  const { data: skipLogs = [] } = trpc.surveySkip.listByCase.useQuery({ caseId });

  const createSkip = trpc.surveySkip.create.useMutation({
    onSuccess: () => {
      toast.success("現調スキップを記録しました");
      setDialogOpen(false);
      setSelectedReason("");
      setReasonDetail("");
      utils.surveySkip.listByCase.invalidate({ caseId });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!selectedReason) {
      toast.error("スキップ理由を選択してください");
      return;
    }
    createSkip.mutate({
      caseId,
      storeId,
      reason: selectedReason as any,
      reasonDetail: reasonDetail || undefined,
    });
  };

  // 未対応ステージのみスキップ操作を表示
  const canSkip = progressStage === "未対応";

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif-jp font-semibold flex items-center gap-2">
            <SkipForward className="h-4 w-4" />
            現調スキップ
          </h3>
          {skipLogs.length === 0 && (
            <Badge variant="outline" className="border-slate-300 text-slate-600 bg-slate-50 text-[10px]">
              スキップなし
            </Badge>
          )}
          {skipLogs.length > 0 && (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px]">
              <ShieldCheck className="h-3 w-3 mr-1" />
              現調省略済
            </Badge>
          )}
        </div>

        {/* スキップ履歴 */}
        {skipLogs.length > 0 && (
          <div className="space-y-2">
            {skipLogs.map((log) => {
              const reasonDef = SKIP_REASONS.find(r => r.value === log.reason);
              return (
                <div key={log.id} className="flex items-center justify-between gap-2 text-sm border rounded-md p-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${reasonDef?.color ?? "bg-slate-100 text-slate-800"}`}>
                      {log.reason}
                    </Badge>
                    {log.reasonDetail && (
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">{log.reasonDetail}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {log.decidedByName} ・ {new Date(log.createdAt!).toLocaleDateString("ja-JP")}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* スキップ登録ボタン */}
        {canSkip && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setDialogOpen(true)}
            >
              <SkipForward className="h-3.5 w-3.5 mr-1" />
              現調スキップを記録
            </Button>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>現調スキップ記録</DialogTitle>
                <DialogDescription>
                  現場調査を省略する理由を選択してください。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-2">
                  {SKIP_REASONS.map((reason) => (
                    <Button
                      key={reason.value}
                      variant={selectedReason === reason.value ? "default" : "outline"}
                      size="sm"
                      className="text-xs justify-start"
                      onClick={() => setSelectedReason(reason.value)}
                    >
                      {reason.label}
                    </Button>
                  ))}
                </div>
                {selectedReason === "その他" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">詳細理由</Label>
                    <Textarea
                      value={reasonDetail}
                      onChange={(e) => setReasonDetail(e.target.value)}
                      placeholder="スキップ理由の詳細を入力..."
                      rows={2}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSubmit} disabled={!selectedReason || createSkip.isPending}>
                  {createSkip.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  記録する
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}


// ============================================================
// Partner Notes Card (協力業者作業メモ)
// ============================================================
function PartnerNotesCard({ caseId, partnerNotes, partnerNotesUpdatedAt, partnerNotesUpdatedBy, isPartner, onUpdated }: {
  caseId: number;
  partnerNotes: string;
  partnerNotesUpdatedAt: Date | string | null;
  partnerNotesUpdatedBy: string | null;
  isPartner: boolean;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(partnerNotes);
  const [saving, setSaving] = useState(false);

  // Sync value when partnerNotes changes externally
  useEffect(() => {
    if (!editing) setValue(partnerNotes);
  }, [partnerNotes, editing]);

  const updateMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("作業メモを保存しました");
      setEditing(false);
      setSaving(false);
      onUpdated();
    },
    onError: () => {
      toast.error("保存に失敗しました");
      setSaving(false);
    },
  });

  const handleSave = () => {
    setSaving(true);
    updateMutation.mutate({ id: caseId, data: { partnerNotes: value || null } as any });
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif-jp font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            協力業者 作業メモ
          </h3>
          {isPartner && !editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              編集
            </Button>
          )}
          {isPartner && editing && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(partnerNotes); }}>
                キャンセル
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" />
                保存
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="現場の状況や作業内容をメモしてください..."
            rows={5}
            className="resize-y"
          />
        ) : (
          <div className="text-sm whitespace-pre-wrap min-h-[40px] p-3 rounded-md bg-muted/30 border">
            {partnerNotes || <span className="text-muted-foreground italic">メモなし</span>}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {isPartner
              ? "現場の状況や作業内容をここに記録できます。管理者にもリアルタイムで共有されます。"
              : "協力業者が記録した現場メモです。"}
          </span>
          {partnerNotesUpdatedAt && (
            <span className="text-[10px] text-muted-foreground/70">
              最終更新: {new Date(partnerNotesUpdatedAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              {partnerNotesUpdatedBy && <> / {partnerNotesUpdatedBy}</>}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
