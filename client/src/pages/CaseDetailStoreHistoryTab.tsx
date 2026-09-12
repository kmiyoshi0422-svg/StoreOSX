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

export default function StoreHistoryTab({ storeId, currentCaseId }: { storeId: number; currentCaseId: number }) {
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

      {/* 設備台帳パネル */}
      <StoreEquipmentPanel storeId={storeId} />
    </div>
  );
}

