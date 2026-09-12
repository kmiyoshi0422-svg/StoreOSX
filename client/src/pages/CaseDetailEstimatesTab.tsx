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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function EstimatesTab({ caseId, partnerToken }: { caseId: number; partnerToken: string | null }) {
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
