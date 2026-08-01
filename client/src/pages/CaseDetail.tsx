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
            {!isPartner && (
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
            <TabsTrigger value="estimates" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
              <Receipt className="h-3.5 w-3.5" />
              見積書
            </TabsTrigger>
            <TabsTrigger value="profit" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
              <Wallet className="h-3.5 w-3.5" />
              収支
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
              <Receipt className="h-3.5 w-3.5" />
              経費
            </TabsTrigger>
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
            {(caseData as any).storeId && (
              <TabsTrigger value="storeHistory" className="flex-none px-3 py-2 text-sm whitespace-nowrap">
                <Building2 className="h-3.5 w-3.5" />
                店舗履歴
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="info">
          <InfoTab caseData={caseData} onUpdated={() => utils.cases.get.invalidate({ id })} isPartner={isPartner} />
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
          {activeTab === "estimates" && <EstimatesTab caseId={id} partnerToken={caseData.partnerToken} />}
        </TabsContent>

        <TabsContent value="profit">
          {activeTab === "profit" && <ProfitTab caseData={caseData} onUpdated={() => utils.cases.get.invalidate({ id })} isPartner={isPartner} />}
        </TabsContent>

        <TabsContent value="expenses">
          {activeTab === "expenses" && <ExpensesTab caseId={id} />}
        </TabsContent>

        <TabsContent value="schedule">
          {activeTab === "schedule" && <ScheduleTab caseId={id} caseData={caseData} />}
        </TabsContent>

        <TabsContent value="documents">
          {activeTab === "documents" && <DocumentsTab caseId={id} caseData={caseData} />}
        </TabsContent>

        <TabsContent value="history">
          {activeTab === "history" && <StatusHistoryTab caseId={id} />}
        </TabsContent>

        {!isPartner && (caseData as any).storeId && (
          <TabsContent value="storeHistory">
            {activeTab === "storeHistory" && <StoreHistoryTab storeId={(caseData as any).storeId} currentCaseId={id} />}
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
}: {
  caseData: Case;
  onUpdated: () => void;
  isPartner?: boolean;
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
            {!isPartner && (
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

      {/* 協力業者作業メモ欄 */}
      <PartnerNotesCard caseId={caseData.id} partnerNotes={(caseData as any).partnerNotes ?? ""} partnerNotesUpdatedAt={(caseData as any).partnerNotesUpdatedAt ?? null} partnerNotesUpdatedBy={(caseData as any).partnerNotesUpdatedBy ?? null} isPartner={isPartner} onUpdated={onUpdated} />

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
      {/* 再訪記録カード */}
      <RevisitCard caseId={caseData.id} revisitCount={(caseData as any).revisitCount ?? 0} onUpdated={onUpdated} />
      {/* 現調スキップカード */}
      {!isPartner && (
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
  // ビュー切替: grid | timeline
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");
  // 一括選択
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const bulkUpdateMutation = trpc.photos.bulkUpdateType.useMutation({ onSuccess: () => { onUpdated(); setSelectedIds(new Set()); setSelectionMode(false); toast.success("区分を一括変更しました"); } });

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

      {/* View Controls */}
      {photos.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "" : "bg-background"}
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1" />
              グリッド
            </Button>
            <Button
              variant={viewMode === "timeline" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("timeline")}
              className={viewMode === "timeline" ? "" : "bg-background"}
            >
              <Clock className="h-3.5 w-3.5 mr-1" />
              タイムライン
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }}
              className={selectionMode ? "" : "bg-background"}
            >
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              {selectionMode ? "選択中" : "一括選択"}
            </Button>
            {selectionMode && (
              <>
                <Button variant="outline" size="sm" className="bg-background" onClick={() => setSelectedIds(new Set(photos.map(p => p.id)))}>全選択</Button>
                <Button variant="outline" size="sm" className="bg-background" onClick={() => setSelectedIds(new Set())}>解除</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{selectedIds.size}枚選択中</span>
            <span className="text-xs text-muted-foreground">→ 区分を変更:</span>
            {PHOTO_TYPES.map((t) => (
              <Button
                key={t}
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background"
                disabled={bulkUpdateMutation.isPending}
                onClick={() => bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), photoType: t })}
              >
                {t}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      {photos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center flex flex-col items-center gap-3">
            <ImageIcon className="h-10 w-10 text-muted-foreground/70" />
            <p className="font-medium">まだ写真がありません</p>
            <p className="text-sm text-muted-foreground max-w-sm">現地写真をアップロードすると、現調・施工写真として台帳に反映されます。</p>
          </CardContent>
        </Card>
      ) : viewMode === "timeline" ? (
        /* Timeline View - grouped by date */
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
          {(() => {
            const processPhotos = photos
              .filter(p => p.photoType === "施工中")
              .sort((a, b) => {
                if (!a.takenAt && !b.takenAt) return 0;
                if (!a.takenAt) return 1;
                if (!b.takenAt) return -1;
                return new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime();
              });
            if (processPhotos.length === 0) {
              return (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  施工中写真がありません。<br />
                  施工中写真をアップロードすると、時系列で工程を確認できます。
                </div>
              );
            }
            // Group by date
            const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
            const grouped: { dateKey: string; dateLabel: string; photos: typeof processPhotos }[] = [];
            const groupMap = new Map<string, typeof processPhotos>();
            for (const p of processPhotos) {
              let dateKey: string;
              if (p.takenAt) {
                const d = new Date(p.takenAt);
                dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
              } else {
                dateKey = "unknown";
              }
              if (!groupMap.has(dateKey)) groupMap.set(dateKey, []);
              groupMap.get(dateKey)!.push(p);
            }
            groupMap.forEach((gPhotos, dateKey) => {
              let dateLabel: string;
              if (dateKey === "unknown") {
                dateLabel = "日時不明";
              } else {
                const d = new Date(gPhotos[0].takenAt!);
                dateLabel = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
              }
              grouped.push({ dateKey, dateLabel, photos: gPhotos });
            });
            return grouped.map((group, gi) => (
              <div key={group.dateKey} className={`relative ${gi < grouped.length - 1 ? "mb-8" : ""}`}>
                {/* Date node */}
                <div className="absolute -left-[26px] top-0 w-5 h-5 rounded-full bg-primary border-2 border-background shadow flex items-center justify-center">
                  <span className="text-[8px] text-primary-foreground font-bold">
                    {group.dateKey === "unknown" ? "?" : new Date(group.photos[0].takenAt!).getDate()}
                  </span>
                </div>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-foreground">{group.dateLabel}</h4>
                  <Badge variant="outline" className="text-[10px]">{group.photos.length}枚</Badge>
                  {gi > 0 && grouped[gi-1].dateKey !== "unknown" && group.dateKey !== "unknown" && (() => {
                    const prevDate = new Date(grouped[gi-1].photos[0].takenAt!);
                    const currDate = new Date(group.photos[0].takenAt!);
                    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
                    return diffDays > 0 ? (
                      <span className="text-[10px] text-muted-foreground">← {diffDays}日後</span>
                    ) : null;
                  })()}
                </div>
                {/* Photos grid within the date group */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {group.photos.map((p) => (
                    <Card key={p.id} className={`overflow-hidden transition-all ${selectionMode && selectedIds.has(p.id) ? "ring-2 ring-primary" : ""}`}>
                      <div className="relative">
                        {selectionMode && (
                          <div className="absolute top-1 left-1 z-10">
                            <Checkbox
                              checked={selectedIds.has(p.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedIds);
                                checked ? next.add(p.id) : next.delete(p.id);
                                setSelectedIds(next);
                              }}
                              className="bg-white/90 border-white shadow"
                            />
                          </div>
                        )}
                        <div className="aspect-square bg-muted">
                          <img
                            src={p.fileUrl}
                            alt=""
                            className="w-full h-full object-cover cursor-zoom-in"
                            style={{ transform: p.rotation ? `rotate(${p.rotation}deg)` : undefined }}
                            onClick={() => lightbox.open(photos.indexOf(p))}
                          />
                        </div>
                      </div>
                      <div className="p-2">
                        <span className="text-[10px] text-muted-foreground">
                          {p.takenAt ? new Date(p.takenAt).toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </span>
                        {p.workItem && <p className="text-xs mt-0.5 truncate font-medium">{p.workItem}</p>}
                        {p.memo && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.memo}</p>}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p, i) => (
            <div key={p.id} className="relative">
              {selectionMode && (
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      checked ? next.add(p.id) : next.delete(p.id);
                      setSelectedIds(next);
                    }}
                    className="bg-white/90 border-white shadow"
                  />
                </div>
              )}
              <div className={selectionMode && selectedIds.has(p.id) ? "ring-2 ring-primary rounded-lg" : ""}>
                <PhotoCard
                  photo={p}
                  onOpen={() => lightbox.open(i)}
                  onUpdate={(data) => updateMutation.mutate({ id: p.id, ...data })}
                  onDelete={() => {
                    if (confirm("この写真を削除します。よろしいですか？")) {
                      deleteMutation.mutate({ id: p.id });
                    }
                  }}
                />
              </div>
            </div>
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
    takenAt?: Date | string | null;
  };
  onUpdate: (data: {
    photoType?: typeof PHOTO_TYPES[number];
    workCategory?: string | null;
    workItem?: string | null;
    memo?: string | null;
    rotation?: number;
    takenAt?: number | null;
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
        {photo.takenAt && (
          <div className="pt-1 border-t">
            <Label className="text-[10px] text-muted-foreground">撮影日時</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(photo.takenAt).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        )}
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

function ProfitTab({ caseData, onUpdated, isPartner = false }: { caseData: Case; onUpdated: () => void; isPartner?: boolean }) {
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
  // 管理費・現場経費入力
  const [mgmtFee, setMgmtFee] = useState<string>(caseData.managementFee != null ? String(caseData.managementFee) : "");
  const [siteExp, setSiteExp] = useState<string>(caseData.siteExpense != null ? String(caseData.siteExpense) : "");
  const [ownSurvey, setOwnSurvey] = useState<string>(caseData.ownSurveyCost != null ? String(caseData.ownSurveyCost) : "");
  const [partnerSurvey, setPartnerSurvey] = useState<string>(caseData.partnerSurveyCost != null ? String(caseData.partnerSurveyCost) : "");
  const [transport, setTransport] = useState<string>(caseData.transportCost != null ? String(caseData.transportCost) : "");
  const [labor, setLabor] = useState<string>(caseData.laborCost != null ? String(caseData.laborCost) : "");

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
    const toNum = (s: string) => s.trim() === "" ? null : Number(s);
    saveMutation.mutate({
      id: caseData.id,
      data: {
        plenusQuoteAmount: plenus,
        estimatedCost: vendor,
        is10mYen: (plenus ?? 0) >= 100000,
        managementFee: toNum(mgmtFee),
        siteExpense: toNum(siteExp),
        ownSurveyCost: toNum(ownSurvey),
        partnerSurveyCost: toNum(partnerSurvey),
        transportCost: toNum(transport),
        laborCost: toNum(labor),
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

  // 管理費・現場経費の合計
  const overheadTotal = [mgmtFee, siteExp, ownSurvey, partnerSurvey, transport, labor]
    .reduce((sum, v) => sum + (v.trim() === "" ? 0 : Number(v) || 0), 0);

  // 原価 = 協力業者見積額 + 経費合計 + 管理費・現場経費
  const cost = (vendorAmount ?? 0) + expensesTotal + overheadTotal;
  const grossProfit = sales - cost;
  const grossMargin = sales > 0 ? grossProfit / sales : 0;

  const dirty =
    plenusInput !== (caseData.plenusQuoteAmount != null ? String(caseData.plenusQuoteAmount) : "") ||
    vendorInput !== (caseData.estimatedCost != null ? String(caseData.estimatedCost) : "") ||
    mgmtFee !== (caseData.managementFee != null ? String(caseData.managementFee) : "") ||
    siteExp !== (caseData.siteExpense != null ? String(caseData.siteExpense) : "") ||
    ownSurvey !== (caseData.ownSurveyCost != null ? String(caseData.ownSurveyCost) : "") ||
    partnerSurvey !== (caseData.partnerSurveyCost != null ? String(caseData.partnerSurveyCost) : "") ||
    transport !== (caseData.transportCost != null ? String(caseData.transportCost) : "") ||
    labor !== (caseData.laborCost != null ? String(caseData.laborCost) : "");

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

          <div className={`grid ${isPartner ? 'grid-cols-1' : 'sm:grid-cols-2'} gap-4`}>
            {!isPartner && (
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
            )}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{isPartner ? '見積金額' : '協力業者の見積金額・原価'}</Label>
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

          {/* 管理費・現場経費入力 */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              管理費・現場経費
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">自社管理費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={mgmtFee} onChange={(e) => setMgmtFee(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">現場経費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={siteExp} onChange={(e) => setSiteExp(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">自社現調費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={ownSurvey} onChange={(e) => setOwnSurvey(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">パートナー現調費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={partnerSurvey} onChange={(e) => setPartnerSurvey(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">交通費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={transport} onChange={(e) => setTransport(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">人件費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={labor} onChange={(e) => setLabor(e.target.value)} />
                </div>
              </div>
            </div>
            {overheadTotal > 0 && (
              <div className="text-xs text-muted-foreground mt-2 text-right">
                管理費・現場経費 小計: <span className="font-medium text-foreground">{yen(overheadTotal)}</span>
              </div>
            )}
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

          <div className={`grid ${isPartner ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'} gap-3`}>
            {!isPartner && (
            <div className="rounded-md border p-3 bg-blue-50 border-blue-200">
              <div className="text-xs text-blue-700 mb-1">売上・プレナス提出額</div>
              <div className="text-xl font-semibold tracking-tight">{yen(sales)}</div>
              {salesIsEstimated && (
                <div className="text-[11px] text-blue-700/80 mt-1">未入力のため協力業者額から想定 ÷0.75</div>
              )}
            </div>
            )}
            <div className="rounded-md border p-3 bg-emerald-50 border-emerald-200">
              <div className="text-xs text-emerald-700 mb-1">{isPartner ? '見積額' : '協力業者見積額'}</div>
              <div className="text-xl font-semibold tracking-tight">{yen(vendorAmount)}</div>
            </div>
            <div className="rounded-md border p-3 bg-amber-50 border-amber-200">
              <div className="text-xs text-amber-700 mb-1">経費・領収書</div>
              <div className="text-xl font-semibold tracking-tight">{yen(expensesTotal)}</div>
              {!isPartner && <div className="text-[11px] text-amber-700/80 mt-1">原価計: {yen(cost)}</div>}
            </div>
            {overheadTotal > 0 && (
              <div className="rounded-md border p-3 bg-orange-50 border-orange-200">
                <div className="text-xs text-orange-700 mb-1">管理費・現場経費</div>
                <div className="text-xl font-semibold tracking-tight">{yen(overheadTotal)}</div>
              </div>
            )}
            {!isPartner && (
            <div className={`rounded-md border p-3 ${grossProfit >= 0 ? "bg-violet-50 border-violet-200" : "bg-red-50 border-red-200"}`}>
              <div className="text-xs mb-1 text-muted-foreground">粗利・売上−原価</div>
              <div className={`text-xl font-semibold tracking-tight ${grossProfit >= 0 ? "text-violet-700" : "text-red-700"}`}>
                {yen(grossProfit)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                粗利率 {(grossMargin * 100).toFixed(1)}%
              </div>
            </div>
            )}
          </div>

          {!isPartner && (
          <div className="text-xs text-muted-foreground space-y-1 leading-relaxed pt-2 border-t">
            <div>・売上：プレナスへ提出した見積金額。未入力時は協力業者額から想定表示</div>
            <div>・原価：協力業者見積額 ＋ 領収書経費 ＋ 管理費・現場経費</div>
            <div>・粗利・粗利率は金額を保存すると即時に反映されます</div>
          </div>
          )}
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
  const addMutation = trpc.expenses.bulkSave.useMutation({
    onSuccess: () => {
      utils.expenses.listByCase.invalidate({ caseId });
      utils.cases.get.invalidate({ id: caseId });
      toast.success("原価を登録しました");
      setShowAddForm(false);
      setAddVendor(""); setAddAmount(""); setAddCategory("その他"); setAddDate(""); setAddNote("");
    },
    onError: (e) => toast.error(e.message),
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addVendor, setAddVendor] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addCategory, setAddCategory] = useState<string>("その他");
  const [addDate, setAddDate] = useState("");
  const [addNote, setAddNote] = useState("");
  const CATEGORIES = ["材料費", "外注費", "交通費", "消耗品", "車両費", "宿泊費", "接待交際費", "人件費", "現調費", "その他"];
  const handleAddExpense = () => {
    const amt = Number(addAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("金額を正しく入力してください"); return; }
    addMutation.mutate({
      items: [{
        caseId,
        vendorName: addVendor || null,
        amount: amt,
        expenseDate: addDate || null,
        category: addCategory as any,
        note: addNote || null,
      }],
    });
  };

  const yen = (n: number | null | undefined) =>
    n != null ? `¥${Math.round(n).toLocaleString()}` : "—";

  const total = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* 原価手入力フォーム */}
      {showAddForm && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">原価を手入力</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">支払先・業者名</Label>
                <Input placeholder="例: 自社、○○建設" value={addVendor} onChange={(e) => setAddVendor(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">金額（税込）</Label>
                <Input type="number" placeholder="例: 15000" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">区分</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={addCategory} onChange={(e) => setAddCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">日付</Label>
                <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">摘要・メモ</Label>
              <Input placeholder="例: 現場調査交通費、パートナー現調費" value={addNote} onChange={(e) => setAddNote(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>キャンセル</Button>
              <Button size="sm" onClick={handleAddExpense} disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                登録
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">経費一覧</h3>
              <Badge variant="outline">{expenses.length}件</Badge>
            </div>
            <div className="flex items-center gap-3">
              {!showAddForm && (
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />原価入力
                </Button>
              )}
              <div className="text-sm">
                合計:{" "}
                <span className="font-semibold tabular-nums text-base">
                  {yen(total)}
                </span>
              </div>
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
                    <th className="text-left px-3 py-2 font-medium">入力者</th>
                    <th className="text-left px-3 py-2 font-medium">入力日時</th>
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
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {(e as any).createdByName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {e.createdAt
                          ? new Date(e.createdAt as any).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "—"}
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


// ─── Schedule Tab (工程管理ガントチャート) ─────────────────────────────────────
function ScheduleTab({ caseId, caseData }: { caseId: number; caseData: any }) {
  const utils = trpc.useUtils();
  const { data: schedules = [], isLoading } = trpc.schedules.listByCase.useQuery({ caseId });
  const createMut = trpc.schedules.create.useMutation({
    onSuccess: () => { utils.schedules.listByCase.invalidate({ caseId }); toast.success("工程を追加しました"); },
  });
  const updateMut = trpc.schedules.update.useMutation({
    onSuccess: () => { utils.schedules.listByCase.invalidate({ caseId }); },
  });
  const deleteMut = trpc.schedules.delete.useMutation({
    onSuccess: () => { utils.schedules.listByCase.invalidate({ caseId }); toast.success("工程を削除しました"); },
  });

  // ICSカレンダーフィード
  const { data: feedData } = trpc.schedules.getCaseCalendarFeedToken.useQuery({ caseId });
  const generateFeedMut = trpc.schedules.generateCaseCalendarFeedToken.useMutation({
    onSuccess: () => { utils.schedules.getCaseCalendarFeedToken.invalidate({ caseId }); },
  });
  const [showCalendarPanel, setShowCalendarPanel] = useState(false);

  // Export
  const scheduleExportRef = useRef<HTMLDivElement>(null);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);

  const handleExportImage = async () => {
    if (!scheduleExportRef.current) return;
    setExportingImage(true);
    try {
      // Show export header temporarily
      const header = scheduleExportRef.current.querySelector('.export-header') as HTMLElement;
      if (header) header.style.display = 'block';
      const canvas = await html2canvas(scheduleExportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      if (header) header.style.display = 'none';
      const link = document.createElement("a");
      link.download = `工程表_${caseData?.storeName || caseId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("画像をダウンロードしました");
    } catch (e) {
      toast.error("エクスポートに失敗しました");
    } finally {
      setExportingImage(false);
    }
  };

  // Templates
  const { data: templates } = trpc.scheduleTemplates.list.useQuery();
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const saveTemplateMut = trpc.scheduleTemplates.saveFromCase.useMutation({
    onSuccess: () => {
      utils.scheduleTemplates.list.invalidate();
      setShowSaveTemplate(false);
      setTemplateName("");
      toast.success("テンプレートを保存しました");
    },
  });
  const applyTemplateMut = trpc.scheduleTemplates.applyToCase.useMutation({
    onSuccess: () => {
      utils.schedules.listByCase.invalidate({ caseId });
      setShowTemplatePanel(false);
      toast.success("テンプレートを適用しました");
    },
  });
  const deleteTemplateMut = trpc.scheduleTemplates.delete.useMutation({
    onSuccess: () => { utils.scheduleTemplates.list.invalidate(); },
  });

  // AI工程提案
  const suggestMut = trpc.schedules.suggestSchedules.useMutation();
  const [suggestions, setSuggestions] = useState<Array<{ title: string; startDate: string; endDate: string; color: string; memo: string }> | null>(null);
  const [suggestReasoning, setSuggestReasoning] = useState<string>("");

  const handleSuggest = async () => {
    try {
      const result = await suggestMut.mutateAsync({ caseId });
      setSuggestions(result.schedules);
      setSuggestReasoning(result.reasoning);
    } catch (e: any) {
      toast.error(e.message || "AI提案に失敗しました");
    }
  };

  const handleApplySuggestions = async () => {
    if (!suggestions) return;
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      await createMut.mutateAsync({
        caseId,
        title: s.title,
        startDate: s.startDate,
        endDate: s.endDate,
        color: s.color,
        memo: s.memo,
        status: "予定",
        progress: 0,
        orderNo: i,
      });
    }
    setSuggestions(null);
    setSuggestReasoning("");
    toast.success("工程を登録しました");
  };

  const feedUrl = feedData?.token
    ? `${window.location.origin}/api/calendar/feed/${feedData.token}.ics`
    : null;

  const googleCalendarSubscribeUrl = feedUrl
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl.replace(/^https?:\/\//, ""))}`
    : null;

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", startDate: "", endDate: "", status: "予定" as "予定" | "進行中" | "完了", color: "#3b82f6", memo: "", progress: 0 });

  const STATUS_COLORS_SCHEDULE: Record<string, string> = {
    "予定": "bg-slate-100 text-slate-700",
    "進行中": "bg-blue-100 text-blue-700",
    "完了": "bg-emerald-100 text-emerald-700",
  };

  const PRESET_COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6"];

  // Gantt chart date range calculation
  const ganttData = useMemo(() => {
    if (schedules.length === 0) return null;
    const allDates = schedules.flatMap(s => [s.startDate, s.endDate]);
    const minDate = allDates.reduce((a, b) => a < b ? a : b);
    const maxDate = allDates.reduce((a, b) => a > b ? a : b);
    // Extend range by 1 day on each side
    const start = new Date(minDate);
    start.setDate(start.getDate() - 1);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 1);
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    return { start, end, totalDays };
  }, [schedules]);

  // Drag state for gantt bars
  const [drag, setDrag] = useState<{
    id: number;
    mode: "move" | "resize-start" | "resize-end";
    startX: number;
    origStartDate: string;
    origEndDate: string;
    containerWidth: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ startDate: string; endDate: string } | null>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  function dateToDayOffset(dateStr: string, ganttStart: Date) {
    return Math.round((new Date(dateStr).getTime() - ganttStart.getTime()) / 86400000);
  }
  function dayOffsetToDate(offset: number, ganttStart: Date) {
    const d = new Date(ganttStart);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  }

  const handleDragStart = useCallback((e: React.PointerEvent | React.MouseEvent, id: number, mode: "move" | "resize-start" | "resize-end", startDate: string, endDate: string) => {
    e.preventDefault();
    e.stopPropagation();
    const container = ganttContainerRef.current;
    if (!container) return;
    const ganttArea = container.querySelector('[data-gantt-area]') as HTMLElement;
    if (!ganttArea) return;
    const containerWidth = ganttArea.getBoundingClientRect().width;
    const clientX = 'clientX' in e ? e.clientX : 0;
    setDrag({ id, mode, startX: clientX, origStartDate: startDate, origEndDate: endDate, containerWidth });
    setDragPreview({ startDate, endDate });
    // Capture pointer for touch support
    if ('pointerId' in e && (e as React.PointerEvent).pointerId) {
      (e.currentTarget as HTMLElement).setPointerCapture((e as React.PointerEvent).pointerId);
    }
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    if (!drag || !ganttData) return;
    const clientX = 'clientX' in e ? e.clientX : 0;
    const deltaX = clientX - drag.startX;
    const deltaDays = Math.round((deltaX / drag.containerWidth) * ganttData.totalDays);
    if (deltaDays === 0 && dragPreview?.startDate === drag.origStartDate) return;

    let newStart = drag.origStartDate;
    let newEnd = drag.origEndDate;

    if (drag.mode === "move") {
      const origStartOffset = dateToDayOffset(drag.origStartDate, ganttData.start);
      const origEndOffset = dateToDayOffset(drag.origEndDate, ganttData.start);
      newStart = dayOffsetToDate(origStartOffset + deltaDays, ganttData.start);
      newEnd = dayOffsetToDate(origEndOffset + deltaDays, ganttData.start);
    } else if (drag.mode === "resize-start") {
      const origStartOffset = dateToDayOffset(drag.origStartDate, ganttData.start);
      const newOffset = Math.min(origStartOffset + deltaDays, dateToDayOffset(drag.origEndDate, ganttData.start));
      newStart = dayOffsetToDate(newOffset, ganttData.start);
      newEnd = drag.origEndDate;
    } else if (drag.mode === "resize-end") {
      const origEndOffset = dateToDayOffset(drag.origEndDate, ganttData.start);
      const newOffset = Math.max(origEndOffset + deltaDays, dateToDayOffset(drag.origStartDate, ganttData.start));
      newStart = drag.origStartDate;
      newEnd = dayOffsetToDate(newOffset, ganttData.start);
    }
    setDragPreview({ startDate: newStart, endDate: newEnd });
  }, [drag, ganttData, dragPreview]);

  const handleDragEnd = useCallback(() => {
    if (!drag || !dragPreview) { setDrag(null); setDragPreview(null); return; }
    if (dragPreview.startDate !== drag.origStartDate || dragPreview.endDate !== drag.origEndDate) {
      updateMut.mutate({ id: drag.id, startDate: dragPreview.startDate, endDate: dragPreview.endDate });
    }
    setDrag(null);
    setDragPreview(null);
  }, [drag, dragPreview, updateMut]);

  function handleSubmit() {
    if (!form.title || !form.startDate || !form.endDate) {
      toast.error("工程名・開始日・終了日は必須です");
      return;
    }
    if (form.startDate > form.endDate) {
      toast.error("終了日は開始日以降にしてください");
      return;
    }
    if (editId) {
      updateMut.mutate({ id: editId, ...form });
      setEditId(null);
    } else {
      createMut.mutate({ caseId, ...form });
    }
    setShowForm(false);
    setForm({ title: "", startDate: "", endDate: "", status: "予定", color: "#3b82f6", memo: "", progress: 0 });
  }

  function startEdit(s: typeof schedules[0]) {
    setEditId(s.id);
    setForm({ title: s.title, startDate: s.startDate, endDate: s.endDate, status: s.status as "予定" | "進行中" | "完了", color: s.color || "#3b82f6", memo: s.memo || "", progress: s.progress ?? 0 });
    setShowForm(true);
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">工程スケジュール</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplatePanel(!showTemplatePanel)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="テンプレート"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">テンプレート</span>
          </button>
          {schedules.length > 0 && (
            <button
              onClick={() => setShowSaveTemplate(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              title="現在の工程をテンプレートとして保存"
            >
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">保存</span>
            </button>
          )}
          <button
            onClick={handleSuggest}
            disabled={suggestMut.isPending}
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50 transition-colors"
            title="AIが工程表を提案"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{suggestMut.isPending ? "提案中..." : "AI提案"}</span>
          </button>
          {schedules.length > 0 && (
            <button
              onClick={handleExportImage}
              disabled={exportingImage}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="画像でダウンロード"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{exportingImage ? "出力中..." : "エクスポート"}</span>
            </button>
          )}
          {schedules.length > 0 && (
            <button
              onClick={() => setShowExportPreview(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              title="PDFプレビュー"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          )}
          <button
            onClick={() => setShowCalendarPanel(!showCalendarPanel)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="カレンダー連動"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">カレンダー連動</span>
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ title: "", startDate: "", endDate: "", status: "予定", color: "#3b82f6", memo: "", progress: 0 }); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {showForm ? "キャンセル" : "+ 工程を追加"}
          </button>
        </div>
      </div>

      {/* Template Panel */}
      {showTemplatePanel && (
        <Card className="p-4 border-blue-200 bg-blue-50/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-medium text-blue-900">工程テンプレート</h4>
              </div>
              <button onClick={() => setShowTemplatePanel(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            {(!templates || templates.length === 0) ? (
              <p className="text-xs text-muted-foreground">保存済みのテンプレートはありません。工程を作成後「保存」ボタンでテンプレート化できます。</p>
            ) : (
              <div className="space-y-2">
                {templates.map((tpl) => {
                  const items = JSON.parse(tpl.items) as Array<{ title: string; durationDays: number; color: string }>;
                  return (
                    <div key={tpl.id} className="flex items-center gap-2 p-2 rounded-md border bg-white hover:bg-blue-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{tpl.name}</p>
                        <p className="text-[10px] text-muted-foreground">{items.length}工程・合計{items.reduce((s, i) => s + i.durationDays, 0)}日間</p>
                      </div>
                      <button
                        onClick={() => {
                          const startDate = new Date().toISOString().slice(0, 10);
                          applyTemplateMut.mutate({ templateId: tpl.id, caseId, startDate });
                        }}
                        disabled={applyTemplateMut.isPending}
                        className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        適用
                      </button>
                      <button
                        onClick={() => { if (confirm("このテンプレートを削除しますか？")) deleteTemplateMut.mutate({ id: tpl.id }); }}
                        className="text-[10px] px-1.5 py-1 text-destructive hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Save Template Dialog */}
      {showSaveTemplate && (
        <Card className="p-4 border-green-200 bg-green-50/50">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-green-900">現在の工程をテンプレートとして保存</h4>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="テンプレート名（例: サッシ修理5工程セット）"
              className="w-full text-xs border rounded-md px-3 py-2 bg-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveTemplateMut.mutate({ caseId, name: templateName })}
                disabled={!templateName.trim() || saveTemplateMut.isPending}
                className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {saveTemplateMut.isPending ? "保存中..." : "保存"}
              </button>
              <button onClick={() => { setShowSaveTemplate(false); setTemplateName(""); }} className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted">キャンセル</button>
            </div>
          </div>
        </Card>
      )}

      {/* AI Suggestion Panel */}
      {suggestions && (
        <Card className="p-4 border-amber-200 bg-amber-50/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <h4 className="text-sm font-medium text-amber-900">AI工程提案 <span className="text-[10px] font-normal text-amber-600">(クリックで編集可能)</span></h4>
              </div>
              <button
                onClick={() => { setSuggestions(null); setSuggestReasoning(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                閉じる
              </button>
            </div>
            {suggestReasoning && (
              <p className="text-xs text-amber-700 bg-amber-100/50 p-2 rounded">{suggestReasoning}</p>
            )}
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="p-2.5 bg-white rounded border border-amber-100 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={s.color}
                      onChange={(e) => {
                        const updated = [...suggestions];
                        updated[i] = { ...updated[i], color: e.target.value };
                        setSuggestions(updated);
                      }}
                      className="w-5 h-5 rounded border-0 cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={s.title}
                      onChange={(e) => {
                        const updated = [...suggestions];
                        updated[i] = { ...updated[i], title: e.target.value };
                        setSuggestions(updated);
                      }}
                      className="flex-1 text-xs font-medium bg-transparent border-b border-transparent hover:border-amber-200 focus:border-amber-400 focus:outline-none px-1 py-0.5"
                    />
                    <button
                      onClick={() => {
                        const updated = suggestions.filter((_, idx) => idx !== i);
                        setSuggestions(updated);
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="削除"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <input
                      type="date"
                      value={s.startDate}
                      onChange={(e) => {
                        const updated = [...suggestions];
                        updated[i] = { ...updated[i], startDate: e.target.value };
                        setSuggestions(updated);
                      }}
                      className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 focus:border-amber-400 focus:outline-none"
                    />
                    <span className="text-[10px] text-muted-foreground">〜</span>
                    <input
                      type="date"
                      value={s.endDate}
                      onChange={(e) => {
                        const updated = [...suggestions];
                        updated[i] = { ...updated[i], endDate: e.target.value };
                        setSuggestions(updated);
                      }}
                      className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div className="pl-7">
                    <input
                      type="text"
                      value={s.memo}
                      onChange={(e) => {
                        const updated = [...suggestions];
                        updated[i] = { ...updated[i], memo: e.target.value };
                        setSuggestions(updated);
                      }}
                      placeholder="メモ"
                      className="w-full text-[10px] text-amber-600 bg-transparent border-b border-transparent hover:border-amber-200 focus:border-amber-400 focus:outline-none px-1 py-0.5"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleApplySuggestions}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-md hover:bg-amber-700 transition-colors"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                この工程を登録
              </button>
              <button
                onClick={handleSuggest}
                disabled={suggestMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 text-amber-700 text-xs font-medium rounded-md hover:bg-amber-50 disabled:opacity-50 transition-colors"
              >
                <RotateCw className="h-3.5 w-3.5" />
                再提案
              </button>
              <button
                onClick={() => { setSuggestions(null); setSuggestReasoning(""); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Calendar Sync Panel */}
      {showCalendarPanel && (
        <Card className="p-4 border-blue-200 bg-blue-50/50">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-medium text-blue-900">カレンダー連動（ICS購読）</h4>
            </div>
            <p className="text-xs text-blue-700">
              この案件の工程スケジュールをGoogleカレンダーやAppleカレンダーに同期できます。工程の追加・変更は自動的に反映されます。
            </p>
            {!feedData?.token ? (
              <button
                onClick={() => generateFeedMut.mutate({ caseId })}
                disabled={generateFeedMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Calendar className="h-3.5 w-3.5" />
                {generateFeedMut.isPending ? "生成中..." : "購読URLを生成"}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={feedUrl || ""}
                    className="flex-1 text-[11px] px-2 py-1.5 bg-white border rounded font-mono truncate"
                  />
                  <button
                    onClick={() => {
                      if (feedUrl) {
                        navigator.clipboard.writeText(feedUrl).then(
                          () => toast.success("URLをコピーしました"),
                          () => toast.error("コピーに失敗しました")
                        );
                      }
                    }}
                    className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                    title="URLをコピー"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {googleCalendarSubscribeUrl && (
                    <a
                      href={googleCalendarSubscribeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-medium rounded-md hover:bg-blue-50 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Googleカレンダーに追加
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-blue-600/70">
                  ※ Googleカレンダーの反映は数時間かかる場合があります。AppleカレンダーやOutlookは上記URLを「照会」で追加してください。
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs">工程名</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例：現場調査、解体工事、仕上げ工事..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">開始日</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">終了日</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">ステータス</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="予定">予定</SelectItem>
                  <SelectItem value="進行中">進行中</SelectItem>
                  <SelectItem value="完了">完了</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">表示色</Label>
              <div className="flex gap-1.5 mt-1.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">進捗率: {form.progress}%</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.progress}
                  onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                  className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
                />
                <span className="text-xs font-medium w-10 text-right">{form.progress}%</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">メモ</Label>
              <Textarea
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                placeholder="備考..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {editId ? "更新" : "追加"}
            </button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {schedules.length === 0 && !showForm && (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium">工程が登録されていません</p>
            <p className="text-sm text-muted-foreground mt-1">「+ 工程を追加」から工程を登録すると、ガントチャートで進捗を確認できます。</p>
          </CardContent>
        </Card>
      )}

      {/* Export target wrapper */}
      <div ref={scheduleExportRef} className="schedule-export-area">
      {/* Export Header (visible in export) */}
      <div className="export-header hidden print:block" style={{ display: 'none' }}>
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-base font-bold text-gray-900 mb-1">工程表: {caseData?.storeName || ''} {caseData?.requestNumber || ''}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600">
            {caseData?.address && <span>現場: {caseData.address}</span>}
            {schedules.length > 0 && (
              <span>施工期間: {schedules.reduce((min: string, s: any) => s.startDate < min ? s.startDate : min, schedules[0].startDate)} 〜 {schedules.reduce((max: string, s: any) => s.endDate > max ? s.endDate : max, schedules[0].endDate)}</span>
            )}
            {caseData?.repairCategory && <span>工事区分: {caseData.repairCategory}</span>}
          </div>
        </div>
      </div>
      {/* Gantt Chart */}
      {schedules.length > 0 && ganttData && (
        <Card className="overflow-hidden">
          <div
            className="overflow-x-auto -webkit-overflow-scrolling-touch"
            ref={ganttContainerRef}
            onMouseMove={drag ? handleDragMove : undefined}
            onMouseUp={drag ? handleDragEnd : undefined}
            onMouseLeave={drag ? handleDragEnd : undefined}
            onPointerMove={drag ? handleDragMove : undefined}
            onPointerUp={drag ? handleDragEnd : undefined}
            style={{ WebkitOverflowScrolling: drag ? "auto" : "touch", touchAction: drag ? "none" : "auto" }}
          >
            <div className={`min-w-[480px] sm:min-w-[600px] ${drag ? "select-none" : ""}`}>
              {/* Date header */}
              <div className="flex border-b bg-muted/30">
                <div className="w-[120px] sm:w-[200px] flex-shrink-0 px-2 sm:px-3 py-2 text-[10px] font-medium text-muted-foreground border-r">
                  工程名
                </div>
                <div className="flex-1 relative" data-gantt-area>
                  <div className="flex">
                    {Array.from({ length: Math.min(ganttData.totalDays, 60) }, (_, i) => {
                      const d = new Date(ganttData.start);
                      d.setDate(d.getDate() + i);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isToday = d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
                      return (
                        <div
                          key={i}
                          className={`flex-1 min-w-[24px] text-center py-1 text-[9px] border-r border-border/50 ${isWeekend ? "bg-muted/50" : ""} ${isToday ? "bg-primary/10 font-bold" : ""}`}
                        >
                          <div className="text-muted-foreground">{d.getMonth() + 1}/{d.getDate()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Rows */}
              {schedules.map((s) => {
                // Use drag preview dates if this is the dragged item
                const isDragging = drag?.id === s.id;
                const displayStart = isDragging && dragPreview ? dragPreview.startDate : s.startDate;
                const displayEnd = isDragging && dragPreview ? dragPreview.endDate : s.endDate;
                const sStart = new Date(displayStart);
                const sEnd = new Date(displayEnd);
                const offsetDays = Math.max(0, Math.round((sStart.getTime() - ganttData.start.getTime()) / 86400000));
                const durationDays = Math.max(1, Math.round((sEnd.getTime() - sStart.getTime()) / 86400000) + 1);
                const leftPct = (offsetDays / ganttData.totalDays) * 100;
                const widthPct = (durationDays / ganttData.totalDays) * 100;
                return (
                  <div key={s.id} className="flex border-b last:border-b-0 hover:bg-muted/20 transition-colors group">
                    <div className="w-[120px] sm:w-[200px] flex-shrink-0 px-2 sm:px-3 py-2.5 border-r flex items-center gap-1.5 sm:gap-2">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || "#3b82f6" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] sm:text-xs font-medium truncate">{s.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge className={`text-[8px] sm:text-[9px] px-1 py-0 h-3.5 sm:h-4 ${STATUS_COLORS_SCHEDULE[s.status] || ""}`}>
                            {s.status}
                          </Badge>
                          {isDragging && dragPreview && (
                            <span className="text-[8px] sm:text-[9px] text-primary font-medium">
                              {dragPreview.startDate.slice(5)} 〜 {dragPreview.endDate.slice(5)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex gap-0.5 transition-opacity">
                        <button onClick={() => startEdit(s)} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                          <PenLine className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => { if (confirm("この工程を削除しますか？")) deleteMut.mutate({ id: s.id }); }}
                          className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 relative py-2" data-gantt-area>
                      {/* Today line */}
                      {(() => {
                        const todayOffset = Math.round((new Date().getTime() - ganttData.start.getTime()) / 86400000);
                        if (todayOffset >= 0 && todayOffset <= ganttData.totalDays) {
                          return <div className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10" style={{ left: `${(todayOffset / ganttData.totalDays) * 100}%` }} />;
                        }
                        return null;
                      })()}
                      {/* Bar with progress + drag handles */}
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-full shadow-sm overflow-hidden ${isDragging ? "h-6 ring-2 ring-primary/40 z-20" : "hover:h-6"} ${s.status === "完了" ? "opacity-80" : ""}`}
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(widthPct, 2)}%`,
                          backgroundColor: `color-mix(in srgb, ${s.color || "#3b82f6"} 30%, transparent)`,
                          transition: isDragging ? "none" : "all 0.15s ease-out",
                        }}
                        title={`${s.title}: ${displayStart} 〜 ${displayEnd} (進捗${s.progress}%)`}
                      >
                        {/* Progress fill */}
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${s.progress}%`,
                            backgroundColor: s.color || "#3b82f6",
                            transition: isDragging ? "none" : "all 0.3s",
                          }}
                        />
                        {/* Left resize handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-3 sm:w-2 cursor-ew-resize z-20 hover:bg-white/30 rounded-l-full"
                          onMouseDown={(e) => handleDragStart(e, s.id, "resize-start", s.startDate, s.endDate)}
                          onPointerDown={(e) => handleDragStart(e, s.id, "resize-start", s.startDate, s.endDate)}
                          style={{ touchAction: "none" }}
                        />
                        {/* Center move area */}
                        <div
                          className="absolute left-3 right-3 sm:left-2 sm:right-2 top-0 bottom-0 cursor-grab active:cursor-grabbing z-10"
                          onMouseDown={(e) => handleDragStart(e, s.id, "move", s.startDate, s.endDate)}
                          onPointerDown={(e) => handleDragStart(e, s.id, "move", s.startDate, s.endDate)}
                          style={{ touchAction: "none" }}
                        />
                        {/* Right resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-3 sm:w-2 cursor-ew-resize z-20 hover:bg-white/30 rounded-r-full"
                          onMouseDown={(e) => handleDragStart(e, s.id, "resize-end", s.startDate, s.endDate)}
                          onPointerDown={(e) => handleDragStart(e, s.id, "resize-end", s.startDate, s.endDate)}
                          style={{ touchAction: "none" }}
                        />
                        {/* Label with status icon (clickable to cycle status) */}
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-medium truncate px-3 z-[5] drop-shadow-sm gap-0.5">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-white/30 active:scale-90 transition-transform cursor-pointer z-30"
                            title="クリックでステータス切替（予定→進行中→完了）"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = s.status === "予定" ? "進行中" : s.status === "進行中" ? "完了" : "予定";
                              const prog = next === "完了" ? 100 : next === "進行中" ? 50 : 0;
                              updateMut.mutate({ id: s.id, status: next, progress: prog });
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {s.status === "完了" && "✓"}
                            {s.status === "進行中" && <span className="animate-pulse">▶</span>}
                            {s.status === "予定" && "○"}
                          </button>
                          {s.progress > 0 ? `${s.progress}%` : (durationDays > 2 ? `${durationDays}日` : "")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* List view (details) */}
      {schedules.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">工程一覧</h4>
          {schedules.map((s) => (
            <Card key={s.id} className="p-2.5 sm:p-3">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: s.color || "#3b82f6" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-xs sm:text-sm font-medium">{s.title}</span>
                    <Badge className={`text-[9px] sm:text-[10px] ${STATUS_COLORS_SCHEDULE[s.status] || ""}`}>{s.status}</Badge>
                    <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">{s.progress}%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${s.progress}%`, backgroundColor: s.color || "#3b82f6" }} />
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground w-8">{s.progress}%</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                    {s.startDate.replace(/-/g, "/")} 〜 {s.endDate.replace(/-/g, "/")}
                    <span className="ml-1 sm:ml-2">
                      ({Math.round((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 86400000) + 1}日間)
                    </span>
                  </p>
                  {s.memo && <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">{s.memo}</p>}
                </div>
                <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-1">
                  {s.status !== "完了" && (
                    <button
                      onClick={() => updateMut.mutate({ id: s.id, status: s.status === "予定" ? "進行中" : "完了" })}
                      className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                      title={s.status === "予定" ? "進行中にする" : "完了にする"}
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => startEdit(s)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <PenLine className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm("この工程を削除しますか？")) deleteMut.mutate({ id: s.id }); }}
                    className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>{/* end schedule-export-area */}

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        open={showExportPreview}
        onOpenChange={setShowExportPreview}
        containerRef={scheduleExportRef}
        fileName={`工程表_${caseId}`}
        pageSelector=".schedule-export-area"
      />
    </div>
  );
}


// ============================================================
// Documents Tab (図面・仕様書・資料)
// ============================================================
const DOCUMENT_CATEGORIES = ["図面", "仕様書", "見積書", "報告書", "写真", "その他"] as const;

function DocumentsTab({ caseId, caseData }: { caseId: number; caseData: any }) {
  const utils = trpc.useUtils();
  const { data: docs = [], isLoading } = trpc.documents.list.useQuery({ caseId });
  // Fetch shared documents that may be relevant to this case
  const { data: sharedDocs } = trpc.documents.listAll.useQuery({ scope: "shared", limit: 50 });
  // Fetch project folders linked to this case
  const { data: caseFolders } = trpc.projectFolders.listByCaseId.useQuery({ caseId });
  const folderIds = useMemo(() => (caseFolders || []).map((f: any) => f.id), [caseFolders]);
  const { data: folderDocs } = trpc.projectFolders.listDocumentsByFolders.useQuery(
    { folderIds },
    { enabled: folderIds.length > 0 }
  );
  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate({ caseId });
      toast.success("ファイルをアップロードしました");
      setUploading(false);
    },
    onError: (err) => {
      toast.error(`アップロード失敗: ${err.message}`);
      setUploading(false);
    },
  });
  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate({ caseId });
      toast.success("削除しました");
    },
  });
  const memoMutation = trpc.documents.updateMemo.useMutation({
    onSuccess: () => utils.documents.list.invalidate({ caseId }),
  });

  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = useMemo(() => {
    if (filterCategory === "all") return docs;
    return docs.filter((d) => d.category === filterCategory);
  }, [docs, filterCategory]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      // Auto-detect category from file name/type
      let category: typeof DOCUMENT_CATEGORIES[number] = "その他";
      const name = file.name.toLowerCase();
      if (name.includes("図面") || name.includes("drawing") || name.includes("plan")) category = "図面";
      else if (name.includes("仕様") || name.includes("spec")) category = "仕様書";
      else if (name.includes("見積") || name.includes("estimate")) category = "見積書";
      else if (name.includes("報告") || name.includes("report")) category = "報告書";
      else if (file.type.startsWith("image/")) category = "写真";

      await uploadMutation.mutateAsync({
        caseId,
        fileName: file.name,
        fileData: base64,
        mimeType: file.type,
        fileSize: file.size,
        category,
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getCategoryColor(cat: string) {
    switch (cat) {
      case "図面": return "bg-blue-100 text-blue-800";
      case "仕様書": return "bg-purple-100 text-purple-800";
      case "見積書": return "bg-green-100 text-green-800";
      case "報告書": return "bg-orange-100 text-orange-800";
      case "写真": return "bg-pink-100 text-pink-800";
      default: return "bg-gray-100 text-gray-800";
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: Upload + Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="カテゴリ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {DOCUMENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filteredDocs.length}件</span>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.zip,.txt"
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileUp className="h-4 w-4 mr-1" />}
            アップロード
          </Button>
        </div>
      </div>

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Folder className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>ドキュメントがありません</p>
            <p className="text-xs mt-1">図面・仕様書・資料をアップロードしてください</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-shrink-0">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{doc.fileName}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${getCategoryColor(doc.category)}`}>
                      {doc.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString("ja-JP")}</span>
                    {doc.memo && <span className="truncate max-w-[200px]">📝 {doc.memo}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => window.open(doc.fileUrl, "_blank")}
                    title="プレビュー / ダウンロード"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        title="削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>ファイルを削除</AlertDialogTitle>
                        <AlertDialogDescription>
                          「{doc.fileName}」を削除します。この操作は取り消せません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate({ id: doc.id })}
                        >
                          削除する
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Project Folder Documents */}
      {caseFolders && caseFolders.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">プロジェクトフォルダ資料</h3>
            <span className="text-xs text-muted-foreground">（この案件が属するフォルダの共通資料）</span>
          </div>
          {caseFolders.map((folder: any) => (
            <div key={folder.id} className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium">{folder.name}</span>
              </div>
              {folderDocs && folderDocs.filter((d: any) => d.folderId === folder.id).length > 0 ? (
                <div className="space-y-1.5 ml-5">
                  {folderDocs.filter((d: any) => d.folderId === folder.id).map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg border bg-amber-50/50 hover:bg-amber-50">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs flex-1 truncate">{doc.fileName}</span>
                      <Badge className={`text-[9px] px-1 py-0 ${getCategoryColor(doc.category)}`}>
                        {doc.category}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => window.open(doc.fileUrl, "_blank")}>
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground ml-5">資料なし</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Shared Documents Section */}
      {sharedDocs && sharedDocs.items && sharedDocs.items.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold">共通資料</h3>
            <span className="text-xs text-muted-foreground">（全案件共通で参照可能）</span>
          </div>
          <div className="space-y-2">
            {sharedDocs.items.map((doc: any) => {
              const tags: string[] = doc.tags ? (() => { try { return JSON.parse(doc.tags); } catch { return []; } })() : [];
              return (
                <Card key={doc.id} className="hover:shadow-sm transition-shadow border-l-4 border-l-blue-400">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Globe className="h-7 w-7 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-medium truncate">{doc.fileName}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${getCategoryColor(doc.category)}`}>
                          {doc.category}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700 bg-blue-50">
                          共通
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString("ja-JP")}</span>
                        {doc.memo && <span className="truncate max-w-[200px]">📝 {doc.memo}</span>}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          {tags.map((t: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => window.open(doc.fileUrl, "_blank")}
                        title="プレビュー / ダウンロード"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// 再訪記録カード
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
function StatusHistoryTab({ caseId }: { caseId: number }) {
  const { data: logs = [], isLoading } = trpc.statusLogs.listByCase.useQuery({ caseId });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          ステータス変更の履歴はまだありません
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="font-serif-jp font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          ステータス変更履歴
        </h3>
        <div className="relative">
          {/* タイムラインの縦線 */}
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
          <div className="space-y-4">
            {logs.map((log, idx) => {
              const photoUrls: string[] = log.photoUrls ? JSON.parse(log.photoUrls) : [];
              return (
                <div key={log.id} className="relative pl-8">
                  {/* タイムラインのドット */}
                  <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 ${
                    log.toStatus === '完了' ? 'bg-emerald-500 border-emerald-300' :
                    log.toStatus === 'クローズ' ? 'bg-gray-500 border-gray-300' :
                    idx === 0 ? 'bg-blue-500 border-blue-300' : 'bg-muted border-border'
                  }`} />
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{log.fromStatus ?? '—'}</Badge>
                        <span className="text-muted-foreground text-xs">→</span>
                        <Badge className={`text-[10px] ${
                          log.toStatus === '完了' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          log.toStatus === '施工中' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          'bg-secondary text-secondary-foreground'
                        }`}>{log.toStatus}</Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {log.userName ?? '不明'}
                    </div>
                    {log.comment && (
                      <div className="mt-2 text-sm bg-background border rounded p-2">
                        {log.comment}
                      </div>
                    )}
                    {photoUrls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {photoUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt={`完了写真 ${i + 1}`}
                              className="h-16 w-16 object-cover rounded border hover:opacity-80 transition-opacity"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


// ============================================================
// Partner Status Changer (完了時に写真・コメント入力ダイアログ表示)
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
// Store History Tab (店舗履歴タブ - 同一店舗の過去案件・写真)
// ============================================================
function StoreHistoryTab({ storeId, currentCaseId }: { storeId: number; currentCaseId: number }) {
  const { data: pastCases = [], isLoading: casesLoading } = trpc.storeMaster.pastCases.useQuery({ storeId });
  const { data: pastPhotos = [], isLoading: photosLoading } = trpc.storeMaster.pastPhotos.useQuery({ storeId, limit: 30 });
  const { data: storeInfo } = trpc.storeMaster.get.useQuery({ id: storeId });
  const lightbox = useLightbox();
  const lightboxItems = useMemo(
    () => pastPhotos.map((p) => ({
      url: `/api/storage/${p.fileKey}`,
      title: [p.photoType, p.workItem].filter(Boolean).join(" / "),
      subtitle: p.memo ?? undefined,
    })),
    [pastPhotos]
  );

  const otherCases = pastCases.filter((c) => c.id !== currentCaseId);

  if (casesLoading || photosLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 店舗情報サマリ */}
      {storeInfo && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-serif-jp font-semibold flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4" />
              {storeInfo.storeName}
              <Badge variant="outline" className="text-[10px]">{storeInfo.brand}</Badge>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">累計案件</span>
                <p className="font-semibold">{storeInfo.totalCaseCount}件</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">累計現調</span>
                <p className="font-semibold">{storeInfo.totalSurveyCount}回</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">累計写真</span>
                <p className="font-semibold">{storeInfo.totalPhotoCount}枚</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">最終現調</span>
                <p className="font-semibold">
                  {storeInfo.lastSurveyDate
                    ? new Date(storeInfo.lastSurveyDate).toLocaleDateString("ja-JP")
                    : "—"}
                </p>
              </div>
            </div>
            {(storeInfo.equipmentNotes || storeInfo.accessNotes || storeInfo.keyNotes) && (
              <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                {storeInfo.equipmentNotes && (
                  <div>
                    <span className="text-muted-foreground text-xs">設備メモ:</span>
                    <p className="text-xs mt-0.5">{storeInfo.equipmentNotes}</p>
                  </div>
                )}
                {storeInfo.accessNotes && (
                  <div>
                    <span className="text-muted-foreground text-xs">アクセス:</span>
                    <p className="text-xs mt-0.5">{storeInfo.accessNotes}</p>
                  </div>
                )}
                {storeInfo.keyNotes && (
                  <div>
                    <span className="text-muted-foreground text-xs">鍵情報:</span>
                    <p className="text-xs mt-0.5">{storeInfo.keyNotes}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 過去案件一覧 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-serif-jp font-semibold flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4" />
            同一店舗の過去案件
            <Badge variant="secondary" className="text-[10px]">{otherCases.length}件</Badge>
          </h3>
          {otherCases.length === 0 ? (
            <p className="text-sm text-muted-foreground">この店舗の他の案件はありません</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {otherCases.map((c) => (
                <a
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="block border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{c.requestNumber}</span>
                        <Badge variant="outline" className="text-[10px]">{c.progressStage}</Badge>
                        <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                      </div>
                      <p className="text-sm mt-1 truncate">{c.requestContent || c.categoryLarge || "—"}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 過去写真ギャラリー */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-serif-jp font-semibold flex items-center gap-2 mb-3">
            <ImageIcon className="h-4 w-4" />
            同一店舗の写真
            <Badge variant="secondary" className="text-[10px]">{pastPhotos.length}枚</Badge>
          </h3>
          {pastPhotos.length === 0 ? (
            <p className="text-sm text-muted-foreground">この店舗の写真はまだありません</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {pastPhotos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-md overflow-hidden border cursor-pointer hover:ring-2 ring-primary transition-all"
                  onClick={() => lightbox.open(idx)}
                >
                  <img
                    src={`/api/storage/${photo.fileKey}`}
                    alt={photo.memo || photo.photoType || "写真"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {photo.photoType && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center py-0.5 truncate">
                      {photo.photoType}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Lightbox
        items={lightboxItems}
        index={lightbox.index}
        onClose={lightbox.close}
        onIndexChange={lightbox.setIndex}
      />
    </div>
  );
}

// ============================================================
// Survey Skip Card (現調スキップ判断カード)
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
