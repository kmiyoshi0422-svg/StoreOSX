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

export default function PhotosTab({
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
